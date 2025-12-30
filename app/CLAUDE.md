# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Expo App Builder is a React Native mobile app for Android running on Termux. It manages Expo projects and integrates with a Node.js backend server for project creation and management. The app is part of a hybrid architecture with a companion backend server.

## Development Environment

This project runs on **Termux on Android**, not a standard development machine. Commands and paths are specific to this environment.

## Common Commands

### Running the App
```bash
cd /data/data/com.termux/files/home/projects/expo-app-builder
npm start
```

### Starting the Backend Server (Required)
The app requires the backend server to be running:
```bash
cd /data/data/com.termux/files/home/expo-app-builder-server
npm start
```

Or use the startup script:
```bash
/data/data/com.termux/files/home/expo-app-builder-server/start-server.sh
```

### Installing Dependencies
```bash
npm install
```

## Architecture

### Client-Server Model
- **Frontend**: This React Native app (expo-app-builder)
- **Backend**: Node.js + Express server (expo-app-builder-server)
- **Communication**: HTTP REST API (port 3001) + WebSocket for future real-time features

### App Structure
```
App.js                          # Root component with Stack navigation
screens/                        # Screen components
  ├── HomeScreen.js            # Project list with pull-to-refresh
  ├── NewProjectScreen.js      # Project creation form
  └── SettingsScreen.js        # Server configuration
components/                     # Reusable UI components
  ├── ProjectCard.js           # Display project info
  └── LoadingSpinner.js        # Loading indicator
services/
  └── api.js                   # Axios HTTP client with interceptors
utils/
  ├── storage.js               # AsyncStorage wrapper for auth/config
  └── validators.js            # Input validation (project names)
```

### Key Patterns

**API Service Layer** (services/api.js):
- Axios instance with base URL and 60s timeout
- Request interceptor adds Bearer token from AsyncStorage
- Response interceptor handles errors uniformly
- All API calls go through `projectsApi` object

**Storage Abstraction** (utils/storage.js):
- Wraps AsyncStorage for auth tokens and server URL
- Default server URL: `http://localhost:3001`
- Default auth token: `expo-builder-token-2024-secure`

**Navigation**:
- React Navigation Stack Navigator
- Screens auto-refresh on focus (HomeScreen uses navigation listener)
- Custom header styling (blue #007AFF theme)

**State Management**:
- Local component state with useState
- No global state management (Redux/Context)
- Server is source of truth for projects

## Backend API Endpoints

The app communicates with these endpoints on the backend server:

- `GET /api/projects` - List all Expo projects
- `POST /api/projects` - Create new project (body: `{projectName, template}`)
- `GET /api/projects/:name` - Get project details
- `DELETE /api/projects/:name` - Delete project
- `GET /health` - Server health check

All requests (except /health) require `Authorization: Bearer {token}` header.

## Configuration

Default configuration is initialized in App.js on first launch:
- **Server URL**: `http://localhost:3001`
- **Auth Token**: `expo-builder-token-2024-secure`

Users can modify these in SettingsScreen.

## Project Naming Rules

Enforced by `validateProjectName()` in utils/validators.js:
- 3-50 characters
- Only alphanumeric, hyphens, and underscores: `/^[a-zA-Z0-9-_]+$/`
- No spaces or special characters

## Future Phases

This is Phase 1 (Basic Setup). Planned features in future phases:
- Chat interface with Claude Code integration
- Real-time streaming responses via WebSocket
- EAS Build integration for APK generation
- Build monitoring and APK downloads

See `/data/data/com.termux/files/home/EXPO_APP_BUILDER_PLAN.md` for complete roadmap.

## Important Notes

- The app expects the backend server to be accessible at localhost:3001
- Server must be started before the app can function properly
- Project creation happens on the backend via Expo CLI commands
- All projects are stored in the backend's configured projects directory
