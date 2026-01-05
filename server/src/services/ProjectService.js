const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { executeCommand } = require('../utils/executor');
const { sanitizePath, validateProjectName } = require('../utils/validator');
const { PROJECTS_BASE_PATH } = require('../config/constants');
const logger = require('../utils/logger');
const githubActionsService = require('./GitHubActionsService');

class ProjectService {
  async createProject(projectName, template = 'blank') {
    try {
      validateProjectName(projectName);

      const projectId = uuidv4();
      const projectPath = path.join(PROJECTS_BASE_PATH, projectName);

      await fs.access(projectPath).then(
        () => {
          throw new Error(`Project ${projectName} already exists`);
        },
        () => { }
      );

      logger.info('Creating new Expo project', { projectName, template, projectPath });

      const command = `npx create-expo-app ${projectName} --template ${template}`;
      await executeCommand(command, {
        cwd: PROJECTS_BASE_PATH,
        timeout: 300000
      });

      await executeCommand('git init', { cwd: projectPath });

      // Configure app.json for EAS builds
      await this.configureAppJsonForEAS(projectPath, projectName);

      // Create eas.json with build profiles
      await this.createEASConfig(projectPath);

      const metadata = {
        id: projectId,
        name: projectName,
        template,
        createdAt: new Date().toISOString(),
        path: projectPath
      };

      await fs.writeFile(
        path.join(projectPath, '.expo-builder-meta.json'),
        JSON.stringify(metadata, null, 2)
      );

      logger.info('Project created successfully', { projectName, projectId });

      return metadata;
    } catch (error) {
      logger.error('Failed to create project', { projectName, error: error.message });
      throw error;
    }
  }

  async configureAppJsonForEAS(projectPath, projectName) {
    try {
      const appJsonPath = path.join(projectPath, 'app.json');
      const appJsonContent = await fs.readFile(appJsonPath, 'utf-8');
      const appJson = JSON.parse(appJsonContent);

      // Convert project name to valid package name (lowercase, no special chars)
      const packageName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Update expo config
      appJson.expo = {
        ...appJson.expo,
        owner: 'josejordandev',
        android: {
          ...appJson.expo.android,
          package: `com.josejordandev.${packageName}`
        },
        ios: {
          ...appJson.expo.ios,
          bundleIdentifier: `com.josejordandev.${packageName}`
        }
      };

      await fs.writeFile(appJsonPath, JSON.stringify(appJson, null, 2));
      logger.info('Configured app.json for EAS', { projectPath, packageName });
    } catch (error) {
      logger.warn('Failed to configure app.json automatically', { error: error.message });
      // Don't throw - project is still usable, just needs manual config
    }
  }

  async createEASConfig(projectPath) {
    try {
      const easJsonPath = path.join(projectPath, 'eas.json');

      const easConfig = {
        cli: {
          version: ">= 7.0.0",
          appVersionSource: "remote"
        },
        build: {
          development: {
            developmentClient: true,
            distribution: "internal",
            android: {
              credentialsSource: "remote"
            }
          },
          preview: {
            distribution: "internal",
            android: {
              buildType: "apk",
              credentialsSource: "remote",
              withoutCredentials: true
            }
          },
          production: {
            android: {
              buildType: "app-bundle",
              credentialsSource: "remote"
            }
          }
        },
        submit: {
          production: {}
        }
      };

      await fs.writeFile(easJsonPath, JSON.stringify(easConfig, null, 2));
      logger.info('Created eas.json', { projectPath });
    } catch (error) {
      logger.warn('Failed to create eas.json automatically', { error: error.message });
      // Don't throw - project is still usable
    }
  }

  async listProjects() {
    try {
      await fs.mkdir(PROJECTS_BASE_PATH, { recursive: true });

      const entries = await fs.readdir(PROJECTS_BASE_PATH, { withFileTypes: true });
      const projects = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metaPath = path.join(PROJECTS_BASE_PATH, entry.name, '.expo-builder-meta.json');
          try {
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            const metadata = JSON.parse(metaContent);
            projects.push(metadata);
          } catch (error) {
            const fallbackMeta = {
              id: uuidv4(),
              name: entry.name,
              createdAt: new Date().toISOString(),
              path: path.join(PROJECTS_BASE_PATH, entry.name),
              template: 'unknown'
            };
            projects.push(fallbackMeta);
          }
        }
      }

      logger.info('Listed projects', { count: projects.length });
      return projects;
    } catch (error) {
      logger.error('Failed to list projects', { error: error.message });
      throw error;
    }
  }

  async deleteProject(projectName) {
    try {
      validateProjectName(projectName);

      const projectPath = sanitizePath(projectName);

      await fs.access(projectPath);

      await fs.rm(projectPath, { recursive: true, force: true });

      let githubCleanup;
      try {
        githubCleanup = await this.cleanupGitHubBranches(projectName);
      } catch (error) {
        logger.warn('GitHub branch cleanup failed after project deletion', {
          projectName,
          error: error.message
        });
      }

      logger.info('Project deleted successfully', { projectName, githubCleanup });

      return { message: `Project ${projectName} deleted successfully`, githubCleanup };
    } catch (error) {
      logger.error('Failed to delete project', { projectName, error: error.message });
      throw error;
    }
  }

  async cleanupGitHubBranches(projectName) {
    if (!githubActionsService.isConfigured()) {
      logger.warn('Skipping GitHub branch cleanup (token not configured)', {
        projectName
      });
      return { skipped: true, reason: 'GitHub token not configured' };
    }

    const prefix = `build/${projectName}-`;
    let branches;

    try {
      branches = await githubActionsService.listBranches(prefix);
    } catch (error) {
      logger.warn('Failed to list GitHub branches for cleanup', {
        projectName,
        error: error.message
      });
      return { skipped: true, reason: 'Failed to list branches', prefix };
    }

    if (!branches.length) {
      return { prefix, deleted: [], failed: [] };
    }

    const deleted = [];
    const failed = [];

    for (const branch of branches) {
      try {
        await githubActionsService.deleteBranch(branch.name);
        deleted.push(branch.name);
      } catch (error) {
        failed.push({ name: branch.name, error: error.message });
      }
    }

    if (failed.length) {
      logger.warn('Some GitHub branches failed to delete', {
        projectName,
        failedCount: failed.length
      });
    }

    return { prefix, deleted, failed };
  }

  async getProjectInfo(projectName) {
    try {
      validateProjectName(projectName);

      const projectPath = sanitizePath(projectName);
      const metaPath = path.join(projectPath, '.expo-builder-meta.json');

      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const metadata = JSON.parse(metaContent);

      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      return {
        ...metadata,
        dependencies: packageJson.dependencies,
        version: packageJson.version
      };
    } catch (error) {
      logger.error('Failed to get project info', { projectName, error: error.message });
      throw error;
    }
  }
}

module.exports = new ProjectService();
