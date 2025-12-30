require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  AUTH_TOKEN: process.env.AUTH_TOKEN,
  PROJECTS_BASE_PATH: process.env.PROJECTS_BASE_PATH || '/data/data/com.termux/files/home/app-builder-projects',
  NODE_ENV: process.env.NODE_ENV || 'development',

  ALLOWED_COMMANDS: [
    'npx create-expo-app',
    'claude code',
    'eas build',
    'git init',
    'git add',
    'git commit',
    'npm install'
  ],

  CORS_OPTIONS: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    credentials: true
  }
};
