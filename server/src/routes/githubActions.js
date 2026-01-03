const express = require('express');
const router = express.Router();
const githubActionsService = require('../services/GitHubActionsService');
const logger = require('../utils/logger');

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

    if (!['debug', 'release'].includes(buildType)) {
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
 * GET /api/github-actions/runs
 * Get recent workflow runs
 */
router.get('/runs', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    if (!githubActionsService.isConfigured()) {
      return res.status(503).json({
        error: 'GitHub Actions not configured. GITHUB_TOKEN missing in server configuration.'
      });
    }

    const runs = await githubActionsService.getWorkflowRuns(limit);

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
