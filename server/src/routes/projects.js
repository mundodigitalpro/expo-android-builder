const express = require('express');
const router = express.Router();
const ProjectService = require('../services/ProjectService');
const logger = require('../utils/logger');

router.post('/', async (req, res, next) => {
  try {
    const { projectName, template } = req.body;

    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await ProjectService.createProject(projectName, template);
    res.status(201).json(project);
  } catch (error) {
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
