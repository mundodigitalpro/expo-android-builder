const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const execAsync = promisify(exec);
const logger = require('../utils/logger');
const { PROJECTS_BASE_PATH } = require('../config/constants');

class LocalBuildService {
    constructor() {
        this.activeBuilds = new Map();
        this.buildsOutputPath = process.env.BUILDS_OUTPUT_PATH || '/app-builder-builds';
        this.androidHome = process.env.ANDROID_HOME || '/opt/android-sdk';
        this.javaHome = process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64';
    }

    /**
     * Build Android APK locally using Expo prebuild + Gradle
     * @param {string} projectPath - Path to the Expo project
     * @param {string} buildType - 'debug' or 'release'
     * @param {object} socket - Socket.io socket for real-time updates
     * @returns {Promise<object>} Build result with buildId and status
     */
    async buildAndroid(projectPath, buildType = 'debug', socket = null) {
        const buildId = `local-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        logger.info('Starting local Android build', {
            buildId,
            projectPath,
            buildType
        });

        this.activeBuilds.set(buildId, {
            id: buildId,
            projectPath,
            buildType,
            status: 'starting',
            startedAt: new Date().toISOString(),
            output: [],
            apkPath: null
        });

        // Emit initial status
        if (socket) {
            socket.emit('local-build:started', { buildId, status: 'starting' });
        }

        try {
            // Step 1: Run expo prebuild to generate android folder
            await this.runPrebuild(buildId, projectPath, socket);

            // Step 2: Run Gradle build
            await this.runGradleBuild(buildId, projectPath, buildType, socket);

            // Step 3: Find and store APK path
            const apkPath = await this.findApk(projectPath, buildType);

            const buildData = this.activeBuilds.get(buildId);
            if (buildData) {
                buildData.status = 'completed';
                buildData.apkPath = apkPath;
                buildData.completedAt = new Date().toISOString();
                this.activeBuilds.set(buildId, buildData);
            }

            logger.info('Local build completed successfully', { buildId, apkPath });

            if (socket) {
                socket.emit('local-build:complete', {
                    buildId,
                    status: 'completed',
                    apkPath
                });
            }

            return {
                buildId,
                status: 'completed',
                apkPath,
                downloadUrl: `/api/local-builds/download/${buildId}`
            };

        } catch (error) {
            const buildData = this.activeBuilds.get(buildId);
            if (buildData) {
                buildData.status = 'failed';
                buildData.error = error.message;
                buildData.completedAt = new Date().toISOString();
                this.activeBuilds.set(buildId, buildData);
            }

            logger.error('Local build failed', { buildId, error: error.message });

            if (socket) {
                socket.emit('local-build:error', {
                    buildId,
                    status: 'failed',
                    error: error.message
                });
            }

            throw error;
        }
    }

    /**
     * Run expo prebuild to generate native Android project
     */
    async runPrebuild(buildId, projectPath, socket) {
        return new Promise((resolve, reject) => {
            this.updateBuildStatus(buildId, 'prebuild');

            if (socket) {
                socket.emit('local-build:output', {
                    buildId,
                    phase: 'prebuild',
                    message: 'Running expo prebuild...'
                });
            }

            const env = {
                ...process.env,
                ANDROID_HOME: this.androidHome,
                JAVA_HOME: this.javaHome,
                PATH: `/usr/local/bin:/usr/bin:/bin:${this.javaHome}/bin:${this.androidHome}/cmdline-tools/latest/bin:${this.androidHome}/platform-tools:${process.env.PATH || ''}`
            };

            const prebuildProcess = exec(
                'npx expo prebuild --platform android --clean',
                { cwd: projectPath, env, maxBuffer: 50 * 1024 * 1024 }
            );

            let errorOutput = '';

            prebuildProcess.stdout.on('data', (data) => {
                const message = data.toString();
                this.appendOutput(buildId, message);

                if (socket) {
                    socket.emit('local-build:output', {
                        buildId,
                        phase: 'prebuild',
                        message
                    });
                }
            });

            prebuildProcess.stderr.on('data', (data) => {
                const message = data.toString();
                errorOutput += message;
                this.appendOutput(buildId, message);

                if (socket) {
                    socket.emit('local-build:output', {
                        buildId,
                        phase: 'prebuild',
                        message,
                        isError: true
                    });
                }
            });

            prebuildProcess.on('close', (code) => {
                if (code === 0) {
                    logger.info('Prebuild completed', { buildId });
                    resolve();
                } else {
                    reject(new Error(`Prebuild failed with code ${code}: ${errorOutput}`));
                }
            });

            prebuildProcess.on('error', (error) => {
                reject(new Error(`Prebuild process error: ${error.message}`));
            });

            // Store process reference for cancellation
            const buildData = this.activeBuilds.get(buildId);
            if (buildData) {
                buildData.process = prebuildProcess;
                this.activeBuilds.set(buildId, buildData);
            }
        });
    }

    /**
     * Run Gradle build to create APK
     */
    async runGradleBuild(buildId, projectPath, buildType, socket) {
        return new Promise((resolve, reject) => {
            this.updateBuildStatus(buildId, 'gradle');

            const androidPath = path.join(projectPath, 'android');
            const gradleTask = buildType === 'release' ? 'assembleRelease' : 'assembleDebug';

            if (socket) {
                socket.emit('local-build:output', {
                    buildId,
                    phase: 'gradle',
                    message: `Running Gradle ${gradleTask}...`
                });
            }

            const env = {
                ...process.env,
                ANDROID_HOME: this.androidHome,
                JAVA_HOME: this.javaHome,
                PATH: `${this.javaHome}/bin:${this.androidHome}/cmdline-tools/latest/bin:${this.androidHome}/platform-tools:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
            };

            const gradleProcess = exec(
                `./gradlew ${gradleTask} --no-daemon`,
                { cwd: androidPath, env, maxBuffer: 50 * 1024 * 1024 }
            );

            let errorOutput = '';

            gradleProcess.stdout.on('data', (data) => {
                const message = data.toString();
                this.appendOutput(buildId, message);

                if (socket) {
                    socket.emit('local-build:output', {
                        buildId,
                        phase: 'gradle',
                        message
                    });
                }
            });

            gradleProcess.stderr.on('data', (data) => {
                const message = data.toString();
                errorOutput += message;
                this.appendOutput(buildId, message);

                // Gradle uses stderr for progress info too
                if (socket) {
                    socket.emit('local-build:output', {
                        buildId,
                        phase: 'gradle',
                        message
                    });
                }
            });

            gradleProcess.on('close', (code) => {
                if (code === 0) {
                    logger.info('Gradle build completed', { buildId, gradleTask });
                    resolve();
                } else {
                    reject(new Error(`Gradle build failed with code ${code}: ${errorOutput.slice(-500)}`));
                }
            });

            gradleProcess.on('error', (error) => {
                reject(new Error(`Gradle process error: ${error.message}`));
            });

            // Store process reference for cancellation
            const buildData = this.activeBuilds.get(buildId);
            if (buildData) {
                buildData.process = gradleProcess;
                this.activeBuilds.set(buildId, buildData);
            }
        });
    }

    /**
     * Find the generated APK file
     */
    async findApk(projectPath, buildType) {
        const apkDir = buildType === 'release'
            ? path.join(projectPath, 'android/app/build/outputs/apk/release')
            : path.join(projectPath, 'android/app/build/outputs/apk/debug');

        try {
            const files = await fs.readdir(apkDir);
            const apkFile = files.find(f => f.endsWith('.apk'));

            if (apkFile) {
                return path.join(apkDir, apkFile);
            }
        } catch (error) {
            logger.warn('Could not find APK in expected location', { apkDir, error: error.message });
        }

        // Try alternative locations
        const altPaths = [
            path.join(projectPath, 'android/app/build/outputs/apk'),
            path.join(projectPath, 'android/build/outputs/apk')
        ];

        for (const altPath of altPaths) {
            try {
                const files = await fs.readdir(altPath, { recursive: true });
                const apkFile = files.find(f => f.endsWith('.apk'));
                if (apkFile) {
                    return path.join(altPath, apkFile);
                }
            } catch (e) {
                // Continue searching
            }
        }

        throw new Error('APK file not found after build');
    }

    /**
     * Get build status
     */
    getBuildStatus(buildId) {
        const buildData = this.activeBuilds.get(buildId);

        if (!buildData) {
            return null;
        }

        return {
            id: buildData.id,
            status: buildData.status,
            projectPath: buildData.projectPath,
            buildType: buildData.buildType,
            startedAt: buildData.startedAt,
            completedAt: buildData.completedAt,
            apkPath: buildData.apkPath,
            error: buildData.error,
            outputLines: buildData.output?.length || 0
        };
    }

    /**
     * Get all active builds
     */
    listBuilds() {
        const builds = [];
        for (const [buildId, buildData] of this.activeBuilds) {
            builds.push(this.getBuildStatus(buildId));
        }
        return builds;
    }

    /**
     * Cancel a running build
     */
    cancelBuild(buildId) {
        const buildData = this.activeBuilds.get(buildId);

        if (!buildData) {
            return false;
        }

        if (buildData.process) {
            buildData.process.kill('SIGTERM');
        }

        buildData.status = 'cancelled';
        buildData.completedAt = new Date().toISOString();
        this.activeBuilds.set(buildId, buildData);

        logger.info('Build cancelled', { buildId });
        return true;
    }

    /**
     * Get APK file path for download
     */
    getApkPath(buildId) {
        const buildData = this.activeBuilds.get(buildId);

        if (!buildData || buildData.status !== 'completed') {
            return null;
        }

        return buildData.apkPath;
    }

    /**
     * Update build status
     */
    updateBuildStatus(buildId, status) {
        const buildData = this.activeBuilds.get(buildId);
        if (buildData) {
            buildData.status = status;
            this.activeBuilds.set(buildId, buildData);
        }
    }

    /**
     * Append output to build log
     */
    appendOutput(buildId, message) {
        const buildData = this.activeBuilds.get(buildId);
        if (buildData && buildData.output) {
            buildData.output.push(message);
            // Keep last 1000 lines to avoid memory issues
            if (buildData.output.length > 1000) {
                buildData.output = buildData.output.slice(-1000);
            }
            this.activeBuilds.set(buildId, buildData);
        }
    }
}

module.exports = new LocalBuildService();
