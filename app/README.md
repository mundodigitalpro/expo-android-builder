# Expo App Builder

Una aplicación móvil Android que permite crear y gestionar proyectos Expo con integración de Claude Code.

## Características

- **Crear Proyectos Expo**: Genera nuevos proyectos con template blank
- **Gestión Visual**: Interface intuitiva para ver y administrar proyectos
- **Integración Claude Code**: (Próximamente) Interactúa con Claude Code desde la app
- **EAS Build**: (Próximamente) Construye APKs directamente desde la app

## Arquitectura

La aplicación utiliza una arquitectura híbrida:

- **Frontend**: React Native + Expo (esta app)
- **Backend**: Node.js + Express (servidor en Termux)
- **Comunicación**: HTTP REST API + WebSocket

## Requisitos

- Termux instalado en Android
- Node.js
- Expo CLI
- Servidor backend corriendo (ver instrucciones abajo)

## Instalación

### 1. Instalar dependencias

```bash
cd /data/data/com.termux/files/home/projects/expo-app-builder
npm install
```

### 2. Iniciar el servidor backend

En otra sesión de Termux:

```bash
cd /data/data/com.termux/files/home/expo-app-builder-server
npm start
```

O usar el script:

```bash
/data/data/com.termux/files/home/expo-app-builder-server/start-server.sh
```

### 3. Iniciar la app

```bash
cd /data/data/com.termux/files/home/projects/expo-app-builder
npm start
```

## Configuración

La app requiere configuración del servidor en la pantalla de Configuración:

- **URL del Servidor**: http://localhost:3001
- **Token de Autenticación**: expo-builder-token-2024-secure

Estos valores están pre-configurados por defecto.

## Estructura del Proyecto

```
expo-app-builder/
├── App.js                    # Punto de entrada con navegación
├── screens/                  # Pantallas de la app
│   ├── HomeScreen.js        # Lista de proyectos
│   ├── NewProjectScreen.js  # Crear nuevo proyecto
│   └── SettingsScreen.js    # Configuración
├── components/              # Componentes reutilizables
│   ├── ProjectCard.js       # Card de proyecto
│   └── LoadingSpinner.js    # Spinner de carga
├── services/                # Servicios de la app
│   └── api.js              # Cliente HTTP
└── utils/                   # Utilidades
    ├── storage.js          # AsyncStorage wrapper
    └── validators.js       # Validadores
```

## API Endpoints

### Proyectos

- `GET /api/projects` - Listar todos los proyectos
- `POST /api/projects` - Crear nuevo proyecto
- `GET /api/projects/:name` - Obtener info de proyecto
- `DELETE /api/projects/:name` - Eliminar proyecto

### Health Check

- `GET /health` - Verificar estado del servidor

## Próximas Funcionalidades (Fases 2-5)

- [ ] Chat interface con Claude Code
- [ ] Streaming de respuestas en tiempo real
- [ ] Integración con EAS Build
- [ ] Monitor de builds
- [ ] Descarga de APKs generados

## Plan Completo

Ver el plan detallado de implementación en:
`/data/data/com.termux/files/home/EXPO_APP_BUILDER_PLAN.md`

## Versión

1.0.0 - Fase 1 Completada (Setup Básico)

## Licencia

MIT

---

Creado con Claude Code
