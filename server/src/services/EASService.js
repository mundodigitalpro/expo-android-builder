const { spawn } = require('child_process');
const logger = require('../utils/logger');

class EASService {
  constructor() {
    this.activeBuilds = new Map();
    this.easAvailable = false;
    this.checkEASCLI();
  }

  async checkEASCLI() {
    try {
      const checkProcess = spawn('eas', ['--version']);

      checkProcess.on('close', (code) => {
        if (code === 0) {
          this.easAvailable = true;
          logger.info('EAS CLI detected and available');
        } else {
          this.easAvailable = false;
          logger.warn('EAS CLI check returned non-zero exit code', { code });
        }
      });

      checkProcess.on('error', (error) => {
        this.easAvailable = false;
        logger.warn('EAS CLI not available', { error: error.message });
      });
    } catch (error) {
      this.easAvailable = false;
      logger.error('Error checking EAS CLI', { error: error.message });
    }
  }

  async startBuild(projectPath, platform = 'android', profile = 'preview', socket) {
    try {
      if (!this.easAvailable) {
        throw new Error('EAS CLI is not installed or not available. Please install it first.');
      }

      if (!['android', 'ios', 'all'].includes(platform)) {
        throw new Error('Platform must be android, ios, or all');
      }

      logger.info('Starting EAS build', {
        projectPath,
        platform,
        profile
      });

      const buildId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Argumentos para eas build
      // --platform: android, ios, or all
      // --profile: preview, production, etc (from eas.json)
      // --non-interactive: No prompt for user input
      // --no-wait: Don't wait for build to complete (we'll poll status)
      const args = [
        'build',
        '--platform', platform,
        '--profile', profile,
        '--non-interactive',
        '--json'
      ];

      logger.info('Starting EAS build process', {
        buildId,
        args,
        cwd: projectPath
      });

      const easProcess = spawn('eas', args, {
        cwd: projectPath,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          EAS_SKIP_AUTO_FINGERPRINT: '1'  // Fix for Termux/Android concurrency issue
        }
      });

      this.activeBuilds.set(buildId, {
        process: easProcess,
        projectPath,
        platform,
        profile,
        startedAt: new Date(),
        status: 'starting'
      });

      logger.info('EAS build process spawned', { buildId, pid: easProcess.pid });

      if (easProcess.stdout) {
        easProcess.stdout.setEncoding('utf8');
      }
      if (easProcess.stderr) {
        easProcess.stderr.setEncoding('utf8');
      }

      let stdoutBuffer = '';
      let stderrBuffer = '';

      // Capturar stdout
      easProcess.stdout.on('data', (data) => {
        const output = data.toString();
        stdoutBuffer += output;

        logger.info('EAS build stdout', {
          buildId,
          length: output.length,
          preview: output.substring(0, 200)
        });

        if (socket) {
          socket.emit('build:output', {
            buildId,
            type: 'stdout',
            content: output
          });
        }

        // Intentar parsear JSON si está completo
        try {
          const jsonMatch = stdoutBuffer.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const buildInfo = JSON.parse(jsonMatch[0]);
            if (buildInfo.id) {
              const buildData = this.activeBuilds.get(buildId);
              if (buildData) {
                buildData.easBuildId = buildInfo.id;
                buildData.status = 'in-queue';
                this.activeBuilds.set(buildId, buildData);

                logger.info('EAS build queued', {
                  buildId,
                  easBuildId: buildInfo.id
                });

                if (socket) {
                  socket.emit('build:queued', {
                    buildId,
                    easBuildId: buildInfo.id,
                    buildInfo
                  });
                }
              }
            }
          }
        } catch (e) {
          // No es JSON válido todavía, continuar acumulando
        }
      });

      // Capturar stderr
      easProcess.stderr.on('data', (data) => {
        const output = data.toString();
        stderrBuffer += output;

        logger.warn('EAS build stderr', {
          buildId,
          content: output
        });

        if (socket) {
          socket.emit('build:error', {
            buildId,
            type: 'stderr',
            content: output
          });
        }
      });

      easProcess.on('close', (code) => {
        logger.info('EAS build process closed', {
          buildId,
          exitCode: code
        });

        const buildData = this.activeBuilds.get(buildId);
        if (buildData) {
          buildData.status = code === 0 ? 'submitted' : 'failed';
          buildData.exitCode = code;
          this.activeBuilds.set(buildId, buildData);
        }

        if (socket) {
          socket.emit('build:complete', {
            buildId,
            code,
            easBuildId: buildData?.easBuildId
          });
        }

        logger.info('EAS build submission completed', {
          buildId,
          exitCode: code
        });
      });

      easProcess.on('error', (error) => {
        logger.error('EAS build process error', {
          buildId,
          error: error.message
        });

        if (socket) {
          socket.emit('build:error', {
            buildId,
            type: 'error',
            content: `Process error: ${error.message}`
          });
        }

        this.activeBuilds.delete(buildId);
      });

      return { buildId };

    } catch (error) {
      logger.error('Failed to start EAS build', {
        error: error.message,
        projectPath
      });
      throw error;
    }
  }

  async getBuildStatus(easBuildId, projectPath) {
    try {
      return new Promise((resolve, reject) => {
        const args = ['build:view', easBuildId, '--json'];

        const easProcess = spawn('eas', args, {
          cwd: projectPath,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        let output = '';
        let errorOutput = '';

        easProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        easProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        easProcess.on('close', (code) => {
          if (code === 0) {
            try {
              const buildInfo = JSON.parse(output);
              resolve(buildInfo);
            } catch (e) {
              reject(new Error('Failed to parse build info JSON'));
            }
          } else {
            reject(new Error(errorOutput || 'Failed to get build status'));
          }
        });

        easProcess.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Failed to get build status', {
        error: error.message,
        easBuildId
      });
      throw error;
    }
  }

  async listBuilds(projectPath, limit = 10) {
    try {
      return new Promise((resolve, reject) => {
        const args = ['build:list', '--limit', limit.toString(), '--json', '--non-interactive'];

        logger.info('Starting EAS build:list', { projectPath, args });

        const easProcess = spawn('eas', args, {
          cwd: projectPath,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        let output = '';
        let errorOutput = '';

        easProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          output += chunk;
          logger.info('EAS build:list stdout', { content: chunk.trim() });
        });

        easProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          errorOutput += chunk;
          logger.warn('EAS build:list stderr', { content: chunk.trim() });
        });

        easProcess.on('close', (code) => {
          logger.info('EAS build:list process closed', {
            code,
            stdoutLength: output.length,
            stderrLength: errorOutput.length
          });

          if (code === 0) {
            try {
              // Handle empty output (no builds)
              if (!output.trim()) {
                logger.info('EAS build:list returned empty - no builds yet');
                resolve([]);
                return;
              }

              const builds = JSON.parse(output);
              // EAS puede devolver un objeto o un array
              if (Array.isArray(builds)) {
                resolve(builds);
              } else if (builds.builds && Array.isArray(builds.builds)) {
                resolve(builds.builds);
              } else {
                // Si es un objeto pero no tiene builds, devolver array vacío
                resolve([]);
              }
            } catch (e) {
              logger.error('Failed to parse builds JSON', {
                error: e.message,
                output: output.substring(0, 500)
              });
              // En lugar de fallar, devolver array vacío
              resolve([]);
            }
          } else {
            // Check if it's just "no builds" situation
            const combinedOutput = (errorOutput + output).toLowerCase();
            if (combinedOutput.includes('no builds') ||
              combinedOutput.includes('builds for') ||
              code === 0) {
              resolve([]);
            } else {
              reject(new Error(errorOutput || `EAS build:list failed with code ${code}`));
            }
          }
        });

        easProcess.on('error', (error) => {
          logger.error('EAS build:list process error', { error: error.message });
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Failed to list builds', {
        error: error.message,
        projectPath
      });
      throw error;
    }
  }

  // Nueva función para inicializar proyecto EAS
  async initProject(projectPath) {
    try {
      return new Promise((resolve, reject) => {
        // Usamos --non-interactive con --force para crear automáticamente si no existe
        const args = ['project:init', '--non-interactive', '--force'];

        logger.info('Initializing EAS project', { projectPath, args });

        const easProcess = spawn('eas', args, {
          cwd: projectPath,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        let output = '';
        let errorOutput = '';

        easProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        easProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        easProcess.on('close', (code) => {
          logger.info('EAS project:init completed', { code, output: output.trim() });

          if (code === 0) {
            resolve({
              success: true,
              message: 'Project initialized successfully',
              output: output.trim()
            });
          } else {
            // Si ya está vinculado, no es un error
            if (errorOutput.includes('already linked') || output.includes('already linked')) {
              resolve({
                success: true,
                message: 'Project already linked to EAS',
                output: output.trim()
              });
            } else {
              reject(new Error(errorOutput || 'Failed to initialize EAS project'));
            }
          }
        });

        easProcess.on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      logger.error('Failed to init EAS project', {
        error: error.message,
        projectPath
      });
      throw error;
    }
  }

  cancelBuild(buildId) {
    const buildData = this.activeBuilds.get(buildId);

    if (buildData && buildData.process) {
      buildData.process.kill('SIGTERM');
      this.activeBuilds.delete(buildId);
      logger.info('EAS build cancelled', { buildId });
      return true;
    }

    logger.warn('Attempted to cancel non-existent build', { buildId });
    return false;
  }

  getActiveBuildCount() {
    return this.activeBuilds.size;
  }

  getBuildInfo(buildId) {
    return this.activeBuilds.get(buildId);
  }
}

module.exports = new EASService();
