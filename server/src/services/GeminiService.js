const { spawn } = require('child_process');
const logger = require('../utils/logger');

class GeminiService {
  constructor() {
    this.activeSessions = new Map();
    this.geminiAvailable = false;
    this.checkGeminiCLI();
  }

  async checkGeminiCLI() {
    try {
      const checkProcess = spawn('gemini', ['--version']);

      checkProcess.on('close', (code) => {
        if (code === 0) {
          this.geminiAvailable = true;
          logger.info('Gemini CLI detected and available');
        } else {
          this.geminiAvailable = false;
          logger.warn('Gemini CLI check returned non-zero exit code', { code });
        }
      });

      checkProcess.on('error', (error) => {
        this.geminiAvailable = false;
        logger.warn('Gemini CLI not available', { error: error.message });
      });
    } catch (error) {
      this.geminiAvailable = false;
      logger.error('Error checking Gemini CLI', { error: error.message });
    }
  }

  async executeGeminiCommand(projectPath, prompt, socket, options = {}) {
    try {
      if (!this.geminiAvailable) {
        throw new Error('Gemini CLI is not installed or not available. Please install it first.');
      }

      logger.info('Executing Gemini CLI command', {
        projectPath,
        promptLength: prompt.length
      });

      const sessionId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Construct arguments
      // gemini "prompt" --output-format stream-json --yolo
      const args = [
        prompt,
        '--output-format', 'stream-json',
        '--yolo' // Auto-accept actions
      ];

      if (options.threadId) {
        args.push('--resume', options.threadId);
        logger.info('Resuming Gemini thread', { threadId: options.threadId });
      }

      logger.info('Starting Gemini process', {
        sessionId,
        args: args.map((a, i) => i === 0 ? `"${a.substring(0, 50)}"..."` : a),
        cwd: projectPath
      });

      const geminiProcess = spawn('gemini', args, {
        cwd: projectPath,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      this.activeSessions.set(sessionId, geminiProcess);

      logger.info('Gemini process spawned', { sessionId, pid: geminiProcess.pid });

      if (geminiProcess.stdout) {
        geminiProcess.stdout.setEncoding('utf8');
      }
      if (geminiProcess.stderr) {
        geminiProcess.stderr.setEncoding('utf8');
      }

      let jsonBuffer = '';

      geminiProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        jsonBuffer += chunk;

        const lines = jsonBuffer.split('\n');
        jsonBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              this.handleGeminiMessage(parsed, sessionId, socket);
            } catch (e) {
              socket.emit('gemini:output', {
                sessionId,
                type: 'text',
                content: line
              });
            }
          }
        }
      });

      geminiProcess.stderr.on('data', (data) => {
        const output = data.toString();
        logger.warn('Gemini stderr received', {
          sessionId,
          length: output.length,
          content: output
        });
        socket.emit('gemini:error', {
          sessionId,
          type: 'stderr',
          content: output
        });
      });

      geminiProcess.stdout.on('end', () => {
        logger.info('Gemini stdout ended', { sessionId });
      });

      geminiProcess.on('close', (code) => {
        logger.info('Gemini process closed', {
          sessionId,
          exitCode: code
        });
        socket.emit('gemini:complete', {
          sessionId,
          code
        });
        this.activeSessions.delete(sessionId);
      });

      geminiProcess.on('error', (error) => {
        logger.error('Gemini process error event', {
          sessionId,
          error: error.message
        });
        socket.emit('gemini:error', {
          sessionId,
          type: 'error',
          content: `Process error: ${error.message}`
        });
        this.activeSessions.delete(sessionId);
      });

      return { sessionId };

    } catch (error) {
      logger.error('Failed to execute Gemini CLI', {
        error: error.message,
        projectPath
      });
      throw error;
    }
  }

  handleGeminiMessage(message, sessionId, socket) {
    // Adapting to Gemini's JSON output
    // Assuming structure is similar to Claude/Amp or we map it
    // Using generic fallbacks if specific types aren't matched
    
    // Note: Use 'gemini:thread' etc events
    
    if (message.type) {
        switch (message.type) {
            case 'system':
                // Check for thread/session ID in system messages
                 if (message.session_id) {
                     socket.emit('gemini:thread', {
                         sessionId,
                         threadId: message.session_id
                     });
                 }
                 break;
            case 'assistant':
                let content = message.content;
                 if (typeof content === 'object') {
                     content = JSON.stringify(content);
                 }
                socket.emit('gemini:output', {
                    sessionId,
                    type: 'assistant',
                    content: content || ''
                });
                break;
            case 'tool': // Hypothetical, need to verify Gemini output
            case 'tool_use':
                 socket.emit('gemini:output', {
                    sessionId,
                    type: 'tool',
                    tool: message.name || 'unknown',
                    content: message.input || message.output || JSON.stringify(message)
                 });
                 break;
            default:
                // Pass through
                 socket.emit('gemini:output', {
                    sessionId,
                    type: message.type,
                    content: message.content || JSON.stringify(message)
                });
        }
    } else {
        // Fallback for untyped messages
        socket.emit('gemini:output', {
            sessionId,
            type: 'text',
            content: JSON.stringify(message)
        });
    }
  }

  stopSession(sessionId) {
    const process = this.activeSessions.get(sessionId);
    if (process) {
      process.kill('SIGTERM');
      this.activeSessions.delete(sessionId);
      logger.info('Gemini session stopped', { sessionId });
      return true;
    }
    return false;
  }
}

module.exports = new GeminiService();
