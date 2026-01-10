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

  async executeClaudeCommand(projectPath, prompt, socket, options = {}) {
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
      // --output-format stream-json: JSON streaming for parsing session_id
      // --verbose: Required for stream-json
      // --dangerously-skip-permissions: Skip permission prompts (safe in controlled environment)
      // --resume: Continue existing conversation if threadId provided
      const args = [
        '-p',
        '--output-format', 'stream-json',
        '--verbose',
        '--dangerously-skip-permissions'
      ];

      if (options.threadId) {
        args.push('--resume', options.threadId);
        logger.info('Resuming Claude thread', { threadId: options.threadId });
      }

      args.push(prompt);

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

      // Buffer para acumular JSON parcial
      let jsonBuffer = '';

      // Stream stdout (JSON format)
      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        jsonBuffer += chunk;

        // Intentar parsear líneas JSON completas
        const lines = jsonBuffer.split('\n');
        jsonBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              this.handleClaudeMessage(parsed, sessionId, socket);
            } catch (e) {
              // Si no es JSON válido, enviar como texto
              socket.emit('claude:output', {
                sessionId,
                type: 'text',
                content: line
              });
            }
          }
        }
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

  handleClaudeMessage(message, sessionId, socket) {
    // Claude envía diferentes tipos de mensajes en JSON (igual que Amp)
    switch (message.type) {
      case 'system':
        // Capturar el thread ID de Claude del mensaje init
        if (message.subtype === 'init' && message.session_id) {
          logger.info('Claude system init received', { 
            sessionId, 
            claudeThreadId: message.session_id,
            tools: message.tools?.length 
          });
          // Enviar el thread ID al frontend para mantener contexto
          socket.emit('claude:thread', {
            sessionId,
            threadId: message.session_id
          });
        }
        break;

      case 'assistant':
        // Extraer contenido del mensaje del asistente
        let assistantContent = '';
        if (message.message?.content) {
          if (Array.isArray(message.message.content)) {
            assistantContent = message.message.content
              .filter(c => c.type === 'text')
              .map(c => c.text)
              .join('');
          } else {
            assistantContent = message.message.content;
          }
        } else {
          assistantContent = message.content || JSON.stringify(message);
        }
        
        socket.emit('claude:output', {
          sessionId,
          type: 'assistant',
          content: assistantContent
        });
        break;

      case 'result':
        // El resultado es un resumen final, no lo mostramos para evitar duplicación
        logger.info('Claude result received (not emitting to avoid duplication)', {
          sessionId,
          result: message.result?.substring?.(0, 100) || message.result,
          isError: message.is_error
        });
        break;

      case 'tool_use':
      case 'tool_result':
        socket.emit('claude:output', {
          sessionId,
          type: 'tool',
          tool: message.tool || message.name || 'unknown',
          content: message.input || message.output || message.content || JSON.stringify(message)
        });
        break;

      case 'user':
        // Ignorar mensajes de usuario (eco)
        break;

      default:
        socket.emit('claude:output', {
          sessionId,
          type: message.type || 'unknown',
          content: typeof message === 'string' ? message : JSON.stringify(message)
        });
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
