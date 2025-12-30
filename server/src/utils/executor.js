const { spawn } = require('child_process');
const logger = require('./logger');
const { validateCommand } = require('./validator');

const executeCommand = (command, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      validateCommand(command);

      logger.info('Executing command', { command, cwd: options.cwd });

      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      const child = spawn(cmd, args, {
        cwd: options.cwd || process.cwd(),
        shell: true,
        env: { ...process.env, ...options.env }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        if (options.onStdout) {
          options.onStdout(chunk);
        }
      });

      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        if (options.onStderr) {
          options.onStderr(chunk);
        }
      });

      child.on('close', (code) => {
        if (code === 0) {
          logger.info('Command completed successfully', { command, code });
          resolve({ stdout, stderr, code });
        } else {
          logger.error('Command failed', { command, code, stderr });
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        logger.error('Command execution error', { command, error: error.message });
        reject(error);
      });

      if (options.timeout) {
        setTimeout(() => {
          child.kill();
          reject(new Error(`Command timeout after ${options.timeout}ms`));
        }, options.timeout);
      }

    } catch (error) {
      logger.error('Command validation failed', { command, error: error.message });
      reject(error);
    }
  });
};

module.exports = {
  executeCommand
};
