# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Expo Android Builder is a production-ready mobile development system running on Termux/Android, forked from [expo-app-builder-workspace](https://github.com/mundodigitalpro/expo-app-builder-workspace). It consists of two main components that work together:

1. **React Native App** (`/app`): Mobile UI for creating and managing Expo projects
2. **Node.js Server** (`/server`): Backend API that executes CLI commands and manages projects

This is a **hybrid architecture** where the React Native app communicates with a local Node.js server running on the same device, which then executes Expo CLI commands, Claude Code commands, and EAS builds.

## Development Environment

**CRITICAL**: This project runs on **Termux on Android**, not a standard development machine. All paths, commands, and configurations are specific to this environment.

- Working directory: `/data/data/com.termux/files/home/expo-android-builder/`
- Projects are created in: `/data/data/com.termux/files/home/app-builder-projects/`
- Node.js version: 25.2.1
- Git repository: https://github.com/mundodigitalpro/expo-android-builder

## Common Commands

### 🚀 Quick Start (Recommended - All-in-One)
```bash
cd /data/data/com.termux/files/home/expo-android-builder/server
./start-all-services.sh
```

This script:
- Starts the backend server in background
- Waits for server to be ready (health check)
- Starts the Expo dev server
- Automatically stops backend when Expo closes
- Shows QR code to scan with Expo Go

**Important:** After Expo starts, scan the QR code with Expo Go app. Pressing 'a' requires ADB which may not be available in Termux.

### Stop All Services
```bash
# Option 1: Ctrl+C in the terminal where Expo is running (stops everything)

# Option 2: Use the stop script
cd /data/data/com.termux/files/home/expo-android-builder/server
./stop-all-services.sh
```

### Start Backend Server Only (Advanced)
```bash
cd /data/data/com.termux/files/home/expo-android-builder/server
npm start
# Or: ./start-server.sh
```

The server runs on port 3001.

### Start React Native App Only (Advanced)
```bash
cd /data/data/com.termux/files/home/expo-android-builder/app
npm start
```

Scan QR code with Expo Go (recommended) or press `a` if ADB is available.

### Install Dependencies
```bash
# Server dependencies
cd /data/data/com.termux/files/home/expo-android-builder/server
npm install

# App dependencies
cd /data/data/com.termux/files/home/expo-android-builder/app
npm install
```

### Health Check
```bash
curl http://localhost:3001/health
```

## Architecture

### Communication Flow

```
React Native App (Expo)
    ↓ HTTP REST API (port 3001)
    ↓ Authorization: Bearer token
Node.js Server (Express + Socket.io)
    ↓ child_process.spawn()
CLI Tools (Expo CLI, Git, Claude Code, EAS CLI)
```

### Backend Architecture (`/server`)

**Entry Point**: `server.js` - Express server with Socket.io for WebSocket

**Core Services**:
- `ProjectService.js`: CRUD operations for Expo projects
  - Creates projects using `npx create-expo-app`
  - Initializes git repositories
  - Stores metadata in `.expo-builder-meta.json`

**Key Utilities**:
- `executor.js`: Safe command execution with whitelist validation
- `validator.js`: Input validation and path sanitization (prevents path traversal)
- `logger.js`: Structured JSON logging

**Middleware**:
- `auth.js`: Bearer token authentication (token from .env)
- `errorHandler.js`: Centralized error handling

**Security Model**:
- Whitelisted commands only (defined in executor.js)
- Path sanitization to prevent directory traversal
- All project operations restricted to `PROJECTS_BASE_PATH`
- Bearer token authentication required for all `/api/*` endpoints (except `/health`)

### Frontend Architecture (`/app`)

**Navigation**: React Navigation Stack Navigator (single stack)

**App Initialization** (`App.js`):
- **Health Check Automático**: Verifica servidor al iniciar (3 reintentos con 2s entre cada uno)
- **Estados de Inicio**:
  - `Inicializando...` - Cargando configuración
  - `Verificando servidor...` - Health check en progreso
  - `Servidor No Disponible` - Muestra ServerUnavailableScreen
  - `Normal` - Navega a HomeScreen
- **Configuración AsyncStorage**: Token y URL del servidor

**Screens**:
- `HomeScreen.js`: Lists all projects with pull-to-refresh
  - Auto-refreshes when focused (navigation listener)
  - FAB button to create new project
- `NewProjectScreen.js`: Form to create new Expo project
  - Validates project name (alphanumeric, hyphens, underscores only)
  - Shows loading spinner during creation (~73 seconds)
- `SettingsScreen.js`: Configure server URL and auth token
  - Default server: `http://localhost:3001`
  - Default token: `expo-builder-token-2024-secure`
  - Health check button with visual status indicator
- `ClaudeCodeScreen.js`: Chat interface with Claude Code CLI
  - Real-time streaming via WebSocket
  - Session management
- `BuildStatusScreen.js`: EAS Build management
  - Start builds (Android/iOS)
  - Monitor build progress
  - Download APKs

**Services Layer**:
- `api.js`: Axios instance with interceptors
  - Request interceptor: Adds Bearer token from AsyncStorage
  - Response interceptor: Logs errors
  - 60-second timeout
  - Base URL: `http://localhost:3001/api`

**Storage**:
- `storage.js`: AsyncStorage wrapper for auth token and server URL
- No global state management (Redux/Context) - using local component state
- Server is the source of truth for project data

**Components**:
- `ProjectCard.js`: Displays project info in list
- `LoadingSpinner.js`: Reusable loading indicator
- `ServerUnavailableScreen.js`: **⭐ NEW** - Shown when backend is offline
  - Displays clear instructions to start services
  - Copy command button (copies to clipboard)
  - Open Termux button (via `termux://` URL scheme)
  - Retry connection button
  - Friendly UX with icons and styled UI

### API Endpoints

**Public**:
- `GET /health` - Server health check (no auth required)

**Protected** (require `Authorization: Bearer <token>` header):
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
  - Body: `{projectName: string, template: string}`
  - Template defaults to "blank"
  - Returns project metadata with id, path, createdAt
- `GET /api/projects/:name` - Get project details
- `DELETE /api/projects/:name` - Delete project

### Project Metadata

Each created project has a `.expo-builder-meta.json` file:
```json
{
  "id": "uuid-v4",
  "name": "project-name",
  "template": "blank",
  "createdAt": "ISO-8601-timestamp",
  "path": "/full/path/to/project"
}
```

### Configuration

**Server** (`.env`):
```
PORT=3001
AUTH_TOKEN=expo-builder-token-2024-secure
PROJECTS_BASE_PATH=/data/data/com.termux/files/home/app-builder-projects
NODE_ENV=development
```

**App** (stored in AsyncStorage):
- `server_url`: http://localhost:3001
- `auth_token`: expo-builder-token-2024-secure

These are initialized in `App.js` on first launch.

### Claude Code CLI Integration

**Installation**: Claude CLI is installed globally in the Docker container via `@anthropic-ai/claude-code` npm package.

**Authentication**:
- Claude credentials are mounted read-only from the VPS host: `/home/josejordan/.claude:/root/.claude:ro`
- The container uses the same authenticated session as the VPS user
- No additional login required

**Environment Variables**:
- `CLAUDE_CONFIG_DIR=/root/.claude`: Configuration directory inside container
- `CLAUDE_NO_TELEMETRY=1`: Disable telemetry in production

**Verification**:
```bash
# Inside container
docker compose exec expo-builder claude --version
# Should output: Claude Code CLI version

# Test from API
curl -X POST https://builder.josejordan.dev/api/claude/execute \
  -H "Authorization: Bearer expo-builder-vps-2024-secure-token-MTc2NzIwNjIwMwo=" \
  -H "Content-Type: application/json" \
  -d '{"projectPath":"/app-builder-projects/test-app","prompt":"What files are in this project?","socketId":"test-socket"}'
```

### Project Naming Rules

Enforced in both frontend (`utils/validators.js`) and backend (`utils/validator.js`):
- Length: 3-50 characters
- Pattern: `/^[a-zA-Z0-9-_]+$/` (alphanumeric, hyphens, underscores only)
- No spaces or special characters

## Development Phases

**Phase 1** (COMPLETED): Basic Setup
- ✅ Express server with REST API
- ✅ React Native app with navigation
- ✅ Project CRUD operations
- ✅ Authentication
- ✅ **Auto-start system** (added Dec 30)

**Phase 2** (COMPLETED): Claude Code Integration
- ✅ `ClaudeService.js` to execute Claude Code CLI
- ✅ `ClaudeCodeScreen.js` for chat interface
- ✅ WebSocket streaming for real-time Claude responses
- ✅ Session management and cancellation

**Phase 3** (COMPLETED): EAS Build Integration
- ✅ `EASService.js` for build management
- ✅ `BuildStatusScreen.js` for build monitoring
- ✅ APK download functionality
- ✅ Auto-configuration of projects for EAS

**Phase 4** (IN PROGRESS): UI Refinement
- ✅ Auto-start scripts and health check UI
- ⏳ Dark mode
- ⏳ Animations and transitions
- ⏳ Enhanced visual design

**Phase 5** (PLANNED): Testing & Polish
- Testing suite
- Documentation for end users
- Performance optimization

## Key Patterns and Conventions

### Error Handling

**Backend**:
```javascript
try {
  const result = await operation();
  logger.info('Operation successful', { result });
  return result;
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  throw error; // errorHandler middleware catches it
}
```

**Frontend**:
```javascript
try {
  const response = await api.post('/endpoint', data);
  Alert.alert('Success', 'Operation completed');
} catch (error) {
  Alert.alert('Error', error.response?.data?.error || 'Something went wrong');
  console.error('API Error:', error);
}
```

### Async Operations

- Use async/await throughout (not .then/.catch)
- Backend operations use child_process.spawn() for CLI commands
- Frontend uses Axios for HTTP requests
- Project creation takes ~73 seconds (Expo CLI downloads templates)

### State Management

- No global state management library
- Component-level useState for UI state
- AsyncStorage for persistent data (auth, server config)
- Server is single source of truth for projects

### Navigation Pattern

React Navigation Stack Navigator with auto-refresh on focus:
```javascript
// HomeScreen.js example
useEffect(() => {
  const unsubscribe = navigation.addListener('focus', () => {
    fetchProjects(); // Refresh data when screen comes into focus
  });
  return unsubscribe;
}, [navigation]);
```

## Important Files

**Server**:
- `server/server.js` - Entry point, Express + Socket.io setup
- `server/src/services/ProjectService.js` - Project CRUD logic
- `server/src/utils/executor.js` - Safe command execution
- `server/src/config/constants.js` - Configuration constants

**App**:
- `app/App.js` - Root component with navigation setup
- `app/services/api.js` - HTTP client with interceptors
- `app/screens/HomeScreen.js` - Main project list screen
- `app/utils/storage.js` - AsyncStorage wrapper

**Documentation**:
- `docs/EXPO_APP_BUILDER_PLAN.md` - Complete 5-phase implementation plan
- `docs/GUIA_DESARROLLADOR.md` - Comprehensive developer guide (Spanish)
- `docs/REPORTE_PRUEBAS.md` - Testing report for Phase 1
- `docs/INICIO_RAPIDO.md` - Quick start guide
- `app/CLAUDE.md` - App-specific guidance (similar to this file)

## Testing

Manual testing was completed for Phase 1 (see `docs/REPORTE_PRUEBAS.md`):
- Health check: ✅
- Create project: ✅ (73 seconds)
- List projects: ✅
- Delete project: ✅
- File structure verification: ✅

No automated test suite yet (planned for Phase 5).

## Common Issues and Solutions

**VPS Deployment Issues**:
```bash
# Check deployment status
cd /home/josejordan/apps/builder/server
docker compose ps
docker compose logs --tail=50

# If deployment fails
cd /home/josejordan/apps/builder
git status  # Check for conflicts
git pull origin main  # Get latest
./deploy.sh  # Redeploy

# Rollback to previous version
git log --oneline  # Find commit hash
git checkout <commit-hash>
./deploy.sh
```

**Server not responding / App shows "Servidor No Disponible"**:
```bash
# ⭐ RECOMMENDED: Use the unified start script
cd /data/data/com.termux/files/home/expo-android-builder/server
./start-all-services.sh

# This starts both backend and frontend automatically
# Then scan QR code with Expo Go
```

Or from the app:
1. Tap "📋 Copiar Comando" button
2. Tap "🔧 Abrir Termux" button
3. Paste the command in Termux
4. Return to app and tap "🔄 Reintentar Conexión"

**Port 3001 already in use**:
```bash
# Stop all services first
cd /data/data/com.termux/files/home/expo-android-builder/server
./stop-all-services.sh

# Then restart
./start-all-services.sh
```

**Expo shows "SPAWN ADB ENOENT" error**:
- This is normal in Termux (ADB not available)
- **Solution**: Scan the QR code with Expo Go instead of pressing 'a'
- The QR code method is the recommended approach

**App can't connect to server**:
- Open the app - it will auto-detect and show ServerUnavailableScreen
- Follow on-screen instructions to start services
- Verify server is running: `curl http://localhost:3001/health`
- Check AsyncStorage has correct server URL (http://localhost:3001)
- Verify auth token matches between app and server

**Project creation fails**:
- Verify Expo CLI is installed globally: `expo --version`
- Check PROJECTS_BASE_PATH directory exists and is writable
- Check server logs for detailed error: `tail -f server/server.log`

**Services won't stop**:
```bash
# Use the stop script
cd /data/data/com.termux/files/home/expo-android-builder/server
./stop-all-services.sh

# Or manually kill processes
pkill -f "node server"
pkill -f "expo start"
```

## Recent Improvements

### January 2, 2026 - Git-Based Deployment

**VPS Deployment Upgrade**:
- Migrated from manual file copying to git-based deployment
- `/apps/builder` is now a full git repository clone
- Automated deployment with `deploy.sh` script
- Workflow: `develop → git push → git pull → deploy`
- Easy rollback with `git checkout <commit>`
- Better traceability with git commit history

**Deployment Commands**:
```bash
# On VPS (production)
cd /home/josejordan/apps/builder
./deploy.sh  # Pulls code, rebuilds, restarts

# Development workflow
cd /home/josejordan/expo-android-builder
# make changes...
git add . && git commit -m "feat: description"
git push origin main
# Then deploy on VPS
```

### December 30, 2024 - Auto-Start System

**Auto-Start System**:
- Single command starts both backend and frontend: `./start-all-services.sh`
- Automatic health check with retry logic (3 attempts, 2s intervals)
- Friendly UI when server is offline (`ServerUnavailableScreen`)
- Copy-paste workflow for easy startup
- Auto-cleanup when Expo closes

**Benefits**:
- No need to manage multiple terminal sessions
- Clear user guidance when services are down
- Simplified development workflow
- Better error handling and recovery

## Future Enhancements (Phase 4-5)

**UI/UX Improvements**:
- Dark mode implementation
- Smooth animations and transitions
- Enhanced visual design across all screens
- Better onboarding experience

**Testing & Quality**:
- Automated test suite
- End-to-end testing
- Performance optimization
- Comprehensive documentation for end users
