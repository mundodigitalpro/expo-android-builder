# Expo Android Builder

> Production-ready Android development environment for building and deploying Expo applications directly from your Android device using Termux.

**Forked from**: [expo-app-builder-workspace](https://github.com/mundodigitalpro/expo-app-builder-workspace)

## Overview

Expo Android Builder is a specialized mobile development environment optimized for Android app development on Termux. This project extends the original Expo App Builder Workspace with enhanced features, optimizations, and a focus on production-ready Android application deployment.

### Key Features

- **Project Management**: Create, list, and delete Expo projects from your mobile device
- **Claude Code Integration**: Chat interface to interact with Claude Code CLI for assisted development
- **EAS Build Support**: Build and deploy Android/iOS apps using Expo Application Services
- **Real-time Updates**: WebSocket-based live updates for build status and Claude responses
- **Auto-start System**: One-command startup for both backend and frontend services
- **Offline Detection**: Intelligent server health checks with user-friendly recovery UI

## Architecture

This project uses a hybrid architecture with two main components:

### Frontend (`/app`)
- **Technology**: React Native with Expo
- **Navigation**: React Navigation (Stack Navigator)
- **State Management**: Local component state with AsyncStorage for persistence
- **API Client**: Axios with bearer token authentication
- **Real-time**: Socket.io client for WebSocket connections

### Backend (`/server`)
- **Technology**: Node.js with Express and Socket.io
- **Services**: Project management, Claude Code CLI execution, EAS builds
- **Security**: Bearer token authentication, command whitelisting, path sanitization
- **Execution**: Safe command execution using `child_process.spawn()`

### Communication Flow

```
React Native App (Expo)
    ↓ HTTP REST API (port 3001)
    ↓ Authorization: Bearer token
Node.js Server (Express + Socket.io)
    ↓ child_process.spawn()
CLI Tools (Expo CLI, Claude Code, EAS CLI)
```

## Quick Start

### Prerequisites

- Android device with Termux installed
- Node.js 25.2.1 or higher
- Expo CLI installed globally: `npm install -g expo-cli`

### Installation

1. **Clone the repository**:
```bash
cd ~
git clone https://github.com/mundodigitalpro/expo-android-builder.git
cd expo-android-builder
```

2. **Install dependencies**:
```bash
# Server dependencies
cd server
npm install

# App dependencies
cd ../app
npm install
```

3. **Configure environment**:
```bash
# Server configuration
cd ../server
cp .env.example .env
# Edit .env if needed (default values work for Termux)
```

4. **Start the application**:
```bash
cd server
./start-all-services.sh
```

This will:
- Start the backend server on port 3001
- Wait for server to be ready (automatic health check)
- Start the Expo development server
- Display a QR code to scan with Expo Go

5. **Open the app**:
- Install Expo Go on your Android device from Google Play
- Scan the QR code displayed in the terminal
- The app will automatically connect to the backend server

## Usage

### Creating a Project

1. Tap the **+** button on the home screen
2. Enter a project name (alphanumeric, hyphens, underscores only)
3. Select a template (default: blank)
4. Wait ~73 seconds for the project to be created
5. The new project will appear in the list

### Using Claude Code

1. Navigate to **Claude Code** from the menu
2. Start a new session or continue an existing one
3. Type your questions or requests
4. Claude will respond in real-time via WebSocket
5. You can cancel ongoing operations if needed

### Building with EAS

1. Navigate to **Build Status** from the menu
2. Select a project to build
3. Choose platform (Android/iOS)
4. Monitor build progress in real-time
5. Download APK when build completes

### Server Configuration

Access **Settings** to configure:
- Server URL (default: http://localhost:3001)
- Authentication token
- Test server connectivity with health check

## Project Structure

```
expo-android-builder/
├── app/                      # React Native application
│   ├── screens/              # App screens (Home, Settings, etc.)
│   ├── services/             # API client and utilities
│   ├── utils/                # Validators and helpers
│   └── App.js                # Root component with navigation
├── server/                   # Node.js backend
│   ├── src/
│   │   ├── services/         # Business logic (ProjectService, ClaudeService, etc.)
│   │   ├── middleware/       # Auth, error handling
│   │   ├── utils/            # Executor, validator, logger
│   │   └── config/           # Configuration constants
│   ├── server.js             # Express + Socket.io entry point
│   ├── start-all-services.sh # Unified startup script
│   └── stop-all-services.sh  # Cleanup script
├── docs/                     # Documentation
│   ├── EXPO_APP_BUILDER_PLAN.md
│   ├── GUIA_DESARROLLADOR.md
│   └── REPORTE_PRUEBAS.md
├── builder-projects/         # Created Expo projects (not versioned)
├── CLAUDE.md                 # Instructions for Claude Code
└── README.md                 # This file
```

## API Endpoints

### Public
- `GET /health` - Server health check

### Protected (require Bearer token)
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/:name` - Get project details
- `DELETE /api/projects/:name` - Delete project

### WebSocket Events
- `claude:message` - Send message to Claude Code
- `claude:response` - Receive Claude response
- `claude:cancel` - Cancel ongoing operation
- `build:status` - Build progress updates

## Configuration

### Server (.env)
```bash
PORT=3001
AUTH_TOKEN=expo-builder-token-2024-secure
PROJECTS_BASE_PATH=/data/data/com.termux/files/home/app-builder-projects
NODE_ENV=development
```

### App (AsyncStorage)
- `server_url`: http://localhost:3001
- `auth_token`: expo-builder-token-2024-secure

These are automatically initialized on first launch.

## Security

- **Command Whitelisting**: Only approved CLI commands can be executed
- **Path Sanitization**: Prevents directory traversal attacks
- **Bearer Token Auth**: All API endpoints require valid token
- **Restricted Operations**: Projects confined to designated directory
- **Input Validation**: Strict validation on project names and parameters

## Development Phases

- ✅ **Phase 1**: Basic Setup (Server, App, Project CRUD, Auth)
- ✅ **Phase 2**: Claude Code Integration (CLI execution, WebSocket streaming)
- ✅ **Phase 3**: EAS Build Integration (Build management, APK downloads)
- ⏳ **Phase 4**: UI Refinement (Dark mode, animations, enhanced design)
- 📋 **Phase 5**: Testing & Polish (Test suite, docs, optimization)

## Troubleshooting

### Server Not Responding

The app will automatically detect if the server is offline and display instructions:

1. Tap "📋 Copiar Comando" to copy the startup command
2. Tap "🔧 Abrir Termux" to switch to Termux
3. Paste and run the command
4. Return to app and tap "🔄 Reintentar Conexión"

Or manually:
```bash
cd ~/expo-android-builder/server
./start-all-services.sh
```

### Port Already in Use
```bash
cd ~/expo-android-builder/server
./stop-all-services.sh
./start-all-services.sh
```

### Can't Press 'a' for Android

This is normal in Termux (ADB not available). Use the QR code instead:
- Scan the QR code with Expo Go app
- This is the recommended method

### App Can't Connect
1. Verify server is running: `curl http://localhost:3001/health`
2. Check Settings screen has correct server URL
3. Verify auth token matches between app and server
4. Restart services if needed

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly on Termux/Android
5. Submit a pull request

## License

[Add your license here]

## Acknowledgments

- Built with [Expo](https://expo.dev/)
- Powered by [Claude Code](https://claude.ai/code)
- Runs on [Termux](https://termux.dev/)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Made with ❤️ for mobile developers on Android**
