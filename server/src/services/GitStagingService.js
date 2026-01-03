const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { executeCommand } = require('../utils/executor');
const { validateProjectName } = require('../utils/validator');
const { PROJECTS_BASE_PATH, TEMP_BUILDS_PATH } = require('../config/constants');
const githubActionsService = require('./GitHubActionsService');
const StagingError = require('./StagingError');

class GitStagingService {
  constructor() {
    this.activeStagings = new Map();
    this.repoRoot = path.resolve(__dirname, '../../..');
    this.maxProjectSizeBytes = 50 * 1024 * 1024;
    this.excludedDirs = new Set([
      'node_modules',
      '.git',
      'android',
      'ios',
      '.expo',
      '.expo-shared'
    ]);
    this.failedCleanupPath = path.join(this.repoRoot, '.failed-cleanups.json');
  }

  generateBranchName(projectName) {
    const timestamp = Math.floor(Date.now() / 1000);
    const shortHash = crypto.randomBytes(3).toString('hex');
    return `build/${projectName}-${timestamp}-${shortHash}`;
  }

  async stageProject(projectName) {
    validateProjectName(projectName);

    if (this.activeStagings.has(projectName)) {
      throw new StagingError(
        'Staging already in progress for this project',
        StagingError.codes.STAGING_IN_PROGRESS,
        409
      );
    }

    this.activeStagings.set(projectName, { startedAt: Date.now() });
    let branchName;

    try {
      await this.validateForStaging(projectName);

      branchName = this.generateBranchName(projectName);
      const projectPath = path.join('temp-builds', projectName);
      const sourcePath = path.join(PROJECTS_BASE_PATH, projectName);
      const destPath = path.join(TEMP_BUILDS_PATH, projectName);

      await this.createTempBranch(branchName);
      await this.copyProjectFiles(sourcePath, destPath);
      const commitHash = await this.commitStagedFiles(projectName);
      await this.pushBranch(branchName);

      await this.checkoutBranch('main', { allowFailure: true });
      await this.deleteLocalBranch(branchName);

      return { branchName, projectPath, commitHash };
    } catch (error) {
      logger.error('Failed to stage project', {
        projectName,
        branchName,
        error: error.message
      });

      await this.safeCleanupAfterFailure(projectName, branchName);

      throw error;
    } finally {
      this.activeStagings.delete(projectName);
    }
  }

  async copyProjectFiles(sourcePath, destPath) {
    await fs.mkdir(TEMP_BUILDS_PATH, { recursive: true });
    await fs.rm(destPath, { recursive: true, force: true });
    await fs.mkdir(destPath, { recursive: true });

    const excludeArgs = Array.from(this.excludedDirs)
      .map((dir) => `--exclude ${dir}`)
      .join(' ');

    const command = `rsync -a ${excludeArgs} ${sourcePath}/ ${destPath}/`;
    await executeCommand(command, { cwd: this.repoRoot });
  }

  async createTempBranch(branchName) {
    await this.checkoutBranch('main');

    const existing = await executeCommand(`git branch --list ${branchName}`, {
      cwd: this.repoRoot
    });

    if (existing.stdout.trim()) {
      await this.deleteTempBranch(branchName);
    }

    await executeCommand(`git checkout -b ${branchName}`, { cwd: this.repoRoot });
  }

  async commitStagedFiles(projectName) {
    const commitMessage = `chore:stage-build-${projectName}`;
    const commitEnv = {};
    const gitUserName = process.env.GIT_USER_NAME;
    const gitUserEmail = process.env.GIT_USER_EMAIL;

    if (gitUserName) {
      commitEnv.GIT_AUTHOR_NAME = gitUserName;
      commitEnv.GIT_COMMITTER_NAME = gitUserName;
    }
    if (gitUserEmail) {
      commitEnv.GIT_AUTHOR_EMAIL = gitUserEmail;
      commitEnv.GIT_COMMITTER_EMAIL = gitUserEmail;
    }

    await executeCommand(`git add -f temp-builds/${projectName}`, {
      cwd: this.repoRoot
    });
    await executeCommand(`git commit -m ${commitMessage}`, {
      cwd: this.repoRoot,
      env: commitEnv
    });

    const commitHash = await executeCommand('git rev-parse --short HEAD', {
      cwd: this.repoRoot
    });
    return commitHash.stdout.trim();
  }

  async pushBranch(branchName) {
    if (!githubActionsService.isConfigured()) {
      throw new StagingError(
        'GitHub token not configured for staging',
        StagingError.codes.GITHUB_NOT_CONFIGURED,
        503
      );
    }

    const originalUrlResult = await executeCommand('git remote get-url origin', {
      cwd: this.repoRoot
    });
    const originalUrl = originalUrlResult.stdout.trim();
    const authenticatedUrl = `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${githubActionsService.repoOwner}/${githubActionsService.repoName}.git`;

    try {
      await executeCommand(`git remote set-url origin ${authenticatedUrl}`, {
        cwd: this.repoRoot
      });

      let lastError;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          await executeCommand(`git push -u origin ${branchName}`, {
            cwd: this.repoRoot
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          logger.warn('Git push failed', {
            branchName,
            attempt,
            error: error.message
          });
          await this.sleep(attempt * 1000);
        }
      }

      if (lastError) {
        throw new StagingError(
          'Failed to push staging branch to GitHub',
          StagingError.codes.PUSH_FAILED,
          502
        );
      }
    } finally {
      if (originalUrl) {
        await executeCommand(`git remote set-url origin ${originalUrl}`, {
          cwd: this.repoRoot
        });
      }
    }
  }

  async deleteTempBranch(branchName) {
    try {
      await githubActionsService.deleteBranch(branchName);
    } catch (error) {
      logger.warn('Failed to delete remote staging branch', {
        branchName,
        error: error.message
      });
    }

    await this.checkoutBranch('main', { allowFailure: true });
    await this.deleteLocalBranch(branchName);
  }

  async deleteLocalBranch(branchName) {
    try {
      await executeCommand(`git branch -D ${branchName}`, { cwd: this.repoRoot });
    } catch (error) {
      logger.warn('Failed to delete local staging branch', {
        branchName,
        error: error.message
      });
    }
  }

  async cleanupTempBuild(projectName) {
    const localPath = path.join(TEMP_BUILDS_PATH, projectName);
    try {
      await fs.rm(localPath, { recursive: true, force: true });
      return localPath;
    } catch (error) {
      logger.warn('Failed to cleanup temp build folder', {
        projectName,
        error: error.message
      });
      await this.recordFailedCleanup({ projectName, localPath, error: error.message });
      return null;
    }
  }

  async validateForStaging(projectName) {
    if (!githubActionsService.isConfigured()) {
      throw new StagingError(
        'GitHub token not configured for staging',
        StagingError.codes.GITHUB_NOT_CONFIGURED,
        503
      );
    }

    const projectPath = path.join(PROJECTS_BASE_PATH, projectName);

    try {
      await fs.access(projectPath);
    } catch (error) {
      throw new StagingError(
        'Project not found',
        StagingError.codes.PROJECT_NOT_FOUND,
        404
      );
    }

    const requiredFiles = ['package.json', 'app.json'];
    for (const file of requiredFiles) {
      try {
        await fs.access(path.join(projectPath, file));
      } catch (error) {
        throw new StagingError(
          `Missing required file: ${file}`,
          StagingError.codes.INVALID_PROJECT,
          400
        );
      }
    }

    const projectSize = await this.getProjectSize(projectPath, this.maxProjectSizeBytes);
    if (projectSize > this.maxProjectSizeBytes) {
      throw new StagingError(
        'Project is too large for staging (max 50MB without node_modules)',
        StagingError.codes.PROJECT_TOO_LARGE,
        413
      );
    }

    const status = await executeCommand('git status --porcelain', {
      cwd: this.repoRoot
    });
    if (status.stdout.trim()) {
      throw new StagingError(
        'Repository has uncommitted changes. Please commit or stash them first.',
        StagingError.codes.DIRTY_REPO,
        409
      );
    }
  }

  async getProjectSize(dirPath, maxBytes) {
    let total = 0;
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (this.excludedDirs.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        total += await this.getProjectSize(fullPath, maxBytes);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        total += stat.size;
      }

      if (total > maxBytes) {
        return total;
      }
    }

    return total;
  }

  async checkoutBranch(branchName, options = {}) {
    try {
      await executeCommand(`git checkout ${branchName}`, { cwd: this.repoRoot });
    } catch (error) {
      if (options.allowFailure) {
        logger.warn('Failed to checkout branch', {
          branchName,
          error: error.message
        });
        return;
      }
      throw error;
    }
  }

  async safeCleanupAfterFailure(projectName, branchName) {
    try {
      if (branchName) {
        await this.deleteTempBranch(branchName);
      }
    } catch (error) {
      await this.recordFailedCleanup({
        projectName,
        branchName,
        error: error.message
      });
    }

    await this.cleanupTempBuild(projectName);
  }

  async recordFailedCleanup(entry) {
    try {
      let existing = [];
      try {
        const content = await fs.readFile(this.failedCleanupPath, 'utf-8');
        existing = JSON.parse(content);
        if (!Array.isArray(existing)) {
          existing = [];
        }
      } catch (error) {
        existing = [];
      }

      existing.push({
        ...entry,
        timestamp: new Date().toISOString()
      });

      await fs.writeFile(this.failedCleanupPath, JSON.stringify(existing, null, 2));
    } catch (error) {
      logger.warn('Failed to record cleanup error', { error: error.message });
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new GitStagingService();
