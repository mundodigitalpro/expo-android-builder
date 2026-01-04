const { AUTH_TOKEN } = require('../config/constants');
const logger = require('../utils/logger');

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const isDownloadRequest = req.method === 'GET'
    && req.path.includes('/github-actions/runs/')
    && req.path.endsWith('/download');

  if (!authHeader) {
    if (isDownloadRequest && req.query?.token) {
      const queryToken = req.query.token;
      if (queryToken === AUTH_TOKEN) {
        return next();
      }
      logger.warn('Invalid auth token (query)', { ip: req.ip });
      return res.status(403).json({ error: 'Invalid authentication token' });
    }

    logger.warn('Missing authorization header', { ip: req.ip });
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  if (token !== AUTH_TOKEN) {
    logger.warn('Invalid auth token', { ip: req.ip });
    return res.status(403).json({ error: 'Invalid authentication token' });
  }

  next();
};

module.exports = authMiddleware;
