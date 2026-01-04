# Guía para Desarrolladores - Expo App Builder

**Proyecto**: Expo App Builder con Integración Claude Code
**Estado**: Fases 1-3 Completadas ✅ + GitHub Actions Staging ✅ | Fases 4-5 Pendientes
**Última actualización**: 3 de Enero, 2026
**Desarrollado en**: Termux (Android) con Claude Code

---

## 📋 Índice

1. [¿Qué estamos construyendo?](#qué-estamos-construyendo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Lo que ya está hecho (Fase 1)](#lo-que-ya-está-hecho-fase-1)
4. [Lo que queda por hacer (Fases 2-5)](#lo-que-queda-por-hacer-fases-2-5)
5. [Setup del Entorno de Desarrollo](#setup-del-entorno-de-desarrollo)
6. [Estructura del Código](#estructura-del-código)
7. [Cómo continuar el desarrollo](#cómo-continuar-el-desarrollo)
8. [Convenciones y Estándares](#convenciones-y-estándares)
9. [Testing](#testing)
10. [Recursos y Documentación](#recursos-y-documentación)

---

## 🎯 ¿Qué estamos construyendo?

### Visión General

**Expo Android Builder** es una aplicación móvil Android que permite crear y gestionar aplicaciones Expo directamente desde un dispositivo móvil, con integración de Claude Code para asistencia de desarrollo mediante IA y soporte para builds tanto en EAS Cloud como en VPS propio.

### Problema que resuelve

Desarrollar apps móviles tradicionalmente requiere una computadora. Este proyecto permite:
- Crear proyectos Expo desde el móvil
- Usar Claude Code como asistente de desarrollo
- Compilar APKs con EAS Build o en VPS propio
- Desarrollo local en Termux o remoto contra VPS

### Modos de Operación

**Desarrollo Local (Termux)**:
- Backend y Frontend en el mismo dispositivo Android
- URL: http://localhost:3001
- Ideal para desarrollo y testing sin conexión

**Producción (VPS)**:
- Backend en servidor VPS remoto (Hetzner)
- URL: https://builder.josejordan.dev
- Builds nativos en el servidor, sin depender de EAS Cloud

### Caso de uso principal

Un desarrollador en un dispositivo Android puede:
1. Abrir la app Expo App Builder
2. Crear un nuevo proyecto Expo (ej: "mi-app")
3. Pedirle a Claude Code que agregue funcionalidades
4. Construir un APK con EAS Build
5. Instalar y probar la app en el mismo dispositivo

Todo sin necesidad de una computadora.

---

## 🏗️ Arquitectura del Sistema

### Diagrama de Arquitectura

```
┌─────────────────────────────────────────┐
│   REACT NATIVE APP (Frontend)          │
│   Puerto: Expo (8081)                   │
│   --------------------------------      │
│   • HomeScreen (lista proyectos)       │
│   • NewProjectScreen (crear)           │
│   • ClaudeCodeScreen (chat) [Fase 2]   │
│   • BuildStatusScreen (EAS) [Fase 3]   │
│   • SettingsScreen (config)            │
└──────────────┬──────────────────────────┘
               │
               │ HTTP REST + WebSocket
               │ localhost:3001
               │
┌──────────────▼──────────────────────────┐
│   NODE.JS SERVER (Backend)              │
│   Puerto: 3001                          │
│   --------------------------------      │
│   Servicios:                            │
│   • ProjectService ✅                   │
│   • ClaudeService [Fase 2]              │
│   • EASService [Fase 3]                 │
│   • FileService [Fase 2]                │
└──────────────┬──────────────────────────┘
               │
               │ child_process.spawn()
               │
         ┌─────┴─────┬──────────┬──────────┐
         ▼           ▼          ▼          ▼
    ┌────────┐  ┌────────┐ ┌───────┐  ┌──────┐
    │ Expo   │  │ Claude │ │  EAS  │  │ Git  │
    │  CLI   │  │  Code  │ │  CLI  │  │ CLI  │
    └────────┘  └────────┘ └───────┘  └──────┘
         │           │          │          │
         ▼           ▼          ▼          ▼
    ┌──────────────────────────────────────┐
    │  /app-builder-projects/              │
    │  ├── proyecto-1/                     │
    │  ├── proyecto-2/                     │
    │  └── proyecto-3/                     │
    └──────────────────────────────────────┘
```

### Tecnologías Utilizadas

**Frontend (App React Native)**:
- React Native 0.81.5
- Expo SDK 54
- React Navigation 6
- Axios (HTTP client)
- Socket.io-client (WebSocket)
- AsyncStorage (persistencia local)

**Backend (Servidor Node.js)**:
- Node.js (v25.2.1)
- Express 5.2.1
- Socket.io 4.8.3
- dotenv (variables de entorno)
- uuid (generación de IDs)

**CLIs Integrados**:
- Expo CLI (crear proyectos)
- Claude Code CLI (asistente IA)
- EAS CLI (builds)
- Git (control de versiones)

---

## ✅ Lo que ya está hecho (Fases 1-3)

### Resumen de Fases Completadas

**Fase 1**: Setup Básico ✅
**Fase 2**: Integración Claude Code ✅
**Fase 3**: Integración EAS Build & Local VPS Build ✅

---

### Fase 1 - Setup Básico COMPLETADA

### Backend Implementado

**Ubicación**: `/data/data/com.termux/files/home/expo-app-builder-server/`

#### Archivos Core:
- ✅ `server.js` - Entry point con Express + Socket.io
- ✅ `src/config/constants.js` - Configuración centralizada
- ✅ `src/services/ProjectService.js` - Lógica de proyectos
- ✅ `src/utils/executor.js` - Ejecución segura de comandos
- ✅ `src/utils/validator.js` - Validación de inputs
- ✅ `src/utils/logger.js` - Sistema de logs
- ✅ `src/middleware/auth.js` - Autenticación
- ✅ `src/middleware/errorHandler.js` - Manejo de errores
- ✅ `src/routes/projects.js` - Endpoints REST

#### Funcionalidades Backend:
1. ✅ **Servidor Express** funcionando en puerto 3001
2. ✅ **WebSocket** configurado (sin usar aún)
3. ✅ **Autenticación** con Bearer token
4. ✅ **CRUD de Proyectos**:
   - `POST /api/projects` - Crear proyecto
   - `GET /api/projects` - Listar proyectos
   - `GET /api/projects/:name` - Info de proyecto
   - `DELETE /api/projects/:name` - Eliminar proyecto
5. ✅ **Health Check**: `GET /health`
6. ✅ **Validación de seguridad**:
   - Whitelist de comandos
   - Sanitización de paths
   - Validación de nombres
7. ✅ **Sistema de logs** estructurado en JSON

### Frontend Implementado

**Ubicación**: `/data/data/com.termux/files/home/projects/expo-app-builder/`

#### Archivos Core:
- ✅ `App.js` - Root con NavigationContainer
- ✅ `screens/HomeScreen.js` - Lista de proyectos
- ✅ `screens/NewProjectScreen.js` - Crear proyecto
- ✅ `screens/SettingsScreen.js` - Configuración
- ✅ `components/ProjectCard.js` - Card de proyecto
- ✅ `components/LoadingSpinner.js` - Spinner
- ✅ `services/api.js` - Cliente HTTP con interceptors
- ✅ `utils/storage.js` - Wrapper de AsyncStorage
- ✅ `utils/validators.js` - Validaciones de forms

#### Funcionalidades Frontend:
1. ✅ **Navegación** con React Navigation Stack
2. ✅ **HomeScreen**:
   - Lista de proyectos con pull-to-refresh
   - Botón FAB para crear proyecto
   - Botón de settings
   - Estado vacío con mensaje
3. ✅ **NewProjectScreen**:
   - Formulario de creación
   - Validación en tiempo real
   - Loading states
   - Confirmación de éxito
4. ✅ **SettingsScreen**:
   - Configuración de URL del servidor
   - Token de autenticación
   - Verificador de conexión
5. ✅ **Cliente API** con:
   - Interceptors para auth
   - Manejo de errores
   - Timeout configurado

### Testing Completado

✅ **9 tests ejecutados** (ver `REPORTE_PRUEBAS.md`):
- Health check: ✅
- Crear proyecto: ✅ (73s)
- Listar proyectos: ✅
- Eliminar proyecto: ✅
- Verificación de archivos: ✅
- Metadata: ✅
- Todos funcionan correctamente

### Documentación Creada

- ✅ `REPORTE_PRUEBAS.md` - Resultados de testing
- ✅ `EXPO_APP_BUILDER_PLAN.md` - Plan completo
- ✅ `INICIO_RAPIDO.md` - Guía de inicio
- ✅ `README.md` (app y server)
- ✅ `GUIA_DESARROLLADOR.md` (este archivo)

### Backend de Build Local (VPS) - Fase 3 (Backend Completado)
1. ✅ **LocalBuildService.js**:
   - Compilación nativa de Android (`expo prebuild` + `gradle`)
   - Gestión de procesos con `child_process`
   - Streaming de logs via WebSocket
2. ✅ **Infraestructura VPS**:
   - Android SDK y NDK (v27.x) configurados
   - Variables de entorno `ANDROID_HOME` y `JAVA_HOME`
3. ✅ **API Endpoints**:
   - `POST /api/local-builds/start`
   - `GET /api/local-builds/status/:id`
   - `GET /api/local-builds/download/:id`
   
**Nota**: La integración en el Frontend (BuildStatusScreen) está pendiente.

---

### Fase 2 - Integración Claude Code COMPLETADA ✅

**Objetivo**: Permitir interactuar con Claude Code desde la app

**Duración real**: Completada el 29 de Diciembre, 2024

**Funcionalidades implementadas:**

#### Backend:
- ✅ `ClaudeService.js` - Ejecuta Claude Code CLI
- ✅ `routes/claude.js` - Rutas para ejecutar y cancelar Claude
- ✅ WebSocket streaming para output en tiempo real
- ✅ Detección automática de Claude CLI
- ✅ Manejo de sesiones activas

#### Frontend:
- ✅ `ClaudeCodeScreen.js` - Interfaz de chat con Claude
- ✅ `socket.js` - Cliente WebSocket mejorado
- ✅ Estado de conexión ("Conectando...")
- ✅ Mensajes en tiempo real
- ✅ Cancelación de sesiones

#### API Endpoints:
- `POST /api/claude/execute` - Ejecutar Claude Code
- `POST /api/claude/cancel` - Cancelar sesión

#### WebSocket Events:
- `claude:output` - Output de Claude
- `claude:error` - Errores
- `claude:complete` - Sesión completada

---

### Fase 3 - Integración EAS Build & Local VPS Build COMPLETADA ✅

**Objetivo**: Compilar APKs desde la app (EAS Cloud + VPS Local)

**Duración real**: Completada el 2 de Enero, 2026

**Funcionalidades implementadas:**

#### Backend (EAS Cloud + Local VPS):
- ✅ `EASService.js` - Servicio completo para builds con EAS CLI
  - `startBuild()` - Inicia builds (Android/iOS)
  - `listBuilds()` - Lista builds con manejo robusto de errores
  - `getBuildStatus()` - Estado de build específico
  - `cancelBuild()` - Cancela builds activos
  - `initProject()` - Inicializa proyecto EAS automáticamente
  - WebSocket streaming para progreso en tiempo real
  - Fix: `EAS_SKIP_AUTO_FINGERPRINT=1` para compatibilidad Termux
- ✅ `LocalBuildService.js` - Builds locales en VPS sin EAS Cloud
  - `expo prebuild` para generar proyecto nativo
  - `./gradlew assembleDebug` para compilar
  - Soporte para NDK y Java 17
- ✅ `routes/builds.js` - Rutas API completas
- ✅ `routes/localBuilds.js` - Endpoints para proceso local
- ✅ `ProjectService.js` mejorado:
  - Auto-configura `app.json` con `android.package`, `owner`
  - Auto-crea `eas.json` con perfiles de build
  - Nuevos proyectos listos para EAS desde el primer momento

#### Frontend:
- ✅ `BuildStatusScreen.js` - Pantalla de gestión de builds
  - **Selector de tipo de build**: EAS Cloud vs Local VPS
  - Botones visuales con iconos (☁️ Cloud / 🖥️ Local)
  - Botón dinámico de build según tipo seleccionado
  - Lista de builds con estados visuales
  - Banner de progreso en tiempo real
  - Contador de tiempo transcurrido (⏱️ MM:SS)
  - Barra de progreso animada
  - Botón "Configurar EAS" cuando no está vinculado
  - Botón "Download APK" cuando build termina
  - Link a EAS dashboard
  - Filtrado inteligente de mensajes
- ✅ `buildsApi` y `localBuildsApi` en `services/api.js`
- ✅ ProjectCard con botón "🔨 Builds"
- ✅ Navegación configurada

#### API Endpoints:
- `POST /api/builds/start` - Iniciar build
- `POST /api/builds/cancel` - Cancelar build
- `GET /api/builds/status/:easBuildId` - Estado de build
- `GET /api/builds/list` - Listar builds
- `GET /api/builds/info/:buildId` - Info de build activo
- `POST /api/builds/init` - Inicializar proyecto EAS
- `POST /api/local-builds/start` - Iniciar build local
- `GET /api/local-builds/status/:id` - Estado
- `GET /api/local-builds/download/:id` - Descargar APK

#### WebSocket Events:
- `build:output` - Output del proceso
- `build:error` - Errores y mensajes (filtrados inteligentemente)
- `build:queued` - Build encolado
- `build:complete` - Proceso completado

#### Hitos alcanzados:
- ✅ Primera app compilada e instalada (test-claude) - 30 Dic 2024
- ✅ Primer build local exitoso en VPS - 2 Ene 2026
- ✅ Sistema de despliegue basado en Git implementado

---

### Fase 3.1 - GitHub Actions Staging COMPLETADA ✅

**Objetivo**: Compilar proyectos creados por usuarios fuera del repo usando GitHub Actions.

**Funcionalidades implementadas:**

#### Backend:
- ✅ `GitStagingService.js` - Staging con branches temporales y rsync.
- ✅ `GitHubActionsService.js` extendido (dispatch por branch, listar branches).
- ✅ `routes/githubActions.js` - Endpoints para staging, trigger y cleanup.
- ✅ Rate limiting para staging (5 requests / 15 min).
- ✅ Descarga de artifacts via API (stream ZIP).

#### Frontend:
- ✅ `BuildStatusScreen.js` con selector GitHub Actions.
- ✅ Tracking por polling de runs filtrados por branch.
- ✅ Link directo a descarga del artifact desde la app.

#### API Endpoints:
- `POST /api/github-actions/build-user-project`
- `POST /api/github-actions/prepare-project`
- `POST /api/github-actions/trigger-staged`
- `DELETE /api/github-actions/cleanup/:branchName`
- `GET /api/github-actions/temp-branches`
- `GET /api/github-actions/runs`
- `GET /api/github-actions/runs/:runId/artifacts`
- `GET /api/github-actions/runs/:runId/artifacts/latest/download`

#### Requisitos de entorno:
- En Termux se necesita `rsync` para el staging.
- Token `GITHUB_TOKEN` con scopes `repo` y `workflow`.

---

## 🚧 Lo que queda por hacer (Fases 4-5)

### Fase 4: Refinamiento UI/UX 🔄 (SIGUIENTE)

**Duración estimada**: 1-2 semanas

#### Mejoras planificadas:

**UI Components**:
- [ ] Refinar estilos con diseño consistente
- [ ] Agregar animaciones suaves
- [ ] Mejorar feedback visual
- [ ] Estados de loading más elegantes
- [ ] Iconos personalizados

**UX Improvements**:
- [ ] Onboarding para nuevos usuarios
- [ ] Tutorial interactivo
- [ ] Mensajes de error más claros
- [ ] Confirmaciones antes de acciones destructivas
- [ ] Atajos/gestos útiles

**Nuevos componentes**:
- [ ] `components/ProgressBar.js`
- [ ] `components/Toast.js` (notificaciones)
- [ ] `components/EmptyState.js`
- [ ] `components/ErrorBoundary.js`

**Temas**:
- [ ] Soporte para dark mode
- [ ] Tema personalizable
- [ ] Colores accesibles (contraste)

---

### Fase 5: Testing y Optimización ⏳

**Duración estimada**: 1-2 semanas

#### Testing:

**Backend**:
- [ ] Unit tests para servicios
- [ ] Integration tests para API
- [ ] Tests de seguridad
- [ ] Tests de performance

**Frontend**:
- [ ] Component tests (Jest)
- [ ] E2E tests (Detox)
- [ ] Tests de navegación
- [ ] Tests de forms

**Archivos a crear**:
```
server/
├── __tests__/
│   ├── ProjectService.test.js
│   ├── ClaudeService.test.js
│   ├── EASService.test.js
│   └── api.integration.test.js

app/
├── __tests__/
│   ├── HomeScreen.test.js
│   ├── NewProjectScreen.test.js
│   ├── ClaudeCodeScreen.test.js
│   └── navigation.test.js
```

#### Optimización:

**Performance**:
- [ ] Memoización de componentes React
- [ ] Lazy loading de screens
- [ ] Optimización de imágenes
- [ ] Caché de requests API
- [ ] Debounce en inputs

**Backend**:
- [ ] Rate limiting
- [ ] Compresión gzip
- [ ] Query optimization
- [ ] Connection pooling

**Memoria**:
- [ ] Limpieza de proyectos antiguos
- [ ] Límite de proyectos simultáneos
- [ ] Garbage collection optimizada

#### Documentación final:
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Developer guide completa
- [ ] User manual
- [ ] Video tutoriales
- [ ] Deployment guide

---

## 🔧 Setup del Entorno de Desarrollo

### Requisitos Previos

**Sistema**:
- Android con Termux instalado
- Node.js v14+ (idealmente v25+)
- npm o yarn
- 2GB+ espacio libre

**CLIs Globales**:
```bash
npm install -g expo-cli
npm install -g eas-cli
# Claude Code ya debe estar instalado
```

### Instalación Inicial

#### 1. Clonar/Navegar al Proyecto

```bash
cd /data/data/com.termux/files/home
```

#### 2. Setup del Servidor

```bash
cd expo-app-builder-server

# Instalar dependencias
npm install

# Verificar .env
cat .env
# Debe contener:
# PORT=3001
# AUTH_TOKEN=expo-builder-token-2024-secure
# PROJECTS_BASE_PATH=/data/data/com.termux/files/home/app-builder-projects
# NODE_ENV=development

# Iniciar servidor
npm start
# Debe mostrar: 🚀 Server running on http://localhost:3001
```

#### 3. Setup de la App

```bash
cd ../projects/expo-app-builder

# Instalar dependencias
npm install

# Iniciar app
npm start
# Opciones: presiona 'a' (Android), 'w' (web), o escanea QR
```

### Verificar Instalación

```bash
# Test health check
curl http://localhost:3001/health
# Respuesta: {"status":"ok",...}

# Test crear proyecto
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer expo-builder-token-2024-secure" \
  -H "Content-Type: application/json" \
  -d '{"projectName":"test","template":"blank"}'
```

---

## 📁 Estructura del Código

### Backend (`expo-app-builder-server/`)

```
expo-app-builder-server/
├── server.js                      # ⭐ Entry point
├── package.json
├── .env                           # Configuración (NO commitear)
├── src/
│   ├── config/
│   │   └── constants.js          # ⭐ Variables globales
│   ├── routes/                   # Definición de endpoints
│   │   ├── projects.js           # ✅ Rutas de proyectos
│   │   ├── claude.js             # 🚧 Fase 2
│   │   └── build.js              # 🚧 Fase 3
│   ├── services/                 # Lógica de negocio
│   │   ├── ProjectService.js     # ✅ CRUD proyectos
│   │   ├── ClaudeService.js      # 🚧 Fase 2
│   │   ├── EASService.js         # 🚧 Fase 3
│   │   └── FileService.js        # 🚧 Fase 2
│   ├── utils/                    # Utilidades
│   │   ├── executor.js           # ✅ Ejecutar comandos
│   │   ├── validator.js          # ✅ Validaciones
│   │   └── logger.js             # ✅ Logging
│   └── middleware/               # Express middleware
│       ├── auth.js               # ✅ Autenticación
│       └── errorHandler.js       # ✅ Errores
└── __tests__/                    # 🚧 Fase 5
```

### Frontend (`projects/expo-app-builder/`)

```
expo-app-builder/
├── App.js                        # ⭐ Root con navegación
├── package.json
├── app.json                      # Config de Expo
├── screens/                      # Pantallas de la app
│   ├── HomeScreen.js             # ✅ Lista proyectos
│   ├── NewProjectScreen.js       # ✅ Crear proyecto
│   ├── SettingsScreen.js         # ✅ Configuración
│   ├── ClaudeCodeScreen.js       # 🚧 Fase 2
│   ├── BuildStatusScreen.js      # 🚧 Fase 3
│   └── ProjectDetailScreen.js    # 🚧 Fase 3
├── components/                   # Componentes reutilizables
│   ├── ProjectCard.js            # ✅ Card de proyecto
│   ├── LoadingSpinner.js         # ✅ Spinner
│   ├── ChatMessage.js            # 🚧 Fase 2
│   ├── CodeBlock.js              # 🚧 Fase 2
│   └── BuildLog.js               # 🚧 Fase 3
├── services/                     # Servicios de la app
│   ├── api.js                    # ✅ Cliente HTTP
│   └── socket.js                 # 🚧 Fase 2
├── utils/                        # Utilidades
│   ├── storage.js                # ✅ AsyncStorage
│   └── validators.js             # ✅ Validaciones
├── assets/                       # Imágenes, iconos
└── __tests__/                    # 🚧 Fase 5
```

### Leyenda:
- ⭐ Archivo crítico
- ✅ Completado (Fase 1)
- 🚧 Por hacer (Fases 2-5)

---

## 🚀 Cómo continuar el desarrollo

### Para Implementar Fase 2 (Claude Code)

#### Paso 1: Backend - ClaudeService

Crear `/expo-app-builder-server/src/services/ClaudeService.js`:

```javascript
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../utils/logger');

class ClaudeService {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> process
  }

  async executeClaudeCommand(projectPath, prompt, socket) {
    try {
      logger.info('Executing Claude Code', { projectPath, prompt });

      // Comando: claude code --prompt "..." /path/to/project
      const claudeProcess = spawn('claude', ['code', '--prompt', prompt], {
        cwd: projectPath,
        shell: true
      });

      const sessionId = Date.now().toString();
      this.activeSessions.set(sessionId, claudeProcess);

      // Stream stdout a través de WebSocket
      claudeProcess.stdout.on('data', (data) => {
        const output = data.toString();
        socket.emit('claude:output', {
          sessionId,
          type: 'stdout',
          content: output
        });
      });

      // Stream stderr
      claudeProcess.stderr.on('data', (data) => {
        const output = data.toString();
        socket.emit('claude:output', {
          sessionId,
          type: 'stderr',
          content: output
        });
      });

      // Cuando termina
      claudeProcess.on('close', (code) => {
        socket.emit('claude:complete', { sessionId, code });
        this.activeSessions.delete(sessionId);
        logger.info('Claude Code completed', { sessionId, code });
      });

      return { sessionId };

    } catch (error) {
      logger.error('Failed to execute Claude Code', { error: error.message });
      throw error;
    }
  }

  stopSession(sessionId) {
    const process = this.activeSessions.get(sessionId);
    if (process) {
      process.kill();
      this.activeSessions.delete(sessionId);
      logger.info('Claude session stopped', { sessionId });
    }
  }
}

module.exports = new ClaudeService();
```

#### Paso 2: Backend - Rutas de Claude

Crear `/expo-app-builder-server/src/routes/claude.js`:

```javascript
const express = require('express');
const router = express.Router();
const ClaudeService = require('../services/ClaudeService');

router.post('/execute', async (req, res, next) => {
  try {
    const { projectPath, prompt } = req.body;

    if (!projectPath || !prompt) {
      return res.status(400).json({
        error: 'projectPath and prompt are required'
      });
    }

    // Socket.io debe estar disponible en req.app.get('io')
    const io = req.app.get('io');
    const socket = io.sockets.sockets.get(req.body.socketId);

    const result = await ClaudeService.executeClaudeCommand(
      projectPath,
      prompt,
      socket
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

#### Paso 3: Backend - Registrar rutas

En `/expo-app-builder-server/server.js`, agregar:

```javascript
const claudeRouter = require('./src/routes/claude');

// ... después de las otras rutas
app.use('/api/claude', authMiddleware, claudeRouter);

// Y hacer io accesible:
app.set('io', io);
```

#### Paso 4: Frontend - Socket Service

Crear `/projects/expo-app-builder/services/socket.js`:

```javascript
import io from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect(url = 'http://localhost:3001') {
    if (!this.socket) {
      this.socket = io(url, {
        transports: ['websocket'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('Socket disconnected');
      });
    }
    return this.socket;
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
      this.listeners.set(event, callback);
    }
  }

  off(event) {
    if (this.socket && this.listeners.has(event)) {
      const callback = this.listeners.get(event);
      this.socket.off(event, callback);
      this.listeners.delete(event);
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }

  getSocketId() {
    return this.socket?.id;
  }
}

export default new SocketService();
```

#### Paso 5: Frontend - ClaudeCodeScreen

Crear `/projects/expo-app-builder/screens/ClaudeCodeScreen.js`:

```javascript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import socketService from '../services/socket';
import api from '../services/api';

export default function ClaudeCodeScreen({ route }) {
  const { project } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    // Conectar WebSocket
    socketService.connect();

    // Escuchar output de Claude
    socketService.on('claude:output', (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          type: 'claude',
          content: data.content,
          timestamp: new Date(),
        },
      ]);
    });

    socketService.on('claude:complete', () => {
      setLoading(false);
    });

    return () => {
      socketService.off('claude:output');
      socketService.off('claude:complete');
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // Agregar mensaje del usuario
    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Ejecutar Claude Code
      await api.post('/api/claude/execute', {
        projectPath: project.path,
        prompt: input,
        socketId: socketService.getSocketId(),
      });
    } catch (error) {
      console.error('Error executing Claude:', error);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[
              styles.message,
              item.type === 'user' ? styles.userMessage : styles.claudeMessage,
            ]}
          >
            <Text style={styles.messageText}>{item.content}</Text>
          </View>
        )}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      {loading && (
        <View style={styles.loadingIndicator}>
          <Text>Claude está escribiendo...</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Pregúntale a Claude..."
          multiline
          editable={!loading}
        />
        <Pressable
          style={[styles.sendButton, loading && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={loading}
        >
          <Text style={styles.sendButtonText}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  message: {
    padding: 12,
    margin: 8,
    borderRadius: 8,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  claudeMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
  },
  messageText: {
    fontSize: 16,
  },
  loadingIndicator: {
    padding: 12,
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
```

#### Paso 6: Agregar navegación

En `/projects/expo-app-builder/App.js`, agregar la screen:

```javascript
import ClaudeCodeScreen from './screens/ClaudeCodeScreen';

// Dentro de Stack.Navigator:
<Stack.Screen
  name="ClaudeCode"
  component={ClaudeCodeScreen}
  options={{
    title: 'Claude Code',
    headerBackTitle: 'Atrás',
  }}
/>
```

#### Paso 7: Agregar botón en HomeScreen

En `HomeScreen.js`, al renderizar `ProjectCard`:

```javascript
<ProjectCard
  project={item}
  onPress={() => navigation.navigate('ClaudeCode', { project: item })}
  onDelete={handleDeleteProject}
/>
```

#### Paso 8: Testing

```bash
# Backend
cd expo-app-builder-server
npm start

# App
cd projects/expo-app-builder
npm start

# Probar:
1. Crear un proyecto
2. Abrir el proyecto (ir a ClaudeCode)
3. Escribir: "Muestra el contenido de App.js"
4. Ver respuesta de Claude en tiempo real
```

---

## 📐 Convenciones y Estándares

### Código

**JavaScript**:
- ES6+ syntax
- Usar `const` por defecto, `let` si es necesario
- Arrow functions para callbacks
- Template literals para strings
- Async/await sobre Promises

**Naming**:
- `camelCase` para variables y funciones
- `PascalCase` para componentes React y clases
- `UPPER_SNAKE_CASE` para constantes
- Nombres descriptivos (evitar `a`, `b`, `x`)

**Formato**:
```javascript
// ❌ Evitar
function foo(x,y){return x+y}

// ✅ Preferir
function calculateSum(num1, num2) {
  return num1 + num2;
}
```

### Git

**Branches**:
- `main` - Producción
- `develop` - Desarrollo activo
- `feature/nombre-feature` - Nuevas features
- `fix/nombre-bug` - Bug fixes

**Commits**:
```
<tipo>: <descripción>

[cuerpo opcional]

Tipos:
- feat: Nueva funcionalidad
- fix: Bug fix
- docs: Documentación
- refactor: Refactorización
- test: Tests
- chore: Tareas de mantenimiento
```

Ejemplos:
```
feat: agregar ClaudeService para integración IA
fix: corregir validación de nombres de proyecto
docs: actualizar GUIA_DESARROLLADOR.md
```

### Archivos

**Estructura de archivos**:
```javascript
// 1. Imports
import React, { useState } from 'react';
import { View, Text } from 'react-native';

// 2. Constantes/Config
const API_URL = 'http://localhost:3001';

// 3. Componente/Función principal
export default function MyComponent() {
  // ...
}

// 4. Estilos (al final)
const styles = StyleSheet.create({
  // ...
});
```

### Error Handling

**Backend**:
```javascript
try {
  const result = await someAsyncOperation();
  logger.info('Operation successful', { result });
  return result;
} catch (error) {
  logger.error('Operation failed', { error: error.message });
  throw error; // Dejar que errorHandler middleware lo maneje
}
```

**Frontend**:
```javascript
try {
  const response = await api.post('/endpoint', data);
  Alert.alert('Éxito', 'Operación completada');
} catch (error) {
  Alert.alert(
    'Error',
    error.response?.data?.error || 'Algo salió mal'
  );
  console.error('API Error:', error);
}
```

---

## 🧪 Testing

### Tests Actuales

Ver `REPORTE_PRUEBAS.md` para resultados de Fase 1.

### Agregar Tests (Fase 5)

#### Backend - Setup

```bash
cd expo-app-builder-server
npm install --save-dev jest supertest
```

`package.json`:
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

#### Ejemplo de test - ProjectService

`__tests__/ProjectService.test.js`:
```javascript
const ProjectService = require('../src/services/ProjectService');
const fs = require('fs').promises;

describe('ProjectService', () => {
  describe('createProject', () => {
    it('should create a valid Expo project', async () => {
      const projectName = 'test-project-' + Date.now();

      const result = await ProjectService.createProject(projectName);

      expect(result).toHaveProperty('id');
      expect(result.name).toBe(projectName);
      expect(result.template).toBe('blank');

      // Cleanup
      await ProjectService.deleteProject(projectName);
    });

    it('should reject invalid project names', async () => {
      await expect(
        ProjectService.createProject('invalid name!')
      ).rejects.toThrow();
    });
  });
});
```

#### Frontend - Setup

```bash
cd projects/expo-app-builder
npm install --save-dev jest @testing-library/react-native
```

#### Ejemplo de test - HomeScreen

`__tests__/HomeScreen.test.js`:
```javascript
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import HomeScreen from '../screens/HomeScreen';

jest.mock('../services/api');

describe('HomeScreen', () => {
  it('should render project list', async () => {
    const mockProjects = [
      { id: '1', name: 'test-app', template: 'blank' }
    ];

    api.get.mockResolvedValue({ data: mockProjects });

    const { getByText } = render(<HomeScreen />);

    await waitFor(() => {
      expect(getByText('test-app')).toBeTruthy();
    });
  });
});
```

---

## 📚 Recursos y Documentación

### Documentos del Proyecto

En `/data/data/com.termux/files/home/`:

1. **GUIA_DESARROLLADOR.md** (este archivo)
   - Onboarding completo
   - Roadmap de desarrollo

2. **EXPO_APP_BUILDER_PLAN.md**
   - Plan detallado de 5 fases
   - Arquitectura técnica

3. **INICIO_RAPIDO.md**
   - Guía para usuarios
   - Comandos rápidos

4. **REPORTE_PRUEBAS.md**
   - Resultados de testing Fase 1
   - Benchmarks de rendimiento

### Enlaces Útiles

**Tecnologías**:
- [Expo Docs](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [React Navigation](https://reactnavigation.org/docs/getting-started)
- [Express.js](https://expressjs.com/)
- [Socket.io](https://socket.io/docs/v4/)

**CLIs**:
- [Expo CLI](https://docs.expo.dev/workflow/expo-cli/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Claude Code](https://docs.anthropic.com/) (ajustar al link real)

**Termux**:
- [Termux Wiki](https://wiki.termux.com/)
- [Termux:API](https://wiki.termux.com/wiki/Termux:API)

### Contacto y Soporte

**Preguntas frecuentes**:
1. ¿Cómo debuggear el servidor?
   - Ver logs en `server.log`
   - Usar `console.log` / `logger.info`

2. ¿Cómo reiniciar todo?
   ```bash
   pkill -f "node server"
   pkill -f "expo start"
   # Luego reiniciar
   ```

3. ¿Dónde están los proyectos creados?
   - `/data/data/com.termux/files/home/app-builder-projects/`

4. ¿Cómo cambiar el puerto del servidor?
   - Editar `.env`: `PORT=3002`

---

## 🎯 Checklist para Nuevos Desarrolladores

Antes de empezar a desarrollar, asegúrate de:

- [ ] Leer esta guía completa
- [ ] Revisar `EXPO_APP_BUILDER_PLAN.md`
- [ ] Instalar todas las dependencias
- [ ] Verificar que el servidor inicia correctamente
- [ ] Verificar que la app inicia correctamente
- [ ] Ejecutar un test de crear/listar/eliminar proyecto
- [ ] Familiarizarte con la estructura de código
- [ ] Configurar git si harás commits
- [ ] Revisar issues/tareas pendientes

---

## 🚦 Estado Actual del Proyecto

```
Fase 1: Setup Básico          ████████████████████  100% ✅
Fase 2: Claude Code            ████████████████████  100% ✅
Fase 3: EAS Build & Local VPS  ████████████████████  100% ✅
Fase 4: Refinamiento UI/UX     ░░░░░░░░░░░░░░░░░░░░    0% 🔄 SIGUIENTE
Fase 5: Testing & Optimization ░░░░░░░░░░░░░░░░░░░░    0% ⏳

Progreso General: ████████████░░░░░░░░ 60%
```

---

## 📝 Notas Finales

### Mejores Prácticas

1. **Siempre leer antes de modificar** - Entender el código existente
2. **Probar localmente** - Antes de commitear
3. **Documentar cambios** - Actualizar docs relevantes
4. **Logs apropiados** - `logger.info` para operaciones importantes
5. **Error handling** - Nunca dejar try/catch vacíos
6. **Git commits pequeños** - Un commit = una funcionalidad
7. **Preguntar si hay dudas** - Mejor preguntar que asumir

### Troubleshooting Común

**"Cannot connect to server"**:
```bash
# Verificar que el servidor esté corriendo
ps aux | grep "node server"

# Si no está, iniciarlo
cd expo-app-builder-server && npm start
```

**"Port 3001 already in use"**:
```bash
# Matar proceso en puerto 3001
pkill -f "node server"
# O cambiar puerto en .env
```

**"Module not found"**:
```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

**"Expo error"**:
```bash
# Limpiar cache
expo start --clear
```

---

**¡Bienvenido al equipo! 🚀**

Esta guía será actualizada conforme el proyecto avance. Si encuentras algo que falta o necesita clarificación, por favor actualiza este documento.

**Última actualización**: 2 de Enero, 2026
**Versión**: 2.0
**Creado con**: Claude Code ❤️
