require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  AUTH_TOKEN: process.env.AUTH_TOKEN,
  PROJECTS_BASE_PATH: process.env.PROJECTS_BASE_PATH || '/data/data/com.termux/files/home/app-builder-projects',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Local build configuration
  ANDROID_HOME: process.env.ANDROID_HOME || '/opt/android-sdk',
  JAVA_HOME: process.env.JAVA_HOME || '/usr/lib/jvm/java-17-openjdk-amd64',
  BUILDS_OUTPUT_PATH: process.env.BUILDS_OUTPUT_PATH || '/app-builder-builds',

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
