const { spawn } = require('child_process');
const logger = require('../utils/logger');

class ClaudeService {
  constructor() {
    this.activeSessions = new Map();
    this.claudeAvailable = false;
    this.checkClaudeCLI();
  }

  async checkClaudeCLI() {
    try {
      const checkProcess = spawn('claude', ['--version']);

      checkProcess.on('close', (code) => {
        if (code === 0) {
          this.claudeAvailable = true;
          logger.info('Claude CLI detected and available');
        } else {
          this.claudeAvailable = false;
          logger.warn('Claude CLI check returned non-zero exit code', { code });
        }
      });

      checkProcess.on('error', (error) => {
        this.claudeAvailable = false;
        logger.warn('Claude CLI not available', { error: error.message });
      });
    } catch (error) {
      this.claudeAvailable = false;
      logger.error('Error checking Claude CLI', { error: error.message });
    }
  }

  async executeClaudeCommand(projectPath, prompt, socket) {
    try {
      // Verificar disponibilidad de Claude CLI
      if (!this.claudeAvailable) {
        throw new Error('Claude CLI is not installed or not available. Please install it first.');
      }

      logger.info('Executing Claude Code command', {
        projectPath,
        promptLength: prompt.length
      });

      // Generar ID de sesión único
      const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Ejecutar Claude CLI con spawn
      // -p: Print response and exit (non-interactive mode)
      // --output-format text: Output as plain text for easy streaming
      // --dangerously-skip-permissions: Skip permission prompts (safe in controlled environment)
      const args = [
        '-p',
        '--output-format', 'text',
        '--dangerously-skip-permissions',
        prompt
      ];

      logger.info('Starting Claude process', {
        sessionId,
        args: args.map((a, i) => i === args.length - 1 ? `"${a.substring(0, 50)}..."` : a),
        cwd: projectPath
      });

      const claudeProcess = spawn('claude', args, {
        cwd: projectPath,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      // Guardar proceso en sesiones activas
      this.activeSessions.set(sessionId, claudeProcess);

      logger.info('Claude process spawned', { sessionId, pid: claudeProcess.pid });

      // Configurar encoding para los streams
      if (claudeProcess.stdout) {
        claudeProcess.stdout.setEncoding('utf8');
      }
      if (claudeProcess.stderr) {
        claudeProcess.stderr.setEncoding('utf8');
      }

      // Stream stdout a través de WebSocket
      claudeProcess.stdout.on('data', (data) => {
        const output = data.toString();
        logger.info('Claude stdout received', {
          sessionId,
          length: output.length,
          preview: output.substring(0, 100)
        });

        // Emitir al socket específico
        socket.emit('claude:output', {
          sessionId,
          type: 'stdout',
          content: output
        });

        logger.info('Emitted claude:output event', { sessionId, socketId: socket.id });
      });

      // Stream stderr a través de WebSocket
      claudeProcess.stderr.on('data', (data) => {
        const output = data.toString();
        logger.warn('Claude stderr received', {
          sessionId,
          length: output.length,
          content: output
        });
        socket.emit('claude:error', {
          sessionId,
          type: 'stderr',
          content: output
        });
      });

      // Cuando stdout termina
      claudeProcess.stdout.on('end', () => {
        logger.info('Claude stdout ended', { sessionId });
      });

      // Cuando stderr termina
      claudeProcess.stderr.on('end', () => {
        logger.info('Claude stderr ended', { sessionId });
      });

      // Cuando el proceso termina
      claudeProcess.on('close', (code) => {
        logger.info('Claude process closed', {
          sessionId,
          exitCode: code
        });
        socket.emit('claude:complete', {
          sessionId,
          code
        });
        this.activeSessions.delete(sessionId);
        logger.info('Claude Code execution completed', {
          sessionId,
          exitCode: code
        });
      });

      // Manejo de errores del proceso
      claudeProcess.on('error', (error) => {
        logger.error('Claude process error event', {
          sessionId,
          error: error.message,
          stack: error.stack
        });
        socket.emit('claude:error', {
          sessionId,
          type: 'error',
          content: `Process error: ${error.message}`
        });
        this.activeSessions.delete(sessionId);
        logger.error('Claude Code process error', {
          sessionId,
          error: error.message
        });
      });

      return { sessionId };

    } catch (error) {
      logger.error('Failed to execute Claude Code', {
        error: error.message,
        projectPath
      });
      throw error;
    }
  }

  stopSession(sessionId) {
    const process = this.activeSessions.get(sessionId);

    if (process) {
      process.kill('SIGTERM');
      this.activeSessions.delete(sessionId);
      logger.info('Claude session stopped', { sessionId });
      return true;
    }

    logger.warn('Attempted to stop non-existent session', { sessionId });
    return false;
  }

  getActiveSessionsCount() {
    return this.activeSessions.size;
  }
}

module.exports = new ClaudeService();
