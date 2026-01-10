const express = require('express');
const router = express.Router();
const ClaudeService = require('../services/ClaudeService');
const { validateClaudePrompt, sanitizePath, validateSessionId } = require('../utils/validator');
const logger = require('../utils/logger');

// POST /api/claude/execute
router.post('/execute', async (req, res, next) => {
  try {
    const { projectPath, prompt, socketId, threadId } = req.body;

    // Validar que todos los campos requeridos estén presentes
    if (!projectPath || !prompt || !socketId) {
      return res.status(400).json({
        error: 'projectPath, prompt, and socketId are required'
      });
    }

    // Sanitizar path y validar prompt
    const sanitizedPath = sanitizePath(projectPath);
    const validatedPrompt = validateClaudePrompt(prompt);

    // Obtener instancia de io
    const io = req.app.get('io');
    if (!io) {
      return res.status(500).json({
        error: 'WebSocket server not initialized'
      });
    }

    // Obtener socket del cliente
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      return res.status(400).json({
        error: 'Invalid socket ID or client disconnected'
      });
    }

    logger.info('Claude execute request received', {
      projectPath: sanitizedPath,
      socketId,
      promptLength: validatedPrompt.length,
      threadId: threadId || 'new'
    });

    // Ejecutar comando de Claude
    const result = await ClaudeService.executeClaudeCommand(
      sanitizedPath,
      validatedPrompt,
      socket,
      { threadId }
    );

    res.json(result);

  } catch (error) {
    logger.error('Error in /execute endpoint', { error: error.message });
    next(error);
  }
});

// POST /api/claude/cancel
router.post('/cancel', async (req, res, next) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        error: 'sessionId is required'
      });
    }

    // Validar formato de sessionId
    validateSessionId(sessionId);

    logger.info('Claude cancel request received', { sessionId });

    // Detener sesión
    const stopped = ClaudeService.stopSession(sessionId);

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
    logger.error('Error in /cancel endpoint', { error: error.message });
    next(error);
  }
});

module.exports = router;
