const logger = require('../utils/logger');

const createRateLimiter = ({ windowMs, max, keyGenerator }) => {
  const hits = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator ? keyGenerator(req) : (req.headers.authorization || req.ip);
    const windowStart = now - windowMs;

    const timestamps = hits.get(key) || [];
    const recent = timestamps.filter((timestamp) => timestamp > windowStart);
    recent.push(now);
    hits.set(key, recent);

    if (recent.length > max) {
      logger.warn('Rate limit exceeded', { key, url: req.originalUrl });
      return res.status(429).json({
        error: 'Too many staging requests. Please wait before trying again.'
      });
    }

    return next();
  };
};

module.exports = createRateLimiter;
