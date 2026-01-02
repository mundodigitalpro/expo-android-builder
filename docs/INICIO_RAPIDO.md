# Expo Android Builder - Inicio Rápido

## Resumen

Sistema completo para construir apps Expo desde tu móvil Android con integración de Claude Code, EAS Build, y sistema de builds locales en VPS.

## Arquitectura del Sistema

### Entornos de Ejecución

**Desarrollo Local (Termux)**:
```
Mismo dispositivo Android (Termux)
├── Backend (Node.js): localhost:3001
└── Frontend (Expo App): Se conecta a localhost:3001
```

**Producción (VPS)**:
```
Backend: VPS Hetzner (https://builder.josejordan.dev)
Frontend: App móvil → Se conecta al VPS remoto
```

### 1. Servidor Backend (Node.js + Express)

**Ubicación desarrollo**: `~/expo-android-builder/server/` (en Termux)
**Ubicación producción**: VPS Hetzner (Docker container)

**Características**:
- API REST para gestión de proyectos
- WebSocket para comunicación en tiempo real
- Integración con Claude Code CLI
- Integración con EAS Build
- Sistema de builds locales en VPS
- Ejecución segura de comandos CLI
- Autenticación con token

### 2. App React Native (Expo)

**Ubicación**: `~/expo-android-builder/app/` (desarrollo en Termux)

**Pantallas**:
- HomeScreen: Lista de proyectos
- NewProjectScreen: Crear nuevos proyectos
- ClaudeCodeScreen: Chat con Claude Code ✅
- BuildStatusScreen: Monitor de builds EAS ✅
- SettingsScreen: Configuración y selector de entorno

## Cómo Usar

### Inicio Rápido - TODO EN UNO (Recomendado)

```bash
cd ~/expo-android-builder/server
./start-all-services.sh
```

Este script:
- Inicia el backend en segundo plano
- Espera a que el servidor esté listo (health check automático)
- Inicia el servidor de desarrollo de Expo
- Muestra el código QR para escanear con Expo Go
- Se detiene automáticamente cuando cierras Expo

### Inicio Manual (Avanzado)

**Paso 1: Iniciar el Servidor**

```bash
cd ~/expo-android-builder/server
npm start
```

Deberías ver:
```
🚀 Server running on http://localhost:3001
📡 WebSocket ready for connections
🔑 Auth token: expo-builder-token-2024-secure
```

**Paso 2: Iniciar la App**

En otra sesión de Termux:

```bash
cd ~/expo-android-builder/app
npm start
```

### Detener Todo

```bash
# Opción 1: Ctrl+C en la terminal donde corre Expo (detiene todo)

# Opción 2: Script de detención
cd ~/expo-android-builder/server
./stop-all-services.sh
```

### Paso 3: Usar la App

**Crear un Proyecto:**
1. La app se abrirá mostrando la lista de proyectos
2. Presiona el botón "+" para crear un nuevo proyecto
3. Ingresa un nombre (ej: "mi-primera-app")
4. El servidor creará el proyecto en `~/app-builder-projects/`
5. Verás el nuevo proyecto en la lista

**Usar Claude Code:**
1. Navega a la pantalla "Claude Code" desde el menú
2. Escribe tus preguntas o solicitudes
3. Claude responderá en tiempo real
4. Puedes cancelar operaciones en curso si es necesario

**Hacer Builds:**
1. Navega a "Build Status" desde el menú
2. Selecciona el **tipo de build**:
   - ☁️ **EAS Cloud**: Builds remotos en la nube de Expo
   - 🖥️ **Local VPS**: Builds nativos en tu VPS propio
3. Presiona el botón de build
4. Monitorea el progreso en tiempo real
5. Descarga el APK cuando termine

**Diferencias entre tipos**:
- **EAS Cloud**: Más rápido de configurar, requiere cuenta Expo
- **Local VPS**: Más control, no depende de servicios externos, requiere VPS con Android SDK

## Configuración

### Selector de Entorno

La app soporta dos modos de operación:

**1. Desarrollo Local (localhost)**:
- URL: `http://localhost:3001`
- Backend corre en el mismo dispositivo (Termux)
- Ideal para desarrollo y testing

**2. Producción (VPS)**:
- URL: `https://builder.josejordan.dev`
- Backend en servidor remoto
- Para uso real y builds en VPS

Puedes cambiar entre entornos en:
- **Settings** → Campo "Server URL"
- **Token**: expo-builder-token-2024-secure (mismo para ambos entornos)

## Estructura de Proyectos

Los proyectos creados se guardan en:
```
~/app-builder-projects/
├── proyecto-1/
├── proyecto-2/
└── proyecto-3/
```

Cada proyecto es un proyecto Expo completo que puedes:
- Editar con Claude Code ✅
- Ejecutar con `expo start`
- Construir con EAS Build ✅
- Compilar localmente en VPS ✅

## Funcionalidades Actuales

### ✅ Fase 1: Setup Básico (COMPLETADA)
- Servidor Express con API REST
- App React Native con navegación
- CRUD de proyectos Expo
- Autenticación con token

### ✅ Fase 2: Integración Claude Code (COMPLETADA)
- Chat interface en la app
- Ejecución de comandos Claude Code
- Streaming de respuestas en tiempo real
- Cancelación de sesiones

### ✅ Fase 3: EAS Build & Local VPS Build (COMPLETADA)
- Selector de tipo de build (EAS Cloud / Local VPS)
- Iniciar builds desde la app con cualquier método
- Monitor de progreso en tiempo real para ambos tipos
- Descargar APKs generados
- Sistema de despliegue basado en Git

### 🔄 Fase 4: Refinamiento UI/UX (EN PROGRESO)
- Mejoras de diseño visual
- Dark mode
- Animaciones y transiciones
- Mejor experiencia de usuario

### ⏳ Fase 5: Testing & Optimization (PENDIENTE)
- Suite de tests automatizados
- Optimización de rendimiento
- Documentación para usuarios finales

## Documentación Completa

Los planes detallados están en:
```
docs/GUIA_DESARROLLADOR.md       # Guía para desarrolladores
docs/ESTADO_DESARROLLO.md         # Estado actualizado del proyecto
docs/EXPO_APP_BUILDER_PLAN.md     # Plan completo de 5 fases
docs/DEPLOYMENT_VPS.md            # Guía de despliegue en VPS
```

## Comandos Útiles

### Sistema Completo

```bash
# Iniciar todo (backend + frontend)
cd ~/expo-android-builder/server
./start-all-services.sh

# Detener todo
./stop-all-services.sh

# Health check
curl http://localhost:3001/health
```

### Servidor (solo backend)

```bash
# Iniciar servidor
cd ~/expo-android-builder/server
npm start

# Ver logs en tiempo real
tail -f server.log
```

### App (solo frontend)

```bash
# Instalar dependencias
cd ~/expo-android-builder/app
npm install

# Iniciar app
npm start

# Limpiar cache
npm start --clear
```

### Proyectos Creados

```bash
# Listar proyectos
ls -la ~/app-builder-projects/

# Entrar a un proyecto
cd ~/app-builder-projects/mi-proyecto

# Iniciar un proyecto
expo start
```

### EAS Build

```bash
# Ver builds
eas build:list

# Build manual
eas build --platform android --profile preview

# Ver proyectos
eas project:list
```

## Solución de Problemas

### Servidor No Disponible

La app detecta automáticamente cuando el servidor está offline:
1. Toca "📋 Copiar Comando" para copiar el comando de inicio
2. Toca "🔧 Abrir Termux" para cambiar a Termux
3. Pega y ejecuta el comando
4. Vuelve a la app y toca "🔄 Reintentar Conexión"

### Puerto 3001 ya en uso

```bash
cd ~/expo-android-builder/server
./stop-all-services.sh
./start-all-services.sh
```

### No puedo presionar 'a' para Android

Esto es normal en Termux (ADB no disponible). **Usa el código QR**:
- Escanea el QR con la app Expo Go
- Este es el método recomendado

### La app no se conecta

1. Verifica que el servidor esté corriendo: `curl http://localhost:3001/health`
2. Ve a Settings y verifica la URL del servidor
3. Verifica que el token sea correcto
4. Reinicia los servicios si es necesario

## Arquitectura

```
React Native App (Expo Go)
    ↓ HTTP REST API (port 3001) + WebSocket
    ↓ Authorization: Bearer token
Node.js Server (Express + Socket.io)
    ↓ child_process.spawn()
CLI Tools (Expo CLI, Claude Code, EAS CLI, Git)
    ↓
EAS Cloud (builds remotos) / VPS (builds locales)
    ↓
APK/AAB descargable
```

## Estado Actual

**Progreso General: 60%** 🎉

- ✅ **Fase 1 COMPLETADA** - Setup Básico
- ✅ **Fase 2 COMPLETADA** - Integración Claude Code
- ✅ **Fase 3 COMPLETADA** - EAS Build & Local VPS Build
- 🔄 **Fase 4 EN PROGRESO** - Refinamiento UI/UX
- ⏳ **Fase 5 PENDIENTE** - Testing & Optimization

## Siguientes Pasos

1. Probar todas las funcionalidades (Proyectos, Claude Code, Builds)
2. Explorar la interfaz de usuario
3. Hacer un build de prueba con EAS
4. Revisar la documentación completa

## Recursos

- **Guía de Desarrollador**: `docs/GUIA_DESARROLLADOR.md`
- **Estado del Proyecto**: `docs/ESTADO_DESARROLLO.md`
- **Plan Completo**: `docs/EXPO_APP_BUILDER_PLAN.md`
- **Despliegue VPS**: `docs/DEPLOYMENT_VPS.md`
- **Índice de Docs**: `docs/INDICE_DOCUMENTACION.md`

---

**Última actualización**: 2 de Enero, 2026
**Versión**: 2.0 (Fases 1-3 Completadas)
**Desarrollado con**: Claude Code
