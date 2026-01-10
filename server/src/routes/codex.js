const express = require('express');
const router = express.Router();
const CodexService = require('../services/CodexService');
const { validatePrompt, sanitizePath, validateSessionId } = require('../utils/validator');
const logger = require('../utils/logger');

// POST /api/codex/execute
router.post('/execute', async (req, res, next) => {
  try {
    const { projectPath, prompt, socketId, threadId } = req.body;

    if (!projectPath || !prompt || !socketId) {
      return res.status(400).json({
        error: 'projectPath, prompt, and socketId are required'
      });
    }

    const sanitizedPath = sanitizePath(projectPath);
    const validatedPrompt = validatePrompt(prompt);

    const io = req.app.get('io');
    if (!io) {
      return res.status(500).json({
        error: 'WebSocket server not initialized'
      });
    }

    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      return res.status(400).json({
        error: 'Invalid socket ID or client disconnected'
      });
    }

    logger.info('Codex execute request received', {
      projectPath: sanitizedPath,
      socketId,
      promptLength: validatedPrompt.length,
      threadId: threadId || 'new'
    });

    const result = await CodexService.executeCodexCommand(
      sanitizedPath,
      validatedPrompt,
      socket,
      { threadId }
    );

    res.json(result);

  } catch (error) {
    logger.error('Error in /codex/execute endpoint', { error: error.message });
    next(error);
  }
});

// POST /api/codex/cancel
router.post('/cancel', async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId is required'
      });
    }

    validateSessionId(sessionId);

    logger.info('Codex cancel request received', { sessionId });

    const stopped = CodexService.stopSession(sessionId);

    if (stopped) {
      res.json({
        message: 'Session cancelled successfully',
        sessionId
      });
    } else {
      res.status(404).json({
        error: 'Session not found or already completed',
        sessionId
      });
    }

  } catch (error) {
    logger.error('Error in /codex/cancel endpoint', { error: error.message });
    next(error);
  }
});

module.exports = router;
