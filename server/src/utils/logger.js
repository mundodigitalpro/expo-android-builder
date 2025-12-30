const log = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    level,
    message,
    ...meta
  }));
};

module.exports = {
  info: (message, meta) => log('INFO', message, meta),
  error: (message, meta) => log('ERROR', message, meta),
  warn: (message, meta) => log('WARN', message, meta),
  debug: (message, meta) => log('DEBUG', message, meta)
};
