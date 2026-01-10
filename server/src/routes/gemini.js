const express = require('express');
const router = express.Router();
const GeminiService = require('../services/GeminiService');
const { validatePrompt, sanitizePath, validateSessionId } = require('../utils/validator');
const logger = require('../utils/logger');

// POST /api/gemini/execute
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

    logger.info('Gemini execute request received', {
      projectPath: sanitizedPath,
      socketId,
      promptLength: validatedPrompt.length,
      threadId: threadId || 'new'
    });

    const result = await GeminiService.executeGeminiCommand(
      sanitizedPath,
      validatedPrompt,
      socket,
      { threadId }
    );

    res.json(result);

  } catch (error) {
    logger.error('Error in /gemini/execute endpoint', { error: error.message });
    next(error);
  }
});

// POST /api/gemini/cancel
router.post('/cancel', async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId is required'
      });
    }

    validateSessionId(sessionId);

    logger.info('Gemini cancel request received', { sessionId });

    const stopped = GeminiService.stopSession(sessionId);

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
    logger.error('Error in /gemini/cancel endpoint', { error: error.message });
    next(error);
  }
});

module.exports = router;
