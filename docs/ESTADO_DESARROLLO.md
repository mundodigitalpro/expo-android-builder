# Estado del Desarrollo - Expo Android Builder
**Fecha:** 4 de Enero 2026
**Última actualización:** 19:10
**Desarrollador:** josejordandev
**Entorno:** Termux/Android + VPS Hetzner (Producción)

---

## 🚀 FASE ACTUAL: MVP para VPS Privado (Simplificado)

**Estado actual:** ✅ Plan MVP simplificado listo - Sin sobreingeniería

- **Repositorio original:** [expo-app-builder-workspace](https://github.com/mundodigitalpro/expo-app-builder-workspace)
- **Repositorio actual:** [expo-android-builder](https://github.com/mundodigitalpro/expo-android-builder)
- **Plan MVP (uso privado):** `docs/PLAN_MVP_VPS.md` ⭐ (3-5 días)
- **Plan multi-usuario (futuro):** `docs/PLAN_MULTIUSUARIO_FUTURO.md` (8-11 semanas)
- **Objetivo actual:** Builds de Android en VPS propio para uso privado

### Decisión arquitectónica importante (31 Dic 2024 - 19:08):
🎯 **MVP Simplificado para uso privado - Sin sobreingeniería**

**Enfoque MVP (eliminado del plan inicial):**
- ❌ PostgreSQL + Sequelize → Usar filesystem (ya funciona)
- ❌ Redis + Bull Queues → No hay builds concurrentes
- ❌ JWT multi-usuario → Mantener token simple
- ❌ Rate limiting avanzado → VPS privado

**Mantenido para MVP:**
- ✅ VPS Hetzner (Ubuntu 22.04)
- ✅ Node.js + PM2
- ✅ Android SDK para builds locales
- ✅ Nginx + Let's Encrypt
- ✅ Backend actual SIN cambios

### Flujo de trabajo decidido:
📋 **Desarrollo híbrido**: Local (Termux) + Deploy (VPS)

```
Termux (Local)           GitHub              VPS Hetzner
─────────────            ──────              ───────────
Desarrollo     ──push──> Repo    ──pull──>  Production
Testing local            Control             Deployment
Claude Code              Versiones           Builds Android
```

**Ventajas:**
- Desarrollo cómodo en Termux (donde ya está todo configurado)
- Claude Code funcionando perfectamente
- VPS solo para producción y builds
- Git maneja sincronización automáticamente

---

## 🎉 HITO ALCANZADO (Fase 3)

**Primera app compilada e instalada exitosamente desde el móvil usando Expo App Builder.**

- **Proyecto:** test-claude
- **Build ID:** 0e10e12e-be82-4d6a-b110-91f052c7c103
- **APK:** https://expo.dev/artifacts/eas/2JK1gYZWdHbohaDMi9UxcH.apk
- **Fecha:** 30 Dic 2024, 09:56 CET

---

## ✅ HITO NUEVO (Fase 3.1) - GitHub Actions Staging

**Estado:** ✅ Staging y builds en GitHub Actions operativos desde la app

- **Staging de proyectos externos** con branches temporales.
- **Workflow** actualizado para compilar `temp-builds/<project>`.
- **Tracking en la app** con polling por branch.
- **Descarga directa de artifacts** via API (`/api/github-actions/runs/:runId/artifacts/latest/download`).
- **Rate limiting** para staging (5 requests / 15 min).

**Notas de entorno:**
- En Termux es necesario instalar `rsync` para staging.
- Los APKs pueden requerir deps nativas (`react-native-gesture-handler`, `@react-native-async-storage/async-storage`).

---

## ✅ Actualizacion - Diagnostico de Inicio y Fallback de URL (4 Ene 2026)

**Estado:** ✅ Instrumentacion agregada para debug de conectividad en app

- Indicadores de arranque con mensaje y URL de health check.
- Pantalla de "Servidor No Disponible" con presets (VPS/Local), URL manual y copia de diagnostico.
- Fallback automatico de URL legacy (IP) a HTTPS y timeout de health check.

---

## Resumen del Proyecto

**Expo App Builder Workspace** es un sistema móvil de desarrollo que corre en Termux/Android, compuesto por:

1. **React Native App** (`/app`) - UI móvil para crear y gestionar proyectos Expo
2. **Node.js Server** (`/server`) - Backend API que ejecuta comandos CLI y gestiona proyectos

**Arquitectura:**
```
React Native App (Expo Go)
    ↓ HTTP REST API (port 3001) + WebSocket
    ↓ Authorization: Bearer token
Node.js Server (Express + Socket.io)
    ↓ child_process.spawn()
CLI Tools (Expo CLI, Claude Code, EAS CLI, Git)
    ↓
EAS Cloud (builds remotos)
    ↓
APK/AAB descargable
```

---

## Estado de las Fases

| Fase | Nombre | Estado | Descripción |
|------|--------|--------|-------------|
| 1 | Basic Setup | ✅ COMPLETADA | CRUD proyectos, API REST, WebSocket |
| 2 | Claude Code Integration | ✅ COMPLETADA | Chat con Claude CLI, streaming |
| 3 | EAS Build Integration | ✅ COMPLETADA | Builds en la nube, descarga APK |
| 4 | UI Refinement | 🔲 PENDIENTE | Mejoras visuales, dark mode |
| 5 | Testing & Polish | 🔲 PENDIENTE | Tests, documentación usuario |

---

## ✅ Phase 1: Basic Setup (COMPLETADA)

**Backend:**
- ✅ Express server con REST API
- ✅ WebSocket con Socket.io
- ✅ ProjectService.js - CRUD de proyectos
- ✅ Ejecutor seguro de comandos (whitelist)
- ✅ Validadores y sanitización de paths
- ✅ Logger estructurado
- ✅ Middleware de autenticación
- ✅ Manejo centralizado de errores

**Frontend:**
- ✅ React Navigation Stack Navigator
- ✅ HomeScreen - Lista de proyectos con pull-to-refresh
- ✅ NewProjectScreen - Formulario para crear proyectos
- ✅ SettingsScreen - Configuración de servidor
- ✅ ProjectCard component
- ✅ API service con Axios + interceptors
- ✅ AsyncStorage para auth y configuración

**API Endpoints:**
- `GET /health` - Health check
- `GET /api/projects` - Listar proyectos
- `POST /api/projects` - Crear proyecto (auto-configura EAS)
- `GET /api/projects/:name` - Obtener proyecto
- `DELETE /api/projects/:name` - Eliminar proyecto

---

## ✅ Phase 2: Claude Code Integration (COMPLETADA)

**Backend:**
- ✅ `ClaudeService.js` - Ejecuta Claude Code CLI
- ✅ `routes/claude.js` - Rutas para ejecutar y cancelar Claude
- ✅ WebSocket streaming para output en tiempo real
- ✅ Detección automática de Claude CLI
- ✅ Manejo de sesiones activas

**Frontend:**
- ✅ `ClaudeCodeScreen.js` - Interfaz de chat con Claude
- ✅ `socket.js` - Cliente WebSocket mejorado
- ✅ Estado de conexión ("Conectando...")
- ✅ Mensajes en tiempo real
- ✅ Cancelación de sesiones

**API Endpoints:**
- `POST /api/claude/execute` - Ejecutar Claude Code
- `POST /api/claude/cancel` - Cancelar sesión

**WebSocket Events:**
- `claude:output` - Output de Claude
- `claude:error` - Errores
- `claude:complete` - Sesión completada

---

## ✅ Phase 3: EAS Build & Local VPS Build (COMPLETADA)

**Backend (EAS Cloud + Local VPS):**
- ✅ `EASService.js` - Servicio completo para builds con EAS CLI
  - `startBuild()` - Inicia builds (Android/iOS)
  - `listBuilds()` - Lista builds con manejo robusto de errores
  - `getBuildStatus()` - Estado de build específico
  - `cancelBuild()` - Cancela builds activos
  - `initProject()` - Inicializa proyecto EAS automáticamente
  - WebSocket streaming para progreso en tiempo real
  - Fix: `EAS_SKIP_AUTO_FINGERPRINT=1` para compatibilidad Termux
- ✅ `routes/builds.js` - Rutas API completas
- ✅ `ProjectService.js` mejorado:
  - Auto-configura `app.json` con `android.package`, `owner`
  - Auto-crea `eas.json` con perfiles de build
  - Nuevos proyectos listos para EAS desde el primer momento
- ✅ **NUEVO:** `LocalBuildService.js` - Builds locales en VPS sin EAS Cloud
  - `expo prebuild` para generar proyecto nativo
  - `./gradlew assembleDebug` para compilar
  - Soporte para NDK y Java 17
- ✅ `routes/localBuilds.js` - Endpoints para proceso local
- ✅ WebSocket streaming unificado
  
**Frontend:**
- ✅ `BuildStatusScreen.js` - Pantalla de gestión de builds
  - Botón para iniciar builds Android/iOS
  - Lista de builds con estados visuales
  - Banner de progreso en tiempo real (azul)
  - **NEW:** Contador de tiempo transcurrido (⏱️ MM:SS)
  - **NEW:** Barra de progreso animada (pulsante)
  - Botón "Configurar EAS" cuando no está vinculado
  - Botón "Download APK" cuando build termina
  - Link a EAS dashboard
  - Filtrado inteligente de mensajes (progress vs errors)
  - (Parcial: funciona para EAS, pendiente integración Local)
  - Botón "Build Preview"
  - Lista de builds
  
- ✅ `buildsApi` en `services/api.js`
- ✅ ProjectCard con botón "🔨 Builds"
- ✅ Navegación configurada

**API Endpoints:**
- `POST /api/builds/start` - Iniciar build
- `POST /api/builds/cancel` - Cancelar build
- `GET /api/builds/status/:easBuildId` - Estado de build
- `GET /api/builds/list` - Listar builds
- `GET /api/builds/info/:buildId` - Info de build activo
- `POST /api/builds/init` - Inicializar proyecto EAS
- `POST /api/local-builds/start` - Iniciar build local
- `GET /api/local-builds/status/:id` - Estado
- `GET /api/local-builds/download/:id` - Descargar APK

**WebSocket Events:**
- `build:output` - Output del proceso
- `build:error` - Errores y mensajes (filtrados inteligentemente)
- `build:queued` - Build encolado
- `build:complete` - Proceso completado

**Testing Checklist Phase 3:**
- [x] Iniciar build desde app
- [x] Ver progreso en tiempo real
- [x] Build se encola en EAS
- [x] Ver lista de builds
- [x] Ver logs de build (link a EAS)
- [x] Descargar APK cuando termine
- [x] Instalar APK en dispositivo
- [x] APK funciona correctamente
- [x] Crear nuevo proyecto y hacer build (hola-mundo)

**Bugs resueltos (30 Dic 2024):**
1. ✅ Variable shadowing `process` → Renombrado a `easProcess`
2. ✅ "android.package required" → Auto-configurado en app.json
3. ✅ "Keystore not supported" → `withoutCredentials: true` en eas.json
4. ✅ "Failed to compute fingerprint" → `EAS_SKIP_AUTO_FINGERPRINT=1`
5. ✅ Status case-sensitivity → `toLowerCase()` comparison
6. ✅ Mensajes como ERROR → Filtrado inteligente de stderr
7. ✅ "Project does not exist" → Añadido `--force` a `eas project:init`
8. ✅ Template eas.json sin `withoutCredentials` → Actualizado `ProjectService.js`

**Builds exitosos:**
- **test-claude** - Build ID: `0e10e12e-be82-4d6a-b110-91f052c7c103` ✅
- **hola-mundo** - Build enviado correctamente ✅

**Hito (2 Ene 2026):**
- ✅ Primer build local exitoso en VPS (15 min)
- ✅ APK generado y verificable en `/app-builder-builds`

---

## Changelog

### 4 Enero 2026 - 19:00
- 🚀 **HITO:** GitHub Actions Staging System (100% Funcional)
  - Capacidad de compilar proyectos de usuarios (e.g. `test-vps`) usando GitHub Actions.
  - Trigger desde App Móvil → VPS → GitHub → APK.
  
- 🐛 **Critical Fixes:**
  - **Workflow**: Optimizado `gradle-build-android.yml` para gestión de dependencias (eliminado conflicto `metro-config`).
  - **Conectividad**: Habilitado `usesCleartextTraffic` en App para permitir conexiones HTTP directas a IP (bypass DNS).
  - **Docker**: Solucionados permisos de Git y montaje de volúmenes en producción.

### 4 Enero 2026 - 14:00
- 🚀 **HITO:** App Principal Compilada en GitHub Actions
  - Primera compilación exitosa de `/app` en GitHub Actions
  - APK funcionando y conectándose al VPS de producción
  - Script `build-android.sh` para automatizar builds desde terminal

- 🔧 **GitHub Actions Staging Configurado en VPS Docker**
  - Montaje del repositorio git en contenedor Docker (`/repo:rw`)
  - Configuración de variables: `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`
  - Instalación de `rsync` para copiar proyectos al staging
  - Configuración de `git config --global --add safe.directory /repo`

### 2 Enero 2026 - 16:50
- 🚀 **HITO MAYOR:** Sistema de Build Local en VPS Completado
  - Implementado `LocalBuildService` para compilar APKs nativamente en el VPS
  - Eliminada dependencia obligatoria de EAS Cloud
  - Instalado Android NDK (v27.1.12297006) en el Host
  - Solucionados problemas de compatibilidad de Shell (`/bin/sh`) en Docker
  - Documentado proceso completo en `DEPLOYMENT_VPS.md`
  - Verificado: Build completo de `test-local-build` exitoso

## 🔲 Phase 4: UI Refinement (PENDIENTE)

### Objetivos:
- Mejorar el diseño visual de todas las pantallas
- Implementar dark mode
- Añadir animaciones y transiciones suaves
- Mejorar la experiencia de usuario general

### Tareas planificadas:

**Diseño Visual:**
- [ ] Rediseñar HomeScreen con cards más atractivas
- [ ] Mejorar NewProjectScreen con mejor feedback
- [ ] Actualizar SettingsScreen con diseño moderno
- [ ] Rediseñar ClaudeCodeScreen como chat moderno
- [ ] Mejorar BuildStatusScreen con más información visual

**Dark Mode:**
- [ ] Crear tema oscuro completo
- [ ] Añadir toggle en Settings
- [ ] Persistir preferencia en AsyncStorage
- [ ] Aplicar tema a todas las pantallas

**Animaciones:**
- [ ] Transiciones entre pantallas
- [ ] Animaciones de loading
- [ ] Animaciones de feedback (success, error)
- [ ] Pull-to-refresh animado
- [ ] Skeleton loaders mientras cargan datos

**UX Improvements:**
- [ ] Gestos de navegación
- [ ] Haptic feedback
- [ ] Mejor manejo de estados vacíos
- [ ] Indicadores de conexión más claros
- [ ] Onboarding para nuevos usuarios

---

## 🔲 Phase 5: Testing & Polish (PENDIENTE)

### Objetivos:
- Asegurar estabilidad del sistema
- Documentar para usuarios finales
- Preparar para uso en producción

### Tareas planificadas:

**Testing:**
- [ ] Tests unitarios para servicios del backend
- [ ] Tests de integración para API endpoints
- [ ] Tests de componentes React Native
- [ ] Tests end-to-end del flujo completo
- [ ] Testing de edge cases y errores

**Manejo de Errores:**
- [ ] Mensajes de error más descriptivos
- [ ] Recuperación automática de errores
- [ ] Logging mejorado para debugging
- [ ] Reporte de errores (opcional)

**Documentación:**
- [ ] Guía de usuario completa
- [ ] FAQ con problemas comunes
- [ ] Video tutoriales
- [ ] Documentación de la API
- [ ] Guía de contribución

**Optimización:**
- [ ] Reducir tiempos de carga
- [ ] Optimizar uso de memoria
- [ ] Mejorar rendimiento de WebSocket
- [ ] Cache de datos frecuentes

**Preparación para Producción:**
- [ ] Variables de entorno para producción
- [ ] Scripts de deployment
- [ ] Backup y recuperación
- [ ] Monitoreo y alertas

---

## Comandos Útiles

### 🚀 Inicio Rápido (TODO EN UNO):
```bash
# Iniciar backend + frontend con un solo comando
cd ~/expo-app-builder-workspace/server
./start-all-services.sh

# Después de que inicie, escanea el QR code con Expo Go
# O presiona 'a' para abrir en Android (requiere ADB)
```

### Detener Todo:
```bash
# Opción 1: Ctrl+C en la terminal donde corre Expo (detiene todo automáticamente)

# Opción 2: Script de detención
cd ~/expo-app-builder-workspace/server
./stop-all-services.sh
```

### Servidor (solo backend):
```bash
# Iniciar solo el servidor
cd ~/expo-app-builder-workspace/server
npm start

# Ver logs en tiempo real
tail -f server.log

# Detener servidor
pkill -f "node server"
```

### App (solo frontend):
```bash
# Iniciar solo la app
cd ~/expo-app-builder-workspace/app
npm start

# Presionar 'a' para abrir en Android (requiere ADB)
# Escanear QR con Expo Go (recomendado)
# Presionar 'r' para recargar
```

### EAS CLI:
```bash
# Ver builds
eas build:list

# Iniciar build manual
eas build --platform android --profile preview

# Ver proyectos
eas project:list
```

---

## Configuración del Entorno

### Servidor (.env):
```env
PORT=3001
AUTH_TOKEN=expo-builder-token-2024-secure
PROJECTS_BASE_PATH=/data/data/com.termux/files/home/app-builder-projects
NODE_ENV=development
```

### App (AsyncStorage):
- `server_url`: http://localhost:3001
- `auth_token`: expo-builder-token-2024-secure

### Versiones:
- Node.js: v25.2.1
- EAS CLI: v16.28.0
- Claude Code: v2.0.76
- Expo SDK: 54.0.0

---

## Estructura de Archivos

```
expo-app-builder-workspace/
├── ESTADO_DESARROLLO.md          # Este documento
├── CLAUDE.md                     # Guía para Claude
│
├── server/                       # Backend Node.js
│   ├── server.js                 # Entry point
│   ├── .env                      # Configuración
│   ├── start-all-services.sh     # ⭐ Script unificado de inicio
│   ├── stop-all-services.sh      # ⭐ Script de detención
│   ├── start-server.sh           # Script solo backend (legacy)
│   └── src/
│       ├── routes/
│       │   ├── projects.js
│       │   ├── claude.js
│       │   └── builds.js
│       ├── services/
│       │   ├── ProjectService.js # Auto-config EAS
│       │   ├── ClaudeService.js
│       │   └── EASService.js     # Builds
│       └── utils/
│
├── app/                          # Frontend React Native
│   ├── App.js                    # ⭐ Con health check automático
│   ├── screens/
│   │   ├── HomeScreen.js
│   │   ├── NewProjectScreen.js
│   │   ├── SettingsScreen.js
│   │   ├── ClaudeCodeScreen.js
│   │   └── BuildStatusScreen.js  # Gestión builds
│   ├── components/
│   │   ├── LoadingSpinner.js
│   │   ├── ProjectCard.js
│   │   └── ServerUnavailableScreen.js  # ⭐ Pantalla de servidor offline
│   └── services/
│       ├── api.js                # ⭐ Exporta healthCheck()
│       └── socket.js
│
└── docs/                         # Documentación
    ├── EXPO_APP_BUILDER_PLAN.md
    ├── GUIA_DESARROLLADOR.md
    └── INICIO_RAPIDO.md
```

---

## Notas Importantes

1. **Entorno Termux:** Paths específicos `/data/data/com.termux/files/home/`
2. **Servidor requerido:** Debe estar corriendo antes de usar la app
3. **Expo Go:** Necesario para desarrollo
4. **Cuenta EAS:** josejordandev
5. **Preview builds:** Sin firma (debug APK), perfecto para testing
6. **Production builds:** Requieren keystore configurado

---

## Contacto y Referencias

**Desarrollador:** josejordandev  
**Cuenta Expo:** josejordandev  
**Entorno:** Termux on Android

**Enlaces:**
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [Expo Application Services](https://expo.dev/)
- [Proyecto en EAS](https://expo.dev/accounts/josejordandev/projects/test-claude)

---

## Changelog

### 2 Enero 2026 - 11:20
- 🔧 **MEJORA DESPLIEGUE:** Sistema de despliegue basado en Git
  - Convertido `/apps/builder` de copia manual a clon git
  - Nuevo workflow: desarrollo → git push → git pull → deploy
  - Scripts de despliegue automatizados (`deploy.sh`)
  - Backup automático de configuración (.env)
  - Comandos simplificados: `cd /apps/builder && ./deploy.sh`
  - Mejor trazabilidad con commits de git
  - Rollback fácil con `git checkout`
  - Documentado en `docs/DEPLOYMENT_VPS.md`
  - Commit: Pendiente de push

### 31 Diciembre 2024 - 14:00
- 🎯 **DECISIÓN ARQUITECTÓNICA:** Migración a VPS Hetzner propio
  - Plan de migración completamente rediseñado para usar VPS en lugar de Railway
  - Builds locales con Android SDK en VPS en lugar de EAS Cloud
  - Reducción de costos: €6-10/mes vs $29/mes EAS Cloud
  - Configuración completa de Nginx, PostgreSQL, Redis en VPS
  - Instrucciones detalladas para Android SDK en Ubuntu
  - Nuevo BuildService.js para builds locales con expo build:android
  - Endpoints API para iniciar/monitorear/descargar builds
  - Job Queue con Bull para gestión de builds concurrentes
  - Timeline optimizado: 8-11 semanas (vs 9-12 semanas originales)
- 📋 **FLUJO DE TRABAJO:** Decidido modelo híbrido
  - Desarrollo local en Termux (donde ya funciona todo)
  - Deploy a VPS vía Git (push → pull)
  - VPS solo para producción y builds de Android
  - Claude Code sigue funcionando en Termux
- 📄 **DOCUMENTACIÓN:** Reorganizado planes de migración
  - Creado `PLAN_MVP_VPS.md` - Plan simplificado para uso privado (3-5 días)
  - Renombrado `PLAN_MIGRACION_CLOUD.md` → `PLAN_MULTIUSUARIO_FUTURO.md`
  - Eliminada sobreingeniería del MVP (PostgreSQL, Redis, JWT multi-usuario)
  - Actualizado `INDICE_DOCUMENTACION.md` con nuevas referencias
  - Commit: dd46282 y pusheado a GitHub

### 31 Diciembre 2024 - 14:00
- 🎯 **DECISIÓN ARQUITECTÓNICA:** Migración a VPS Hetzner propio
  - Plan de migración completamente rediseñado para usar VPS en lugar de Railway
  - Builds locales con Android SDK en VPS en lugar de EAS Cloud
  - Reducción de costos: €6-10/mes vs $29/mes EAS Cloud
  - Commit: 107eb65 y pusheado a GitHub

### 30 Diciembre 2024 - 14:50
- ✨ **Nuevo:** Sistema de auto-inicio de servicios
  - Script unificado `start-all-services.sh` inicia backend + frontend
  - Script `stop-all-services.sh` detiene todos los servicios
  - Health check automático al abrir la app
  - Nuevo componente `ServerUnavailableScreen` con UX mejorada
  - Detección inteligente de servidor con 3 reintentos
  - Botón para copiar comando y abrir Termux automáticamente
  - Un solo comando inicia todo el sistema

### 30 Diciembre 2024 - 12:44
- ✅ Phase 3 completada
- ✅ Primer build exitoso enviado a EAS
- ✅ APK descargado e instalado
- 🔧 Múltiples bugs corregidos (shadowing, fingerprint, keystore, case-sensitivity)
- 🎨 UI mejorada con banner de progreso
- 📝 Documentación actualizada

### 29 Diciembre 2024
- ✅ Phase 2 completada (Claude Code integration)
- ✅ WebSocket streaming funcionando

### Anteriores
- ✅ Phase 1 completada (Basic setup)

---

## 📍 Próximos Pasos para Continuar

### Opción 1: Implementar MVP en VPS (Recomendado) ⭐

**Objetivo:** Hacer builds de Android en tu VPS propio (3-5 días)

**Pasos:**
1. **Preparar VPS:**
   ```bash
   ssh tu-usuario@tu-vps-ip
   # Seguir FASE 1 en PLAN_MVP_VPS.md
   ```

2. **Deploy backend al VPS:**
   ```bash
   git clone https://github.com/mundodigitalpro/expo-android-builder.git
   cd expo-android-builder/server
   npm install
   pm2 start server.js
   ```

3. **Configurar Nginx + SSL**

4. **Crear LocalBuildService.js**

**Referencia:** `docs/PLAN_MVP_VPS.md`

### Opción 2: Plan Multi-Usuario (Futuro - Play Store)

**Objetivo:** Preparar la app para múltiples usuarios y Play Store

**Duración:** 8-11 semanas

**Incluye:**
- PostgreSQL + Sequelize
- JWT multi-usuario
- Redis + Bull Queues
- Rate limiting
- Security hardening

**Referencia:** `docs/PLAN_MULTIUSUARIO_FUTURO.md`

### Recomendación:

🎯 **Empezar con MVP (Opción 1)** porque:
- Solo 3-5 días vs 8-11 semanas
- Sin sobreingeniería
- Backend actual funciona sin cambios
- Puedes hacer builds de Android para ti mismo rápidamente

---

**Estado general:** 🟢 **EXCELENTE** - 3 de 5 fases completadas

**Próximo paso:** Implementar MVP en VPS (FASE 1 de PLAN_MVP_VPS.md) 🚀
