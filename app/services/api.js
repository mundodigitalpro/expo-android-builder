import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Función para obtener la URL base dinámicamente
const getBaseURL = async () => {
  const serverUrl = await AsyncStorage.getItem('server_url') || 'http://46.62.214.102:3001';
  return `${serverUrl}/api`;
};

const api = axios.create({
  timeout: 180000, // 3 minutos para operaciones largas como crear proyectos
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    // Obtener URL base dinámicamente en cada request
    const baseURL = await getBaseURL();
    config.baseURL = baseURL;

    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      console.error('Network Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export const projectsApi = {
  list: () => api.get('/projects'),
  create: (projectName, template = 'blank', async = true) =>
    api.post('/projects', { projectName, template, async }),
  getJobStatus: (jobId) => api.get(`/projects/status/${jobId}`),
  get: (projectName) => api.get(`/projects/${projectName}`),
  delete: (projectName) => api.delete(`/projects/${projectName}`),
};

export const claudeApi = {
  execute: (projectPath, prompt, socketId) =>
    api.post('/claude/execute', { projectPath, prompt, socketId }),
  cancel: (sessionId) =>
    api.post('/claude/cancel', { sessionId }),
};

export const buildsApi = {
  // EAS Cloud builds
  start: (projectPath, platform, profile, socketId) =>
    api.post('/builds/start', { projectPath, platform, profile, socketId }),
  cancel: (buildId) =>
    api.post('/builds/cancel', { buildId }),
  getStatus: (easBuildId, projectPath) =>
    api.get(`/builds/status/${easBuildId}`, { params: { projectPath } }),
  list: (projectPath, limit = 10) =>
    api.get('/builds/list', { params: { projectPath, limit } }),
  getInfo: (buildId) =>
    api.get(`/builds/info/${buildId}`),
  init: (projectPath) =>
    api.post('/builds/init', { projectPath }),
};

export const localBuildsApi = {
  // Local VPS builds
  start: (projectPath, platform, profile, socketId) =>
    api.post('/local-builds/start', { projectPath, platform, profile, socketId }),
  getStatus: (buildId) =>
    api.get(`/local-builds/status/${buildId}`),
  download: (buildId) =>
    api.get(`/local-builds/download/${buildId}`),
};

export const githubActionsApi = {
  // GitHub Actions builds
  trigger: (projectPath, buildType) =>
    api.post('/github-actions/trigger', { projectPath, buildType }),
  getRuns: ({ limit = 10, branch } = {}) =>
    api.get('/github-actions/runs', { params: { limit, branch } }),
  getArtifacts: (runId) =>
    api.get(`/github-actions/runs/${runId}/artifacts`),
  getStatus: () =>
    api.get('/github-actions/status'),
  buildUserProject: (projectName, buildType) =>
    api.post('/github-actions/build-user-project', { projectName, buildType }),
  prepareProject: (projectName) =>
    api.post('/github-actions/prepare-project', { projectName }),
  cleanupBranch: (branchName, projectName) =>
    api.delete(`/github-actions/cleanup/${branchName}`, { params: { projectName } }),
};

export const healthCheck = async () => {
  const serverUrl = await AsyncStorage.getItem('server_url') || 'http://46.62.214.102:3001';
  return axios.get(`${serverUrl}/health`);
};

export default api;
