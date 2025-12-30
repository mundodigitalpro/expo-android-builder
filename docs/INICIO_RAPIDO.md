# Expo App Builder - Inicio Rápido

## Resumen

Has creado exitosamente un sistema completo para construir apps Expo desde tu móvil Android con integración de Claude Code.

## Componentes Creados

### 1. Servidor Backend (Node.js + Express)
**Ubicación**: `/data/data/com.termux/files/home/expo-app-builder-server/`

**Características**:
- API REST para gestión de proyectos
- WebSocket para comunicación en tiempo real
- Ejecución segura de comandos CLI
- Autenticación con token

### 2. App React Native (Expo)
**Ubicación**: `/data/data/com.termux/files/home/projects/expo-app-builder/`

**Pantallas**:
- HomeScreen: Lista de proyectos
- NewProjectScreen: Crear nuevos proyectos
- SettingsScreen: Configuración

## Cómo Usar

### Paso 1: Iniciar el Servidor

Opción A - Con script:
```bash
/data/data/com.termux/files/home/expo-app-builder-server/start-server.sh
```

Opción B - Manualmente:
```bash
cd /data/data/com.termux/files/home/expo-app-builder-server
npm start
```

Deberías ver:
```
🚀 Server running on http://localhost:3001
📡 WebSocket ready for connections
🔑 Auth token: expo-builder-token-2024-secure
```

### Paso 2: Iniciar la App

En otra sesión de Termux (o en un nuevo tab):

```bash
cd /data/data/com.termux/files/home/projects/expo-app-builder
npm start
```

### Paso 3: Usar la App

1. La app se abrirá mostrando la lista de proyectos (vacía inicialmente)
2. Presiona el botón "+" para crear un nuevo proyecto
3. Ingresa un nombre (ej: "mi-primera-app")
4. El servidor creará el proyecto en `/data/data/com.termux/files/home/app-builder-projects/`
5. Verás el nuevo proyecto en la lista

## Configuración

La app viene pre-configurada con:
- **URL del Servidor**: http://localhost:3001
- **Token**: expo-builder-token-2024-secure

Puedes cambiar estos valores en la pantalla de Configuración (ícono ⚙️).

## Estructura de Proyectos

Los proyectos creados se guardan en:
```
/data/data/com.termux/files/home/app-builder-projects/
├── proyecto-1/
├── proyecto-2/
└── proyecto-3/
```

Cada proyecto es un proyecto Expo completo que puedes:
- Editar con Claude Code
- Ejecutar con `expo start`
- Construir con EAS Build

## Próximas Funcionalidades (Plan de Desarrollo)

### Fase 2: Integración Claude Code
- Chat interface en la app
- Ejecutar comandos de Claude Code
- Ver respuestas en tiempo real

### Fase 3: EAS Build
- Iniciar builds desde la app
- Monitor de progreso
- Descargar APKs

### Fase 4 y 5: Refinamiento
- Mejoras de UI/UX
- Testing completo
- Optimizaciones

## Plan Completo

El plan detallado de todas las fases está guardado en:
```
/data/data/com.termux/files/home/EXPO_APP_BUILDER_PLAN.md
```

## Comandos Útiles

### Servidor

```bash
# Iniciar servidor
npm start

# Ver logs
tail -f /data/data/com.termux/files/home/expo-app-builder-server/logs.txt

# Detener servidor (si usaste el script)
kill $(cat /data/data/com.termux/files/home/expo-app-builder-server/server.pid)
```

### App

```bash
# Instalar dependencias
npm install

# Iniciar app
npm start

# Ejecutar en Android
npm run android

# Limpiar cache
npm start --clear
```

### Proyectos Creados

```bash
# Listar proyectos
ls -la /data/data/com.termux/files/home/app-builder-projects/

# Entrar a un proyecto
cd /data/data/com.termux/files/home/app-builder-projects/mi-proyecto

# Iniciar un proyecto
expo start
```

## Solución de Problemas

### El servidor no inicia
- Verifica que el puerto 3001 esté libre: `lsof -i :3001`
- Mata procesos anteriores: `pkill -f "node server"`
- Revisa el archivo .env

### La app no se conecta al servidor
- Verifica que el servidor esté corriendo
- Ve a Configuración y presiona "Verificar Conexión"
- Revisa que el token sea correcto

### No puedo crear proyectos
- Verifica que el servidor tenga permisos
- Revisa los logs del servidor
- Asegúrate de que Expo CLI esté instalado: `npm install -g expo-cli`

## Arquitectura

```
┌─────────────────────┐
│   React Native App  │
│   (Tu Móvil)        │
└──────────┬──────────┘
           │ HTTP/WebSocket
           │ localhost:3001
┌──────────▼──────────┐
│   Node.js Server    │
│   (Termux)          │
└──────────┬──────────┘
           │ spawn
    ┌──────┴──────┬─────────┐
    │             │         │
┌───▼───┐   ┌────▼────┐  ┌─▼──────┐
│ Expo  │   │ Claude  │  │  Git   │
│  CLI  │   │  Code   │  │  CLI   │
└───────┘   └─────────┘  └────────┘
```

## Estado Actual

✅ **Fase 1 COMPLETADA** - Setup Básico

- [x] Servidor Express con API REST
- [x] App React Native con navegación
- [x] Crear proyectos Expo
- [x] Listar proyectos
- [x] Eliminar proyectos
- [x] Configuración de servidor
- [x] Documentación completa

## Siguientes Pasos

1. Probar creando varios proyectos
2. Familiarizarte con la interface
3. Revisar el plan completo para las próximas fases
4. Planificar la implementación de Fase 2 (Claude Code)

## Recursos

- Plan completo: `/data/data/com.termux/files/home/EXPO_APP_BUILDER_PLAN.md`
- README App: `/data/data/com.termux/files/home/projects/expo-app-builder/README.md`
- README Server: `/data/data/com.termux/files/home/expo-app-builder-server/README.md`

---

**Creado**: 29 de Diciembre, 2024
**Versión**: 1.0.0 (Fase 1)
**Desarrollado con**: Claude Code
