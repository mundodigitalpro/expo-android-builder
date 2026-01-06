/**
 * Centralized configuration for the Expo Android Builder app
 * 
 * This file contains all configurable values that users may want to customize.
 * Values are defaults that can be overridden via the Settings screen.
 */

// Default server URL - users should change this in Settings
// For local development: http://localhost:3001
// For production: https://your-server.com
export const DEFAULT_SERVER_URL = 'http://localhost:3001';

// Server presets for the Settings screen
// Users can add their own presets here or via the app
export const SERVER_PRESETS = [
    {
        name: 'Local (Termux)',
        url: 'http://localhost:3001',
    },
    // Add your production server here if needed
    // Example:
    // {
    //   name: 'Production',
    //   url: 'https://your-server.example.com',
    // },
];

// Default authentication token placeholder
// Users MUST configure their own token in Settings
export const DEFAULT_AUTH_TOKEN = '';

// App configuration
export const APP_CONFIG = {
    healthCheckTimeout: 5000, // ms
    healthCheckRetries: 3,
    connectionRetryDelay: 1000, // ms
};

// Export all config as a single object for convenience
export default {
    DEFAULT_SERVER_URL,
    SERVER_PRESETS,
    DEFAULT_AUTH_TOKEN,
    APP_CONFIG,
};
