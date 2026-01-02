# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Expo Android Builder is a React Native mobile app for Android. It manages Expo projects and integrates with a Node.js backend server for project creation and management. The app is part of a hybrid architecture with a companion backend server.

**Deployment Modes**:
- **Development**: App developed in Termux, backend runs locally (localhost:3001)
- **Production**: App on mobile device, backend on VPS (https://builder.josejordan.dev)

## Development Environment

This app is developed on **Termux on Android**. Commands and paths are specific to this environment.

## Common Commands

### Running the App
```bash
cd ~/expo-android-builder/app
npm start
```

### Starting the Backend Server (Development Mode Only)
For local development, the backend server must be running:
```bash
cd ~/expo-android-builder/server
./start-all-services.sh
```

**Note**: In production mode, the app connects to the VPS backend (https://builder.josejordan.dev) - no local server needed.

### Installing Dependencies
```bash
npm install
```

## Architecture

### Client-Server Model
- **Frontend**: This React Native app (expo-android-builder/app)
- **Backend**: Node.js + Express server
  - Development: localhost:3001 (Termux)
  - Production: https://builder.josejordan.dev (VPS)
- **Communication**: HTTP REST API + WebSocket for real-time features

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

The app supports multiple server environments via SettingsScreen:

**Local (Termux)**:
- URL: `http://localhost:3001`
- Backend on same device

**Production (VPS)**:
- URL: `https://builder.josejordan.dev`
- Backend on remote server

**Custom**:
- User-defined URL

Default auth token: `expo-builder-token-2024-secure`

## Project Naming Rules

Enforced by `validateProjectName()` in utils/validators.js:
- 3-50 characters
- Only alphanumeric, hyphens, and underscores: `/^[a-zA-Z0-9-_]+$/`
- No spaces or special characters

## Project Status

**Completed Phases** (60%):
- ✅ Phase 1: Basic Setup (CRUD projects, API, Auth)
- ✅ Phase 2: Claude Code Integration (Chat, streaming)
- ✅ Phase 3: EAS Build & Local VPS Build (APK generation)

**Pending**:
- Phase 4: UI Refinement (Dark mode, animations)
- Phase 5: Testing & Optimization

See `docs/GUIA_DESARROLLADOR.md` for complete roadmap.

## Important Notes

- App can connect to localhost (development) or VPS (production)
- Select server environment in Settings screen
- Project creation happens on the backend via Expo CLI commands
- All projects are stored in the backend's configured projects directory
