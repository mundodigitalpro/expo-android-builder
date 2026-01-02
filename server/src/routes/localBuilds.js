const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const LocalBuildService = require('../services/LocalBuildService');
const { sanitizePath } = require('../utils/validator');
const logger = require('../utils/logger');

/**
 * POST /api/local-builds/start
 * Start a local Android build
 */
router.post('/start', async (req, res, next) => {
    try {
        const { projectPath, buildType, socketId } = req.body;

        if (!projectPath) {
            return res.status(400).json({
                error: 'projectPath is required'
            });
        }

        const sanitizedPath = sanitizePath(projectPath);
        const type = buildType || 'debug';

        // Get socket if provided
        let socket = null;
        if (socketId) {
            const io = req.app.get('io');
            if (io) {
                socket = io.sockets.sockets.get(socketId);
            }
        }

        logger.info('Local build start request', {
            projectPath: sanitizedPath,
            buildType: type,
            socketId
        });

        // Start build asynchronously and return buildId immediately
        const buildId = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Start build in background
        LocalBuildService.buildAndroid(sanitizedPath, type, socket)
            .then(result => {
                logger.info('Local build completed', { buildId: result.buildId });
            })
            .catch(error => {
                logger.error('Local build failed', { error: error.message });
            });

        // Return immediately with buildId
        res.json({
            buildId,
            status: 'started',
            message: 'Build started. Use /status/:buildId to monitor progress.'
        });

    } catch (error) {
        logger.error('Error in /start endpoint', { error: error.message });
        next(error);
    }
});

/**
 * GET /api/local-builds/status/:buildId
 * Get status of a local build
 */
router.get('/status/:buildId', (req, res, next) => {
    try {
        const { buildId } = req.params;

        const buildStatus = LocalBuildService.getBuildStatus(buildId);

        if (!buildStatus) {
            return res.status(404).json({
                error: 'Build not found',
                buildId
            });
        }

        res.json(buildStatus);

    } catch (error) {
        logger.error('Error in /status endpoint', { error: error.message });
        next(error);
    }
});

/**
 * GET /api/local-builds/list
 * List all builds
 */
router.get('/list', (req, res, next) => {
    try {
        const builds = LocalBuildService.listBuilds();
        res.json({ builds });
    } catch (error) {
        logger.error('Error in /list endpoint', { error: error.message });
        next(error);
    }
});

/**
 * POST /api/local-builds/cancel
 * Cancel a running build
 */
router.post('/cancel', (req, res, next) => {
    try {
        const { buildId } = req.body;

        if (!buildId) {
            return res.status(400).json({
                error: 'buildId is required'
            });
        }

        const cancelled = LocalBuildService.cancelBuild(buildId);

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

/**
 * GET /api/local-builds/download/:buildId
 * Download APK for a completed build
 */
router.get('/download/:buildId', async (req, res, next) => {
    try {
        const { buildId } = req.params;

        const apkPath = LocalBuildService.getApkPath(buildId);

        if (!apkPath) {
            return res.status(404).json({
                error: 'APK not found. Build may still be in progress or failed.',
                buildId
            });
        }

        // Check file exists
        if (!fs.existsSync(apkPath)) {
            return res.status(404).json({
                error: 'APK file not found on disk',
                buildId,
                path: apkPath
            });
        }

        const fileName = path.basename(apkPath);

        logger.info('Serving APK download', { buildId, apkPath, fileName });

        res.download(apkPath, fileName, (err) => {
            if (err) {
                logger.error('Error serving APK', { error: err.message });
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to download APK' });
                }
            }
        });

    } catch (error) {
        logger.error('Error in /download endpoint', { error: error.message });
        next(error);
    }
});

module.exports = router;
