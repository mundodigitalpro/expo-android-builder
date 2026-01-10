const { spawn } = require('child_process');
const logger = require('../utils/logger');

class CodexService {
  constructor() {
    this.activeSessions = new Map();
    this.codexAvailable = false;
    this.checkCodexCLI();
  }

  async checkCodexCLI() {
    try {
      const checkProcess = spawn('codex', ['--version']);

      checkProcess.on('close', (code) => {
        if (code === 0) {
          this.codexAvailable = true;
          logger.info('Codex CLI detected and available');
        } else {
          this.codexAvailable = false;
          logger.warn('Codex CLI check returned non-zero exit code', { code });
        }
      });

      checkProcess.on('error', (error) => {
        this.codexAvailable = false;
        logger.warn('Codex CLI not available', { error: error.message });
      });
    } catch (error) {
      this.codexAvailable = false;
      logger.error('Error checking Codex CLI', { error: error.message });
    }
  }

  async executeCodexCommand(projectPath, prompt, socket, options = {}) {
    try {
      if (!this.codexAvailable) {
        throw new Error('Codex CLI is not installed or not available. Please install it first.');
      }

      logger.info('Executing Codex CLI command', {
        projectPath,
        promptLength: prompt.length
      });

      const sessionId = `codex-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      const baseArgs = [
        '--json',
        '--dangerously-bypass-approvals-and-sandbox',
        '--skip-git-repo-check'
      ];

      let args;
      if (options.threadId) {
        args = ['exec', 'resume', ...baseArgs, options.threadId, prompt];
        logger.info('Resuming Codex session', { threadId: options.threadId });
      } else {
        args = ['exec', ...baseArgs, prompt];
      }

      logger.info('Starting Codex process', {
        sessionId,
        args: args.map((a, i) => i === args.length - 1 ? `"${a.substring(0, 50)}..."` : a),
        cwd: projectPath
      });

      const codexProcess = spawn('codex', args, {
        cwd: projectPath,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      this.activeSessions.set(sessionId, codexProcess);

      logger.info('Codex process spawned', { sessionId, pid: codexProcess.pid });

      if (codexProcess.stdout) {
        codexProcess.stdout.setEncoding('utf8');
      }
      if (codexProcess.stderr) {
        codexProcess.stderr.setEncoding('utf8');
      }

      let jsonBuffer = '';

      codexProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        jsonBuffer += chunk;

        const lines = jsonBuffer.split('\n');
        jsonBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              this.handleCodexMessage(parsed, sessionId, socket);
            } catch (e) {
              socket.emit('codex:output', {
                sessionId,
                type: 'text',
                content: line
              });
            }
          }
        }
      });

      codexProcess.stderr.on('data', (data) => {
        const output = data.toString();
        logger.warn('Codex stderr received', {
          sessionId,
          length: output.length,
          content: output
        });
        socket.emit('codex:error', {
          sessionId,
          type: 'stderr',
          content: output
        });
      });

      codexProcess.on('close', (code) => {
        logger.info('Codex process closed', {
          sessionId,
          exitCode: code
        });
        socket.emit('codex:complete', {
          sessionId,
          code
        });
        this.activeSessions.delete(sessionId);
      });

      codexProcess.on('error', (error) => {
        logger.error('Codex process error event', {
          sessionId,
          error: error.message
        });
        socket.emit('codex:error', {
          sessionId,
          type: 'error',
          content: `Process error: ${error.message}`
        });
        this.activeSessions.delete(sessionId);
      });

      return { sessionId };

    } catch (error) {
      logger.error('Failed to execute Codex CLI', {
        error: error.message,
        projectPath
      });
      throw error;
    }
  }

  extractTextContent(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map((item) => this.extractTextContent(item)).filter(Boolean).join('');
    }
    if (typeof content === 'object') {
      if (typeof content.text === 'string') return content.text;
      if (typeof content.content === 'string') return content.content;
      if (Array.isArray(content.content)) {
        return this.extractTextContent(content.content);
      }
    }
    return '';
  }

  extractSessionId(message) {
    return (
      message.thread_id ||
      message.threadId ||
      message.session_id ||
      message.sessionId ||
      message.data?.session_id ||
      message.data?.thread_id ||
      message.data?.sessionId ||
      message.meta?.session_id ||
      message.meta?.thread_id ||
      message.meta?.sessionId ||
      null
    );
  }

  handleCodexMessage(message, sessionId, socket) {
    if (message.type === 'thread.started' && message.thread_id) {
      socket.emit('codex:thread', {
        sessionId,
        threadId: message.thread_id
      });
      return;
    }

    const threadId = this.extractSessionId(message);
    if (threadId) {
      socket.emit('codex:thread', {
        sessionId,
        threadId
      });
    }

    const role = message.role || message.message?.role || message.data?.role;
    if (role === 'user') {
      return;
    }

    const messageType = message.type || message.event || message.kind;
    if (messageType && messageType.toString().includes('tool')) {
      socket.emit('codex:output', {
        sessionId,
        type: 'tool',
        tool: message.tool?.name || message.name || message.tool_name || message.data?.tool?.name || 'unknown',
        content: message.input || message.output || message.tool?.input || message.tool?.output || JSON.stringify(message)
      });
      return;
    }

    if (messageType === 'item.completed' || messageType === 'item.delta') {
      const item = message.item || {};
      if (item.type === 'reasoning') {
        return;
      }
      if (item.type === 'agent_message' || item.type === 'assistant_message' || item.type === 'assistant') {
        const itemText = this.extractTextContent(item.text || item.content || item.message);
        if (itemText) {
          socket.emit('codex:output', {
            sessionId,
            type: 'assistant',
            content: itemText
          });
        }
        return;
      }
      if (item.type === 'tool_call' || item.type === 'tool_result') {
        socket.emit('codex:output', {
          sessionId,
          type: 'tool',
          tool: item.tool?.name || item.name || 'unknown',
          content: item.input || item.output || JSON.stringify(item)
        });
        return;
      }
    }

    const assistantContent = this.extractTextContent(
      message.message?.content ||
      message.content ||
      message.delta?.content ||
      message.data?.content ||
      message.text ||
      message.delta
    );

    if (assistantContent) {
      socket.emit('codex:output', {
        sessionId,
        type: 'assistant',
        content: assistantContent
      });
      return;
    }

    if (typeof message === 'string') {
      socket.emit('codex:output', {
        sessionId,
        type: 'text',
        content: message
      });
    }
  }

  stopSession(sessionId) {
    const process = this.activeSessions.get(sessionId);
    if (process) {
      process.kill('SIGTERM');
      this.activeSessions.delete(sessionId);
      logger.info('Codex session stopped', { sessionId });
      return true;
    }
    logger.warn('Attempted to stop non-existent Codex session', { sessionId });
    return false;
  }
}

module.exports = new CodexService();
