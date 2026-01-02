const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const { validateProjectName } = require('../utils/validator');
const { PROJECTS_BASE_PATH } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Service to handle async project creation jobs
 * Solves Cloudflare 504 timeout issues by creating projects in background
 */
class ProjectJobService {
  constructor() {
    this.activeJobs = new Map();
    this.completedJobs = new Map(); // Keep completed jobs for 10 minutes
  }

  /**
   * Start async project creation job
   * @param {string} projectName - Name of the project
   * @param {string} template - Expo template (blank, tabs, etc)
   * @param {object} io - Socket.io instance for real-time updates
   * @returns {object} Job info with jobId and status
   */
  async startProjectCreation(projectName, template = 'blank', io = null) {
    try {
      validateProjectName(projectName);

      const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const projectId = uuidv4();
      const projectPath = path.join(PROJECTS_BASE_PATH, projectName);

      // Check if project already exists
      try {
        await fs.access(projectPath);
        throw new Error(`Project ${projectName} already exists`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      logger.info('Starting async project creation job', {
        jobId,
        projectName,
        template,
        projectPath
      });

      const jobData = {
        id: jobId,
        projectId,
        projectName,
        template,
        projectPath,
        status: 'starting',
        progress: 0,
        phase: 'initializing',
        startedAt: new Date().toISOString(),
        output: [],
        error: null,
        project: null
      };

      this.activeJobs.set(jobId, jobData);

      // Emit initial status via Socket.io
      if (io) {
        io.emit('project-job:started', {
          jobId,
          projectName,
          status: 'starting'
        });
      }

      // Run creation in background (don't await)
      this.createProjectAsync(jobId, projectName, template, projectId, projectPath, io)
        .catch(error => {
          logger.error('Background project creation failed', {
            jobId,
            error: error.message
          });
        });

      // Return immediately
      return {
        jobId,
        projectName,
        status: 'starting',
        message: 'Project creation started in background'
      };

    } catch (error) {
      logger.error('Failed to start project creation job', {
        projectName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create project asynchronously with progress updates
   * @private
   */
  async createProjectAsync(jobId, projectName, template, projectId, projectPath, io) {
    try {
      // Phase 1: Create Expo project (60-70% of time)
      await this.runCreateExpoApp(jobId, projectName, template, io);

      // Phase 2: Initialize git (5%)
      await this.runGitInit(jobId, projectPath, io);

      // Phase 3: Configure app.json for EAS (10%)
      await this.configureAppJson(jobId, projectPath, projectName, io);

      // Phase 4: Create eas.json (10%)
      await this.createEASConfig(jobId, projectPath, io);

      // Phase 5: Save metadata (5%)
      const metadata = await this.saveMetadata(jobId, projectId, projectName, template, projectPath, io);

      // Job completed
      const jobData = this.activeJobs.get(jobId);
      if (jobData) {
        jobData.status = 'completed';
        jobData.progress = 100;
        jobData.phase = 'completed';
        jobData.project = metadata;
        jobData.completedAt = new Date().toISOString();
        this.activeJobs.set(jobId, jobData);

        // Move to completed jobs
        this.completedJobs.set(jobId, jobData);
        setTimeout(() => this.completedJobs.delete(jobId), 10 * 60 * 1000); // 10 min
      }

      logger.info('Project creation completed', { jobId, projectName });

      if (io) {
        io.emit('project-job:complete', {
          jobId,
          status: 'completed',
          project: metadata
        });
      }

    } catch (error) {
      const jobData = this.activeJobs.get(jobId);
      if (jobData) {
        jobData.status = 'failed';
        jobData.error = error.message;
        jobData.completedAt = new Date().toISOString();
        this.activeJobs.set(jobId, jobData);

        // Move to completed jobs
        this.completedJobs.set(jobId, jobData);
        setTimeout(() => this.completedJobs.delete(jobId), 10 * 60 * 1000);
      }

      logger.error('Project creation failed', { jobId, error: error.message });

      if (io) {
        io.emit('project-job:error', {
          jobId,
          status: 'failed',
          error: error.message
        });
      }
    }
  }

  /**
   * Run npx create-expo-app
   */
  async runCreateExpoApp(jobId, projectName, template, io) {
    return new Promise((resolve, reject) => {
      this.updateJobStatus(jobId, 'creating', 10, 'Creating Expo project...');

      if (io) {
        io.emit('project-job:output', {
          jobId,
          phase: 'creating',
          message: `Running: npx create-expo-app ${projectName} --template ${template}`
        });
      }

      const createProcess = spawn('npx', ['create-expo-app', projectName, '--template', template], {
        cwd: PROJECTS_BASE_PATH,
        shell: true
      });

      let output = '';
      let errorOutput = '';

      createProcess.stdout.on('data', (data) => {
        const message = data.toString();
        output += message;
        this.appendJobOutput(jobId, message);

        // Update progress based on output
        if (message.includes('Installing dependencies')) {
          this.updateJobStatus(jobId, 'creating', 40, 'Installing dependencies...');
        } else if (message.includes('Success')) {
          this.updateJobStatus(jobId, 'creating', 60, 'Expo project created');
        }

        if (io) {
          io.emit('project-job:output', {
            jobId,
            phase: 'creating',
            message
          });
        }
      });

      createProcess.stderr.on('data', (data) => {
        const message = data.toString();
        errorOutput += message;
        this.appendJobOutput(jobId, `[stderr] ${message}`);
      });

      createProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('create-expo-app completed', { jobId });
          resolve();
        } else {
          const error = new Error(`create-expo-app failed with code ${code}: ${errorOutput || output}`);
          logger.error('create-expo-app failed', { jobId, code, error: error.message });
          reject(error);
        }
      });

      createProcess.on('error', (error) => {
        logger.error('create-expo-app process error', { jobId, error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Initialize git repository
   */
  async runGitInit(jobId, projectPath, io) {
    return new Promise((resolve, reject) => {
      this.updateJobStatus(jobId, 'git-init', 65, 'Initializing git repository...');

      if (io) {
        io.emit('project-job:output', {
          jobId,
          phase: 'git-init',
          message: 'Running: git init'
        });
      }

      const gitProcess = spawn('git', ['init'], {
        cwd: projectPath,
        shell: true
      });

      gitProcess.on('close', (code) => {
        if (code === 0) {
          logger.info('git init completed', { jobId });
          resolve();
        } else {
          logger.warn('git init failed (non-critical)', { jobId, code });
          resolve(); // Don't fail the whole job
        }
      });

      gitProcess.on('error', (error) => {
        logger.warn('git init error (non-critical)', { jobId, error: error.message });
        resolve(); // Don't fail the whole job
      });
    });
  }

  /**
   * Configure app.json for EAS builds
   */
  async configureAppJson(jobId, projectPath, projectName, io) {
    try {
      this.updateJobStatus(jobId, 'config', 75, 'Configuring app.json...');

      if (io) {
        io.emit('project-job:output', {
          jobId,
          phase: 'config',
          message: 'Configuring app.json for EAS builds'
        });
      }

      const appJsonPath = path.join(projectPath, 'app.json');
      const appJsonContent = await fs.readFile(appJsonPath, 'utf-8');
      const appJson = JSON.parse(appJsonContent);

      const packageName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '');

      appJson.expo = {
        ...appJson.expo,
        owner: 'josejordandev',
        android: {
          ...appJson.expo.android,
          package: `com.josejordandev.${packageName}`
        },
        ios: {
          ...appJson.expo.ios,
          bundleIdentifier: `com.josejordandev.${packageName}`
        }
      };

      await fs.writeFile(appJsonPath, JSON.stringify(appJson, null, 2));
      logger.info('app.json configured', { jobId });

    } catch (error) {
      logger.warn('Failed to configure app.json (non-critical)', { jobId, error: error.message });
      // Don't throw - project is still usable
    }
  }

  /**
   * Create eas.json configuration
   */
  async createEASConfig(jobId, projectPath, io) {
    try {
      this.updateJobStatus(jobId, 'eas-config', 85, 'Creating EAS configuration...');

      if (io) {
        io.emit('project-job:output', {
          jobId,
          phase: 'eas-config',
          message: 'Creating eas.json'
        });
      }

      const easJsonPath = path.join(projectPath, 'eas.json');

      const easConfig = {
        cli: {
          version: ">= 7.0.0",
          appVersionSource: "remote"
        },
        build: {
          development: {
            developmentClient: true,
            distribution: "internal",
            android: {
              credentialsSource: "remote"
            }
          },
          preview: {
            distribution: "internal",
            android: {
              buildType: "apk",
              credentialsSource: "remote",
              withoutCredentials: true
            }
          },
          production: {
            android: {
              buildType: "app-bundle",
              credentialsSource: "remote"
            }
          }
        },
        submit: {
          production: {}
        }
      };

      await fs.writeFile(easJsonPath, JSON.stringify(easConfig, null, 2));
      logger.info('eas.json created', { jobId });

    } catch (error) {
      logger.warn('Failed to create eas.json (non-critical)', { jobId, error: error.message });
      // Don't throw - project is still usable
    }
  }

  /**
   * Save project metadata
   */
  async saveMetadata(jobId, projectId, projectName, template, projectPath, io) {
    this.updateJobStatus(jobId, 'metadata', 95, 'Saving project metadata...');

    if (io) {
      io.emit('project-job:output', {
        jobId,
        phase: 'metadata',
        message: 'Saving metadata'
      });
    }

    const metadata = {
      id: projectId,
      name: projectName,
      template,
      createdAt: new Date().toISOString(),
      path: projectPath
    };

    await fs.writeFile(
      path.join(projectPath, '.expo-builder-meta.json'),
      JSON.stringify(metadata, null, 2)
    );

    logger.info('Metadata saved', { jobId });
    return metadata;
  }

  /**
   * Update job status and progress
   */
  updateJobStatus(jobId, phase, progress, message) {
    const jobData = this.activeJobs.get(jobId);
    if (jobData) {
      jobData.status = 'in_progress';
      jobData.phase = phase;
      jobData.progress = progress;
      if (message) {
        jobData.output.push(`[${new Date().toISOString()}] ${message}`);
      }
      this.activeJobs.set(jobId, jobData);
    }
  }

  /**
   * Append output to job
   */
  appendJobOutput(jobId, message) {
    const jobData = this.activeJobs.get(jobId);
    if (jobData) {
      jobData.output.push(message);
      this.activeJobs.set(jobId, jobData);
    }
  }

  /**
   * Get job status
   * @param {string} jobId - Job ID
   * @returns {object} Job status
   */
  getJobStatus(jobId) {
    // Check active jobs first
    let job = this.activeJobs.get(jobId);

    // Check completed jobs if not in active
    if (!job) {
      job = this.completedJobs.get(jobId);
    }

    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    // Return job data without full output (too large)
    return {
      id: job.id,
      projectName: job.projectName,
      status: job.status,
      progress: job.progress,
      phase: job.phase,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      project: job.project,
      recentOutput: job.output.slice(-10) // Last 10 lines only
    };
  }

  /**
   * Get all active jobs
   */
  getActiveJobs() {
    return Array.from(this.activeJobs.values()).map(job => ({
      id: job.id,
      projectName: job.projectName,
      status: job.status,
      progress: job.progress,
      phase: job.phase,
      startedAt: job.startedAt
    }));
  }
}

module.exports = new ProjectJobService();
