const express = require('express');
const router = express.Router();
const ampService = require('../services/AmpService');
const logger = require('../utils/logger');

// GET /api/amp/status - Verificar disponibilidad de Amp
router.get('/status', (req, res) => {
  res.json({
    available: ampService.isAvailable(),
    activeSessions: ampService.getActiveSessionsCount()
  });
});

// POST /api/amp/cancel - Cancelar sesión
router.post('/cancel', (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const stopped = ampService.stopSession(sessionId);

  if (stopped) {
    logger.info('Amp session cancelled via API', { sessionId });
    res.json({ message: 'Session cancelled', sessionId });
  } else {
    res.status(404).json({ error: 'Session not found', sessionId });
  }
});

// GET /api/amp/sessions - Obtener número de sesiones activas
router.get('/sessions', (req, res) => {
  res.json({
    activeSessions: ampService.getActiveSessionsCount()
  });
});

module.exports = router;
