const express = require('express');
const router = express.Router();
const githubActionsService = require('../services/GitHubActionsService');
const gitStagingService = require('../services/GitStagingService');
const StagingError = require('../services/StagingError');
const createRateLimiter = require('../middleware/rateLimit');
const { validateProjectName } = require('../utils/validator');
const logger = require('../utils/logger');
const path = require('path');

const stagingRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5
});

const isValidBuildType = (buildType) => ['debug', 'release'].includes(buildType);

const isValidBranchName = (branchName) => /^build\/[a-zA-Z0-9-_]+$/.test(branchName);

const isValidProjectPath = (projectPath) => {
  if (!projectPath) return false;
  const normalized = path.posix.normalize(projectPath);
  if (normalized.includes('..')) return false;
  return normalized.startsWith('temp-builds/');
};

const handleStagingError = (error, res, next) => {
  if (error instanceof StagingError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code
    });
  }
  return next(error);
};

/**
 * POST /api/github-actions/trigger
 * Trigger a GitHub Actions workflow build
 */
router.post('/trigger', async (req, res, next) => {
  try {
    const { projectPath, buildType = 'debug' } = req.body;

    if (!projectPath) {
      return res.status(400).json({
        error: 'projectPath is required'
      });
    }

    if (!isValidBuildType(buildType)) {
      return res.status(400).json({
        error: 'buildType must be "debug" or "release"'
      });
    }

    if (!githubActionsService.isConfigured()) {
      return res.status(503).json({
        error: 'GitHub Actions not configured. GITHUB_TOKEN missing in server configuration.'
      });
    }

    const result = await githubActionsService.triggerBuild(projectPath, buildType);

    logger.info('GitHub Actions build triggered via API', {
      projectPath,
      buildType
    });

    res.json({
      success: true,
      message: 'Build triggered successfully on GitHub Actions',
      data: result,
      viewUrl: `https://github.com/${githubActionsService.repoOwner}/${githubActionsService.repoName}/actions`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/github-actions/build-user-project
 * Stage a user project and trigger a build in a single request
 */
router.post('/build-user-project', stagingRateLimit, async (req, res, next) => {
  const { projectName, buildType = 'debug' } = req.body;

  if (!projectName) {
    return res.status(400).json({
      error: 'projectName is required'
    });
  }

  try {
    validateProjectName(projectName);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!isValidBuildType(buildType)) {
    return res.status(400).json({
      error: 'buildType must be "debug" or "release"'
    });
  }

  if (!githubActionsService.isConfigured()) {
    return res.status(503).json({
      error: 'GitHub Actions not configured. GITHUB_TOKEN missing in server configuration.'
    });
  }

  let staging;
  try {
    staging = await gitStagingService.stageProject(projectName);
    const build = await githubActionsService.triggerBuild(
      staging.projectPath,
      buildType,
      staging.branchName
    );

    logger.info('GitHub Actions staging build triggered', {
      projectName,
      buildType,
      branchName: staging.branchName
    });

    res.json({
      success: true,
      staging,
      build,
      viewUrl: `https://github.com/${githubActionsService.repoOwner}/${githubActionsService.repoName}/actions?query=branch:${staging.branchName}`,
      cleanupInfo: {
        branchName: staging.branchName,
        projectName
      }
    });
  } catch (error) {
    if (staging?.branchName) {
      try {
        await gitStagingService.deleteTempBranch(staging.branchName);
        await gitStagingService.cleanupTempBuild(projectName);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup after build trigger error', {
          projectName,
          branchName: staging.branchName,
          error: cleanupError.message
        });
      }
    }
    return handleStagingError(error, res, next);
  }
});

/**
 * POST /api/github-actions/prepare-project
 * Stage a user project for GitHub Actions build
 */
router.post('/prepare-project', stagingRateLimit, async (req, res, next) => {
  const { projectName } = req.body;

  if (!projectName) {
    return res.status(400).json({
      error: 'projectName is required'
    });
  }

  try {
    validateProjectName(projectName);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!githubActionsService.isConfigured()) {
    return res.status(503).json({
      error: 'GitHub Actions not configured. GITHUB_TOKEN missing in server configuration.'
    });
  }

  try {
    const staging = await gitStagingService.stageProject(projectName);
    res.json({
      success: true,
      staging
    });
  } catch (error) {
    return handleStagingError(error, res, next);
  }
});

/**
 * POST /api/github-actions/trigger-staged
 * Trigger a build using an existing staged branch
 */
router.post('/trigger-staged', async (req, res, next) => {
  try {
    const { branchName, projectPath, buildType = 'debug' } = req.body;

    if (!branchName || !projectPath) {
      return res.status(400).json({
        error: 'branchName and projectPath are required'
      });
    }

    if (!isValidBranchName(branchName)) {
      return res.status(400).json({
        error: 'Invalid branchName format'
      });
    }

    if (!isValidProjectPath(projectPath)) {
      return res.status(400).json({
        error: 'Invalid projectPath for staged builds'
      });
    }

    if (!isValidBuildType(buildType)) {
      return res.status(400).json({
        error: 'buildType must be "debug" or "release"'
      });
    }

    const result = await githubActionsService.triggerBuild(
      projectPath,
      buildType,
      branchName
    );

    res.json({
      success: true,
      data: result,
      viewUrl: `https://github.com/${githubActionsService.repoOwner}/${githubActionsService.repoName}/actions?query=branch:${branchName}`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/github-actions/cleanup/:branchName
 * Cleanup staged branch and local temp files
 */
router.delete('/cleanup/:branchName', async (req, res, next) => {
  const { branchName } = req.params;
  const { projectName } = req.query;

  if (!branchName) {
    return res.status(400).json({
      error: 'branchName is required'
    });
  }

  if (!isValidBranchName(branchName)) {
    return res.status(400).json({
      error: 'Invalid branchName format'
    });
  }

  try {
    await gitStagingService.deleteTempBranch(branchName);
    const localPath = projectName
      ? await gitStagingService.cleanupTempBuild(projectName)
      : null;

    res.json({
      success: true,
      cleaned: {
        branch: branchName,
        localPath
      }
    });
  } catch (error) {
    return handleStagingError(error, res, next);
  }
});

/**
 * GET /api/github-actions/temp-branches
 * List temp branches on GitHub
 */
router.get('/temp-branches', async (req, res, next) => {
  try {
    const branches = await githubActionsService.listBranches('build/');
    res.json({
      success: true,
      branches,
      count: branches.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/github-actions/runs
 * Get recent workflow runs
 */
router.get('/runs', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const branch = req.query.branch;

    if (!githubActionsService.isConfigured()) {
      return res.status(503).json({
        error: 'GitHub Actions not configured. GITHUB_TOKEN missing in server configuration.'
      });
    }

    const runs = await githubActionsService.getWorkflowRuns(limit, branch);

    res.json({
      success: true,
      runs,
      count: runs.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/github-actions/runs/:runId/artifacts
 * Get artifacts for a specific workflow run
 */
router.get('/runs/:runId/artifacts', async (req, res, next) => {
  try {
    const { runId } = req.params;

    if (!githubActionsService.isConfigured()) {
      return res.status(503).json({
        error: 'GitHub Actions not configured. GITHUB_TOKEN missing in server configuration.'
      });
    }

    const artifacts = await githubActionsService.getArtifacts(runId);

    res.json({
      success: true,
      artifacts,
      count: artifacts.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/github-actions/status
 * Check if GitHub Actions is configured and available
 */
router.get('/status', async (req, res) => {
  const isConfigured = githubActionsService.isConfigured();

  res.json({
    configured: isConfigured,
    message: isConfigured
      ? 'GitHub Actions is configured and ready'
      : 'GitHub Actions not configured. Set GITHUB_TOKEN in server .env',
  });
});

module.exports = router;
