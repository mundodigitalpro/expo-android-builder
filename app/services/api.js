import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutos para operaciones largas como crear proyectos
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
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
  create: (projectName, template = 'blank') =>
    api.post('/projects', { projectName, template }),
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

export const healthCheck = () => axios.get('http://localhost:3001/health');

export default api;
