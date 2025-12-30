const express = require('express');
const router = express.Router();
const EASService = require('../services/EASService');
const { sanitizePath } = require('../utils/validator');
const logger = require('../utils/logger');

// POST /api/builds/start
router.post('/start', async (req, res, next) => {
  try {
    const { projectPath, platform, profile, socketId } = req.body;

    if (!projectPath) {
      return res.status(400).json({
        error: 'projectPath is required'
      });
    }

    const sanitizedPath = sanitizePath(projectPath);
    const buildPlatform = platform || 'android';
    const buildProfile = profile || 'preview';

    // Obtener socket si se proporciona socketId
    let socket = null;
    if (socketId) {
      const io = req.app.get('io');
      if (io) {
        socket = io.sockets.sockets.get(socketId);
      }
    }

    logger.info('Build start request received', {
      projectPath: sanitizedPath,
      platform: buildPlatform,
      profile: buildProfile,
      socketId
    });

    const result = await EASService.startBuild(
      sanitizedPath,
      buildPlatform,
      buildProfile,
      socket
    );

    res.json(result);

  } catch (error) {
    logger.error('Error in /start endpoint', { error: error.message });
    next(error);
  }
});

// POST /api/builds/cancel
router.post('/cancel', async (req, res, next) => {
  try {
    const { buildId } = req.body;

    if (!buildId) {
      return res.status(400).json({
        error: 'buildId is required'
      });
    }

    logger.info('Build cancel request received', { buildId });

    const cancelled = EASService.cancelBuild(buildId);

    if (cancelled) {
      res.json({
        message: 'Build cancelled successfully',
        buildId
      });
    } else {
      res.status(404).json({
        error: 'Build not found or already completed',
        buildId
      });
    }

  } catch (error) {
    logger.error('Error in /cancel endpoint', { error: error.message });
    next(error);
  }
});

// GET /api/builds/status/:easBuildId
router.get('/status/:easBuildId', async (req, res, next) => {
  try {
    const { easBuildId } = req.params;
    const { projectPath } = req.query;

    if (!projectPath) {
      return res.status(400).json({
        error: 'projectPath query parameter is required'
      });
    }

    const sanitizedPath = sanitizePath(projectPath);

    logger.info('Build status request received', {
      easBuildId,
      projectPath: sanitizedPath
    });

    const buildInfo = await EASService.getBuildStatus(easBuildId, sanitizedPath);

    res.json(buildInfo);

  } catch (error) {
    logger.error('Error in /status endpoint', { error: error.message });
    next(error);
  }
});

// GET /api/builds/list
router.get('/list', async (req, res, next) => {
  try {
    const { projectPath, limit } = req.query;

    if (!projectPath) {
      return res.status(400).json({
        error: 'projectPath query parameter is required'
      });
    }

    const sanitizedPath = sanitizePath(projectPath);
    const buildLimit = limit ? parseInt(limit) : 10;

    logger.info('Build list request received', {
      projectPath: sanitizedPath,
      limit: buildLimit
    });

    const builds = await EASService.listBuilds(sanitizedPath, buildLimit);

    res.json(builds);

  } catch (error) {
    const errorMessage = error.message.toLowerCase();

    // Si el proyecto no está vinculado a EAS o no tiene builds, devolver array vacío
    if (errorMessage.includes('not linked') ||
      errorMessage.includes('no project') ||
      errorMessage.includes('project not found') ||
      errorMessage.includes('command failed')) {
      logger.warn('EAS project not linked or no builds', {
        projectPath: req.query.projectPath,
        error: error.message
      });
      return res.json({
        builds: [],
        warning: 'Project may not be linked to EAS. Run "eas project:init" to configure.',
        rawError: error.message
      });
    }

    logger.error('Error in /list endpoint', { error: error.message });
    next(error);
  }
});

// GET /api/builds/info/:buildId
router.get('/info/:buildId', async (req, res, next) => {
  try {
    const { buildId } = req.params;

    logger.info('Build info request received', { buildId });

    const buildInfo = EASService.getBuildInfo(buildId);

    if (buildInfo) {
      res.json(buildInfo);
    } else {
      res.status(404).json({
        error: 'Build not found',
        buildId
      });
    }

  } catch (error) {
    logger.error('Error in /info endpoint', { error: error.message });
    next(error);
  }
});

// POST /api/builds/init - Initialize EAS project
router.post('/init', async (req, res, next) => {
  try {
    const { projectPath } = req.body;

    if (!projectPath) {
      return res.status(400).json({
        error: 'projectPath is required'
      });
    }

    const sanitizedPath = sanitizePath(projectPath);

    logger.info('EAS project init request received', {
      projectPath: sanitizedPath
    });

    const result = await EASService.initProject(sanitizedPath);

    res.json(result);

  } catch (error) {
    logger.error('Error in /init endpoint', { error: error.message });
    next(error);
  }
});

module.exports = router;
