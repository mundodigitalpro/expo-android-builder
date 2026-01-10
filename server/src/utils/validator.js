const path = require('path');
const { ALLOWED_COMMANDS, PROJECTS_BASE_PATH } = require('../config/constants');

const validateCommand = (command) => {
  const isAllowed = ALLOWED_COMMANDS.some(allowed => command.trim().startsWith(allowed));

  if (!isAllowed) {
    throw new Error(`Command not allowed: ${command}`);
  }

  return true;
};

const sanitizePath = (userPath) => {
  const resolved = path.resolve(PROJECTS_BASE_PATH, userPath);

  if (!resolved.startsWith(PROJECTS_BASE_PATH)) {
    throw new Error('Invalid path - potential path traversal detected');
  }

  return resolved;
};

const validateProjectName = (name) => {
  const nameRegex = /^[a-zA-Z0-9-_]+$/;

  if (!name || !nameRegex.test(name)) {
    throw new Error('Invalid project name. Use only letters, numbers, hyphens, and underscores.');
  }

  if (name.length < 3 || name.length > 50) {
    throw new Error('Project name must be between 3 and 50 characters.');
  }

  return true;
};

const validateClaudePrompt = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string');
  }

  if (prompt.length > 2000) {
    throw new Error('Prompt must be less than 2000 characters');
  }

  return prompt.trim();
};

const validateSessionId = (sessionId) => {
  if (!sessionId || !/^[a-zA-Z0-9-]+$/.test(sessionId)) {
    throw new Error('Invalid session ID format');
  }

  return true;
};

module.exports = {
  validateCommand,
  sanitizePath,
  validateProjectName,
  validateClaudePrompt,
  validatePrompt: validateClaudePrompt,
  validateSessionId
};
