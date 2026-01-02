const express = require('express');
const router = express.Router();
const ProjectService = require('../services/ProjectService');
const ProjectJobService = require('../services/ProjectJobService');
const logger = require('../utils/logger');

// POST /api/projects - Create project asynchronously
router.post('/', async (req, res, next) => {
  try {
    const { projectName, template, async = true } = req.body;

    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Use async job creation to avoid Cloudflare 504 timeout
    if (async) {
      const io = req.app.get('io'); // Get Socket.io instance
      const jobInfo = await ProjectJobService.startProjectCreation(projectName, template, io);
      return res.status(202).json(jobInfo); // 202 Accepted
    } else {
      // Legacy sync mode (for backward compatibility, not recommended)
      const project = await ProjectService.createProject(projectName, template);
      return res.status(201).json(project);
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/status/:jobId - Get job status for polling
router.get('/status/:jobId', async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const status = ProjectJobService.getJobStatus(jobId);
    res.json(status);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const projects = await ProjectService.listProjects();
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

router.get('/:projectName', async (req, res, next) => {
  try {
    const { projectName } = req.params;
    const project = await ProjectService.getProjectInfo(projectName);
    res.json(project);
  } catch (error) {
    next(error);
  }
});

router.delete('/:projectName', async (req, res, next) => {
  try {
    const { projectName } = req.params;
    const result = await ProjectService.deleteProject(projectName);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
