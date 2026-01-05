# Plan: Expo App Builder con Integración de Claude Code

## Resumen Ejecutivo

Crear una aplicación Android (React Native + Expo) que permita crear apps Expo mediante una interfaz visual integrada con Claude Code CLI. La app utilizará una arquitectura híbrida cliente-servidor aprovechando el entorno Termux.

## Arquitectura: Híbrido Cliente-Servidor-CLI

```
┌─────────────────────────────────────────┐
│   REACT NATIVE APP (Puerto: Expo)      │
│   - UI Visual para crear proyectos      │
│   - Interface chat con Claude Code      │
│   - Monitoreo de builds EAS             │
└──────────────┬──────────────────────────┘
               │ HTTP/WebSocket
               │ localhost:3001
┌──────────────▼──────────────────────────┐
│   NODE.JS SERVER (Termux)               │
│   - API REST para proyectos             │
│   - Ejecutor de comandos CLI            │
│   - WebSocket para streaming            │
└──────────────┬──────────────────────────┘
               │ child_process
         ┌─────┴─────┬─────────┬──────────┐
         ▼           ▼         ▼          ▼
    Claude Code   Expo CLI  EAS CLI   Git CLI
```

## Componentes Principales

### 1. React Native App (Frontend)
**Ubicación:** `/data/data/com.termux/files/home/expo-android-builder/app/`

**Pantallas:**
- **HomeScreen**: Lista de proyectos creados con opciones CRUD
- **NewProjectScreen**: Formulario para crear nuevo proyecto Expo
- **ClaudeCodeScreen**: Chat interface para interactuar con Claude Code
- **BuildStatusScreen**: Monitor de builds EAS en tiempo real
- **SettingsScreen**: Configuración del servidor y credenciales

**Navegación:** React Navigation 6 (Stack Navigator)

**Dependencias clave:**
```json
{
  "@react-navigation/native": "^6.x",
  "@react-navigation/stack": "^6.x",
  "axios": "^1.6.0",
  "socket.io-client": "^4.6.0",
  "@react-native-async-storage/async-storage": "^1.21.0",
  "expo-file-system": "~17.0.0"
}
```

### 2. Node.js Server (Backend en Termux)
**Ubicación:** `/data/data/com.termux/files/home/expo-android-builder/server/`

**Servicios:**
- **ProjectService**: Crear/listar/eliminar proyectos Expo
- **ClaudeService**: Ejecutar comandos de Claude Code con streaming
- **EASService**: Iniciar builds y obtener status
- **FileService**: Operaciones de archivos/carpetas

**Tecnologías:**
```json
{
  "express": "^4.18.0",
  "socket.io": "^4.6.0",
  "cors": "^2.8.5",
  "dotenv": "^16.0.0"
}
```

**Endpoints REST:**
- `POST /api/projects` - Crear nuevo proyecto
- `GET /api/projects` - Listar todos los proyectos
- `DELETE /api/projects/:id` - Eliminar proyecto
- `POST /api/claude/execute` - Ejecutar comando Claude Code
- `POST /api/build/start` - Iniciar build EAS
- `GET /api/build/status/:buildId` - Estado del build

**WebSocket Events:**
- `claude:output` - Stream de salida de Claude Code
- `build:log` - Logs de build en tiempo real
- `build:complete` - Notificación de build completado

## Estructura de Archivos

### App (React Native)
```
app/
├── App.js                          # Root component con NavigationContainer
├── app.json                        # Configuración Expo
├── package.json
├── screens/
│   ├── HomeScreen.js              # Lista de proyectos
│   ├── NewProjectScreen.js        # Crear proyecto
│   ├── ClaudeCodeScreen.js        # Interface Claude Code
│   ├── BuildStatusScreen.js       # Monitor builds
│   └── SettingsScreen.js          # Configuración
├── components/
│   ├── ProjectCard.js             # Card para proyecto
│   ├── ChatMessage.js             # Mensaje de chat
│   ├── BuildLog.js                # Log de build
│   └── LoadingSpinner.js          # Spinner
├── services/
│   ├── api.js                     # Cliente HTTP (axios)
│   └── socket.js                  # Cliente WebSocket
├── utils/
│   ├── storage.js                 # AsyncStorage wrapper
│   └── validators.js              # Validación de forms
└── assets/                        # Iconos, imágenes
```

### Server (Node.js)
```
server/
├── package.json
├── .env                           # Variables de entorno
├── server.js                      # Entry point
├── src/
│   ├── config/
│   │   └── constants.js          # Constantes (paths, ports)
│   ├── routes/
│   │   ├── projects.js           # Rutas de proyectos
│   │   ├── claude.js             # Rutas de Claude Code
│   │   └── build.js              # Rutas de builds
│   ├── services/
│   │   ├── ProjectService.js     # Lógica de proyectos
│   │   ├── ClaudeService.js      # Integración Claude CLI
│   │   ├── EASService.js         # Integración EAS CLI
│   │   └── FileService.js        # Operaciones de archivos
│   ├── utils/
│   │   ├── executor.js           # Safe command executor
│   │   ├── validator.js          # Validación de inputs
│   │   └── logger.js             # Logging
│   └── middleware/
│       ├── auth.js               # Autenticación simple
│       └── errorHandler.js       # Manejo de errores
└── start-server.sh                # Script de inicio
```

## Flujos Principales

### Flujo 1: Crear Nuevo Proyecto
```
1. Usuario llena formulario en NewProjectScreen
2. App envía POST /api/projects con:
   - projectName
   - template: "blank"
   - packageName (opcional)
3. Server ejecuta: npx create-expo-app {name} --template blank
4. Server inicializa git y crea estructura básica
5. Server responde con project ID y path
6. App navega a HomeScreen mostrando nuevo proyecto
```

### Flujo 2: Interactuar con Claude Code
```
1. Usuario selecciona proyecto en HomeScreen
2. Navega a ClaudeCodeScreen
3. Usuario escribe mensaje en chat
4. App envía POST /api/claude/execute con:
   - projectPath
   - prompt/mensaje
5. Server ejecuta: claude code --prompt "{mensaje}" en directorio del proyecto
6. Server envía output vía WebSocket evento 'claude:output'
7. App muestra respuesta en tiempo real en interfaz de chat
8. Usuario puede seguir conversando con Claude Code
```

### Flujo 3: Build con EAS
```
1. Usuario presiona "Build APK" en proyecto
2. App envía POST /api/build/start con projectPath
3. Server ejecuta: cd {projectPath} && eas build -p android --profile preview
4. Server captura output y envía vía WebSocket 'build:log'
5. App muestra logs en BuildStatusScreen en tiempo real
6. Cuando build completa, evento 'build:complete' con URL del APK
7. App muestra botón para descargar/instalar APK
```

## Seguridad

### Autenticación Simple (Local)
```javascript
// .env en server
AUTH_TOKEN=random-generated-token-12345

// App guarda token en AsyncStorage
// Cada request incluye: headers: { 'Authorization': 'Bearer {token}' }
```

### Validación de Comandos
```javascript
// Whitelist de comandos permitidos
const ALLOWED_COMMANDS = [
  'npx create-expo-app',
  'claude code',
  'eas build',
  'git init',
  'git add',
  'git commit'
];

// Validar antes de ejecutar
function validateCommand(cmd) {
  return ALLOWED_COMMANDS.some(allowed => cmd.startsWith(allowed));
}
```

### Validación de Paths
```javascript
// Prevenir path traversal
const PROJECT_BASE = '/data/data/com.termux/files/home/app-builder-projects';

function sanitizePath(userPath) {
  const resolved = path.resolve(PROJECT_BASE, userPath);
  if (!resolved.startsWith(PROJECT_BASE)) {
    throw new Error('Invalid path');
  }
  return resolved;
}
```

## Implementación por Fases

### Fase 1: Setup Básico (Semana 1)
**Archivos críticos:**
- `server/server.js`
- `server/src/services/ProjectService.js`
- `app/App.js`
- `app/screens/HomeScreen.js`
- `app/services/api.js`

**Funcionalidad:**
- Servidor Express básico corriendo en Termux
- App React Native con navegación
- Endpoint crear proyecto (sin Claude Code aún)
- Lista de proyectos en HomeScreen

### Fase 2: Integración Claude Code (Semana 2)
**Archivos críticos:**
- `server/src/services/ClaudeService.js`
- `server/src/utils/executor.js`
- `app/screens/ClaudeCodeScreen.js`
- `app/services/socket.js`

**Funcionalidad:**
- WebSocket setup
- Ejecutor de comandos Claude Code
- Interface de chat en app
- Streaming de respuestas en tiempo real

### Fase 3: Integración EAS Build (Semana 3)
**Archivos críticos:**
- `server/src/services/EASService.js`
- `app/screens/BuildStatusScreen.js`
- `app/components/BuildLog.js`

**Funcionalidad:**
- Iniciar builds desde app
- Monitor de progreso en tiempo real
- Descarga de APKs generados

### Fase 4: UI/UX Refinamiento (Semana 4)
**Archivos:**
- Todos los componentes en `app/components/`
- Estilos mejorados
- Loading states
- Error handling

### Fase 5: Testing y Optimización (Semana 5)
- Pruebas de integración
- Manejo de errores robusto
- Optimización de rendimiento
- Documentación

## Scripts de Inicio

### start-expo-builder-server.sh
```bash
#!/data/data/com.termux/files/usr/bin/bash

# Navegar al directorio del servidor
cd /data/data/com.termux/files/home/expo-android-builder/server

# Iniciar servidor
node server.js &

# Guardar PID
echo $! > server.pid

echo "Expo App Builder Server iniciado en puerto 3001"
```

### Configuración .env
```bash
PORT=3001
AUTH_TOKEN=generate-secure-random-token
PROJECTS_BASE_PATH=/data/data/com.termux/files/home/app-builder-projects
NODE_ENV=development
```

## Consideraciones Técnicas

### Limitaciones
1. **Sin acceso a Android APIs nativas** en Expo Go - requiere Custom Dev Client para algunas features
2. **Memoria limitada en móvil** - limitar proyectos simultáneos
3. **Builds consumen batería** - advertir al usuario

### Optimizaciones
1. **Cache de proyectos** en AsyncStorage
2. **Debounce en chat** para no saturar Claude Code
3. **Pagination** en lista de proyectos
4. **Background tasks** para builds largos

### Dependencias del Sistema (Termux)
```bash
pkg install nodejs
npm install -g expo-cli eas-cli
# Claude Code ya instalado
```

## Próximos Pasos al Aprobar

1. Crear estructura de directorios
2. Inicializar proyecto React Native: `npx create-expo-app expo-android-builder`
3. Inicializar servidor Node.js
4. Implementar Fase 1 (Setup Básico)
5. Testing de comunicación app-server
6. Continuar con fases subsecuentes

## Archivos Críticos a Crear (Resumen)

### Alta Prioridad (Fase 1):
1. `/home/expo-android-builder/server/server.js`
2. `/home/expo-android-builder/server/src/services/ProjectService.js`
3. `/home/expo-android-builder/app/App.js`
4. `/home/expo-android-builder/app/screens/HomeScreen.js`
5. `/home/expo-android-builder/app/services/api.js`

### Media Prioridad (Fase 2-3):
6. `/home/expo-android-builder/server/src/services/ClaudeService.js`
7. `/home/expo-android-builder/server/src/utils/executor.js`
8. `/home/expo-android-builder/app/screens/ClaudeCodeScreen.js`
9. `/home/expo-android-builder/app/screens/BuildStatusScreen.js`

### Baja Prioridad (Fase 4-5):
10. Componentes de UI refinados
11. Testing utilities
12. Documentación
