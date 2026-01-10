const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const { PORT, CORS_OPTIONS } = require('./src/config/constants');
const logger = require('./src/utils/logger');
const authMiddleware = require('./src/middleware/auth');
const errorHandler = require('./src/middleware/errorHandler');

const projectsRouter = require('./src/routes/projects');
const claudeRouter = require('./src/routes/claude');
const buildsRouter = require('./src/routes/builds');
const localBuildsRouter = require('./src/routes/localBuilds');
const githubActionsRouter = require('./src/routes/githubActions');
const ampRouter = require('./src/routes/amp');
const geminiRouter = require('./src/routes/gemini');
const codexRouter = require('./src/routes/codex');

const ampService = require('./src/services/AmpService');
const { PROJECTS_BASE_PATH } = require('./src/config/constants');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: CORS_OPTIONS
});

// Hacer io accesible a las rutas
app.set('io', io);

app.use(cors(CORS_OPTIONS));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/claude', authMiddleware, claudeRouter);
app.use('/api/builds', authMiddleware, buildsRouter);
app.use('/api/local-builds', authMiddleware, localBuildsRouter);
app.use('/api/github-actions', authMiddleware, githubActionsRouter);
app.use('/api/amp', authMiddleware, ampRouter);
app.use('/api/gemini', authMiddleware, geminiRouter);
app.use('/api/codex', authMiddleware, codexRouter);

io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });

  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // Amp Code WebSocket events
  socket.on('amp:execute', async (data) => {
    const { projectName, prompt, threadId } = data;
    const projectPath = projectName 
      ? path.join(PROJECTS_BASE_PATH, projectName)
      : PROJECTS_BASE_PATH;

    logger.info('Amp execute requested', { projectName, promptLength: prompt?.length });

    try {
      const result = await ampService.executeAmpCommand(
        projectPath, 
        prompt, 
        socket,
        { threadId }
      );
      socket.emit('amp:started', result);
    } catch (error) {
      logger.error('Amp execute error', { error: error.message });
      socket.emit('amp:error', { 
        type: 'error', 
        content: error.message 
      });
    }
  });

  socket.on('amp:cancel', (data) => {
    const { sessionId } = data;
    logger.info('Amp cancel requested', { sessionId });
    const stopped = ampService.stopSession(sessionId);
    if (stopped) {
      socket.emit('amp:cancelled', { sessionId });
    }
  });
});

app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Expo App Builder Server started`, {
    port: PORT,
    env: process.env.NODE_ENV
  });
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready for connections`);
  console.log(`🔑 Auth token: ${process.env.AUTH_TOKEN}\n`);
});

module.exports = { app, server, io };
