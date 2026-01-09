const { spawn } = require('child_process');
const logger = require('../utils/logger');

class AmpService {
  constructor() {
    this.activeSessions = new Map();
    this.ampAvailable = false;
    this.checkAmpCLI();
  }

  async checkAmpCLI() {
    try {
      const checkProcess = spawn('amp', ['--version']);

      checkProcess.on('close', (code) => {
        if (code === 0) {
          this.ampAvailable = true;
          logger.info('Amp CLI detected and available');
        } else {
          this.ampAvailable = false;
          logger.warn('Amp CLI check returned non-zero exit code', { code });
        }
      });

      checkProcess.on('error', (error) => {
        this.ampAvailable = false;
        logger.warn('Amp CLI not available', { error: error.message });
      });
    } catch (error) {
      this.ampAvailable = false;
      logger.error('Error checking Amp CLI', { error: error.message });
    }
  }

  isAvailable() {
    return this.ampAvailable;
  }

  async executeAmpCommand(projectPath, prompt, socket, options = {}) {
    try {
      if (!this.ampAvailable) {
        throw new Error('Amp CLI is not installed or not available. Install with: npm install -g @sourcegraph/amp');
      }

      logger.info('Executing Amp Code command', {
        projectPath,
        promptLength: prompt.length
      });

      const sessionId = `amp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Argumentos para Amp CLI
      let args;
      
      if (options.threadId) {
        // Continuar thread existente
        // amp threads continue <threadId> --execute "prompt" --stream-json --dangerously-allow-all
        args = [
          'threads', 'continue', options.threadId,
          '--execute', prompt,
          '--stream-json',
          '--dangerously-allow-all'
        ];
        logger.info('Continuing Amp thread', { threadId: options.threadId });
      } else {
        // Nueva conversación
        // amp --execute "prompt" --stream-json --dangerously-allow-all
        args = [
          '--execute', prompt,
          '--stream-json',
          '--dangerously-allow-all'
        ];
      }

      logger.info('Starting Amp process', {
        sessionId,
        args: args.map((a) => a.length > 50 ? `"${a.substring(0, 50)}..."` : a),
        cwd: projectPath
      });

      const ampProcess = spawn('amp', args, {
        cwd: projectPath,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { 
          ...process.env,
          AMP_API_KEY: process.env.AMP_API_KEY || ''
        }
      });

      this.activeSessions.set(sessionId, ampProcess);

      logger.info('Amp process spawned', { sessionId, pid: ampProcess.pid });

      // Buffer para acumular JSON parcial
      let jsonBuffer = '';

      // Configurar encoding
      if (ampProcess.stdout) {
        ampProcess.stdout.setEncoding('utf8');
      }
      if (ampProcess.stderr) {
        ampProcess.stderr.setEncoding('utf8');
      }

      // Stream stdout (JSON format)
      ampProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        jsonBuffer += chunk;

        // Intentar parsear líneas JSON completas
        const lines = jsonBuffer.split('\n');
        jsonBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              this.handleAmpMessage(parsed, sessionId, socket);
            } catch (e) {
              // Si no es JSON válido, enviar como texto
              socket.emit('amp:output', {
                sessionId,
                type: 'text',
                content: line
              });
            }
          }
        }
      });

      // Stream stderr
      ampProcess.stderr.on('data', (data) => {
        const output = data.toString();
        logger.warn('Amp stderr received', { sessionId, content: output });
        socket.emit('amp:error', {
          sessionId,
          type: 'stderr',
          content: output
        });
      });

      // Proceso completado
      ampProcess.on('close', (code) => {
        logger.info('Amp process closed', { sessionId, exitCode: code });
        socket.emit('amp:complete', {
          sessionId,
          code
        });
        this.activeSessions.delete(sessionId);
      });

      // Error del proceso
      ampProcess.on('error', (error) => {
        logger.error('Amp process error', { sessionId, error: error.message });
        socket.emit('amp:error', {
          sessionId,
          type: 'error',
          content: `Process error: ${error.message}`
        });
        this.activeSessions.delete(sessionId);
      });

      return { sessionId };

    } catch (error) {
      logger.error('Failed to execute Amp Code', { error: error.message, projectPath });
      throw error;
    }
  }

  handleAmpMessage(message, sessionId, socket) {
    // Amp envía diferentes tipos de mensajes en JSON
    switch (message.type) {
      case 'system':
        // Capturar el thread ID de Amp del mensaje init
        if (message.subtype === 'init' && message.session_id) {
          logger.info('Amp system init received', { 
            sessionId, 
            ampThreadId: message.session_id,
            tools: message.tools?.length 
          });
          // Enviar el thread ID al frontend para mantener contexto
          socket.emit('amp:thread', {
            sessionId,
            threadId: message.session_id
          });
          break;
        }
        socket.emit('amp:output', {
          sessionId,
          type: 'system',
          content: message.message || message.content || JSON.stringify(message)
        });
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
        
        socket.emit('amp:output', {
          sessionId,
          type: 'assistant',
          content: assistantContent
        });
        break;

      case 'result':
        // El resultado es un resumen final, no lo mostramos para evitar duplicación
        // Solo logueamos para debug
        logger.info('Amp result received (not emitting to avoid duplication)', {
          sessionId,
          result: message.result?.substring?.(0, 100) || message.result,
          isError: message.is_error
        });
        break;

      case 'tool_use':
      case 'tool_result':
        socket.emit('amp:output', {
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
        socket.emit('amp:output', {
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
      logger.info('Amp session stopped', { sessionId });
      return true;
    }

    logger.warn('Attempted to stop non-existent Amp session', { sessionId });
    return false;
  }

  getActiveSessionsCount() {
    return this.activeSessions.size;
  }
}

module.exports = new AmpService();
