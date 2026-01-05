# Expo App Builder Server

Backend Node.js para la aplicación Expo App Builder. Proporciona API REST y WebSocket para gestionar proyectos Expo.

## Características

- API REST para gestión de proyectos Expo
- Ejecución segura de comandos CLI
- WebSocket para comunicación en tiempo real
- Autenticación con token
- Validación de comandos y paths

## Requisitos

- Node.js 14+
- npm
- Expo CLI instalado globalmente
- Claude Code CLI (para funcionalidades futuras)

## Instalación

```bash
cd /data/data/com.termux/files/home/expo-android-builder/server
npm install
```

## Configuración

Edita el archivo `.env`:

```bash
PORT=3001
AUTH_TOKEN=expo-builder-token-2024-secure
PROJECTS_BASE_PATH=/data/data/com.termux/files/home/app-builder-projects
NODE_ENV=development
```

## Uso

### Iniciar servidor

```bash
npm start
```

O usar el script:

```bash
./start-server.sh
```

### Detener servidor

Si usaste el script:

```bash
kill $(cat server.pid)
```

## Estructura

```
server/
├── server.js                # Punto de entrada
├── src/
│   ├── config/
│   │   └── constants.js    # Configuración y constantes
│   ├── routes/
│   │   └── projects.js     # Rutas de proyectos
│   ├── services/
│   │   └── ProjectService.js  # Lógica de negocio
│   ├── utils/
│   │   ├── executor.js     # Ejecución segura de comandos
│   │   ├── validator.js    # Validación de inputs
│   │   └── logger.js       # Sistema de logs
│   └── middleware/
│       ├── auth.js         # Autenticación
│       └── errorHandler.js # Manejo de errores
└── .env                    # Variables de entorno
```

## API Endpoints

### Health Check

```bash
GET /health
```

Respuesta:
```json
{
  "status": "ok",
  "timestamp": "2024-12-29T...",
  "uptime": 123.45
}
```

### Proyectos

#### Listar proyectos

```bash
GET /api/projects
Headers: Authorization: Bearer {token}
```

#### Crear proyecto

```bash
POST /api/projects
Headers: Authorization: Bearer {token}
Body: {
  "projectName": "mi-app",
  "template": "blank"
}
```

#### Obtener proyecto

```bash
GET /api/projects/:projectName
Headers: Authorization: Bearer {token}
```

#### Eliminar proyecto

```bash
DELETE /api/projects/:projectName
Headers: Authorization: Bearer {token}
```

## Seguridad

- Autenticación basada en token
- Validación de comandos permitidos
- Sanitización de paths para prevenir traversal
- Limitación de operaciones permitidas

## Comandos Permitidos

- `npx create-expo-app`
- `claude code`
- `eas build`
- `git init`
- `git add`
- `git commit`
- `npm install`

## Logs

Los logs se imprimen en formato JSON con:
- timestamp
- level (INFO, ERROR, WARN, DEBUG)
- message
- metadata adicional

## WebSocket

El servidor soporta conexiones WebSocket en el mismo puerto para:
- Streaming de output de Claude Code (futuro)
- Logs de builds en tiempo real (futuro)
- Notificaciones (futuro)

## Desarrollo

```bash
npm run dev
```

## Versión

1.0.0 - Fase 1 Completada

## Licencia

MIT
