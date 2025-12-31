# Plan de Migración: Expo Android Builder - De Localhost a Cloud Multi-Usuario

## Resumen Ejecutivo

**Objetivo**: Transformar Expo App Builder de una herramienta local Termux/localhost a una app Android standalone con backend en la nube que soporte múltiples usuarios.

**Contexto**:
- **Estado actual**: App funcional (60% completada) que corre en Termux con backend Node.js local
- **Visión**: App híbrida standalone que mantiene funcionalidad de Project Builder, con backend remoto en cloud
- **Distribución**: APK firmado para distribución directa (Google Play Store en el futuro)

---

## Transformación Arquitectónica

### Arquitectura Actual (Localhost)
```
┌─────────────────────────────────┐
│  TERMUX (mismo dispositivo)     │
│                                 │
│  React Native ←→ Node.js Server │
│  (Expo Go)      (localhost:3001)│
│                      ↓           │
│                 CLI Tools        │
│                 (local FS)       │
└─────────────────────────────────┘
```

### Arquitectura Objetivo (Cloud Multi-Usuario)
```
┌──────────────┐         ┌─────────────────────────────┐
│ Standalone   │ HTTPS   │  Cloud Backend              │
│ APK          │────────→│  (Railway/Render/AWS)       │
│              │  WSS    │  ┌──────────────────────┐   │
│ Auth: JWT    │         │  │ Node.js + Socket.io  │   │
│ User: UUID   │         │  └──────┬───────────────┘   │
└──────────────┘         │         ↓                    │
                         │  ┌──────────────────────┐   │
                         │  │ PostgreSQL/MongoDB   │   │
                         │  │ - Users              │   │
                         │  │ - Projects (por user)│   │
                         │  │ - Builds             │   │
                         │  └──────────────────────┘   │
                         │  ┌──────────────────────┐   │
                         │  │ CLI Tools            │   │
                         │  │ Storage: S3 o FS     │   │
                         │  └──────────────────────┘   │
                         └─────────────────────────────┘
```

**Cambios clave**:
- ❌ Eliminar dependencia de Termux para usuarios finales
- ✅ Backend desplegado en cloud (accesible vía internet)
- ✅ Multi-usuario con autenticación JWT
- ✅ APK standalone (no requiere Expo Go)
- ✅ Proyectos aislados por usuario

---

## Plan de Implementación por Fases

### **FASE 1: Backend - Autenticación y Base de Datos** (2-3 semanas)

#### 1.1 Setup de Base de Datos

**Tecnología recomendada**: PostgreSQL con Sequelize ORM

**Schema**:
```sql
-- Tabla de usuarios
users (id UUID, email, password_hash, username, created_at, plan)

-- Tabla de proyectos (con FK a users)
projects (id UUID, user_id FK, name, template, path, metadata JSONB, created_at)
  UNIQUE(user_id, name)

-- Tabla de sesiones (Claude/Build)
sessions (id UUID, user_id FK, project_id FK, session_type, status, metadata)

-- Tabla de builds
builds (id UUID, project_id FK, user_id FK, platform, eas_build_id, status, download_url)
```

**Dependencias a instalar**:
```bash
cd server
npm install pg sequelize bcryptjs jsonwebtoken express-rate-limit express-validator helmet
```

#### 1.2 Sistema de Autenticación JWT

**Archivos a crear**:

1. **`server/src/models/User.js`** - Modelo Sequelize de usuario
2. **`server/src/models/Project.js`** - Modelo de proyecto (linked to user)
3. **`server/src/services/AuthService.js`** - Lógica de registro/login/JWT
4. **`server/src/routes/auth.js`** - Endpoints: `/register`, `/login`, `/refresh`

**Archivo a MODIFICAR**:

**`server/src/middleware/auth.js`** - Reemplazar completamente:
```javascript
// ACTUAL (línea 14): if (token !== AUTH_TOKEN)
// NUEVO: JWT verification con database lookup

const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(403).json({ error: 'Invalid user' });
    }

    req.user = user; // ← Agregar usuario al request
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};
```

#### 1.3 Multi-Usuario en ProjectService

**Archivo a MODIFICAR**: `server/src/services/ProjectService.js`

**Cambios críticos**:
```javascript
// ANTES:
createProject(projectName, template)
  → projectPath = /projects/{projectName}

// DESPUÉS:
createProject(userId, projectName, template)
  → projectPath = /projects/{userId}/{projectName}
  → Guardar en DB: Project.create({ userId, name, template, path })
  → Verificar quota: if (userProjectCount >= MAX_PROJECTS_PER_USER) throw Error

listProjects()
  → ANTES: Listaba todos los proyectos
  → DESPUÉS: listProjects(userId) → Filtrar por userId

deleteProject(projectName)
  → DESPUÉS: deleteProject(userId, projectName) → Verificar ownership
```

#### 1.4 Configuración de Entorno

**Actualizar `server/.env`**:
```bash
# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/expo_builder

# JWT
JWT_SECRET=your-super-secret-key-minimum-32-characters

# Server
PORT=3001
NODE_ENV=production
HOST=0.0.0.0  # ← Para cloud deployment

# Proyectos
PROJECTS_BASE_PATH=/var/app/projects
MAX_PROJECTS_PER_USER=10

# Rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

### **FASE 2: Cloud Deployment** (1-2 semanas)

#### 2.1 Plataforma de Deployment

**Recomendación**: Railway (opción más fácil)

**Alternativas**:
- Render (tier gratuito disponible)
- AWS EC2 + RDS (más control, más complejo)
- DigitalOcean App Platform (balance)

**Por qué Railway**:
- PostgreSQL incluido
- Variables de entorno fáciles
- HTTPS/WSS automático
- Deploy desde Git
- ~$20/mes

#### 2.2 Configuración de Deployment

**Crear archivos**:

1. **`server/railway.json`**:
```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

2. **`server/Procfile`** (alternativa):
```
web: npm start
```

**Modificar `server/server.js`** (línea 53):
```javascript
// ANTES:
server.listen(PORT, () => {

// DESPUÉS:
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  logger.info(`Server started on ${HOST}:${PORT}`);
```

#### 2.3 Inicialización de DB en Startup

**Agregar a `server/server.js`** (después de línea 13):
```javascript
const { sequelize } = require('./src/models');

// Sincronizar DB al iniciar
sequelize.authenticate()
  .then(() => logger.info('✅ Database connected'))
  .catch(err => logger.error('❌ Database connection failed', err));

// En desarrollo: sync models
if (process.env.NODE_ENV === 'development') {
  sequelize.sync({ alter: true });
}
```

#### 2.4 Security Hardening

**Agregar a `server/server.js`** (antes de línea 23):
```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api/', apiLimiter);
```

---

### **FASE 3: Frontend - Autenticación y Cloud Connectivity** (2-3 semanas)

#### 3.1 Screens de Autenticación

**Archivos a CREAR**:

1. **`app/screens/LoginScreen.js`**:
```javascript
export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    try {
      const response = await axios.post(
        `${await storage.getServerUrl()}/api/auth/login`,
        { email, password }
      );

      await storage.setAuthToken(response.data.token);
      await storage.setUserId(response.data.user.id);
      navigation.replace('Home');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Login failed');
    }
  };

  return (
    <View>
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Iniciar Sesión" onPress={handleLogin} />
      <Button title="¿No tienes cuenta? Regístrate" onPress={() => navigation.navigate('Register')} />
    </View>
  );
}
```

2. **`app/screens/RegisterScreen.js`** - Similar estructura

#### 3.2 Navigation con Autenticación

**Archivo a MODIFICAR**: `app/App.js`

**Cambios**:
```javascript
// DESPUÉS de línea 22, agregar:
const [isAuthenticated, setIsAuthenticated] = useState(null);

// EN initializeApp() (línea 28-50), REEMPLAZAR verificación:
const initializeApp = async () => {
  try {
    // 1. Configurar defaults
    const token = await storage.getAuthToken();
    const serverUrl = await storage.getServerUrl();

    if (!serverUrl) {
      // ⚠️ CAMBIO CRÍTICO: Default a cloud URL
      await storage.setServerUrl('https://api.expo-builder.com');
    }

    // 2. Si hay token, verificar validez
    if (token) {
      try {
        await axios.get(
          `${await storage.getServerUrl()}/api/auth/verify`,
          { headers: { Authorization: `Bearer ${token}` }}
        );
        setIsAuthenticated(true);
        await checkServerAvailability();
      } catch (error) {
        // Token inválido
        setIsAuthenticated(false);
      }
    } else {
      setIsAuthenticated(false);
    }

    setIsReady(true);
  } catch (error) {
    console.error('Error initializing app:', error);
    setIsReady(true);
  }
};

// EN return (línea 82-100), AGREGAR condicional:
return (
  <NavigationContainer>
    <Stack.Navigator>
      {!isAuthenticated ? (
        // Stack de Autenticación
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        // Stack de App (existente)
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="NewProject" component={NewProjectScreen} />
          {/* ... resto de screens ... */}
        </>
      )}
    </Stack.Navigator>
  </NavigationContainer>
);
```

#### 3.3 API Client con Cloud Support

**Archivo a MODIFICAR**: `app/services/api.js`

**Cambios críticos**:
```javascript
// ELIMINAR hardcoded baseURL
// AGREGAR función dinámica:

const getBaseURL = async () => {
  const serverUrl = await storage.getServerUrl();
  return `${serverUrl}/api`;
};

// ACTUALIZAR interceptor (líneas existentes):
api.interceptors.request.use(async (config) => {
  config.baseURL = await getBaseURL(); // ← Dinámico

  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// AGREGAR manejo de 401:
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Token expirado - logout
      await AsyncStorage.removeItem('auth_token');
      // TODO: Navegar a Login
    }
    return Promise.reject(error);
  }
);
```

#### 3.4 Storage Utils para User ID

**Archivo a MODIFICAR**: `app/utils/storage.js`

**Agregar**:
```javascript
async setUserId(userId) {
  await AsyncStorage.setItem('user_id', userId);
},

async getUserId() {
  return await AsyncStorage.getItem('user_id');
},

async clearAuth() {
  await AsyncStorage.multiRemove(['auth_token', 'user_id']);
}
```

#### 3.5 HomeScreen - Logout Button

**Archivo a MODIFICAR**: `app/screens/HomeScreen.js`

**Agregar botón de logout** en header:
```javascript
useEffect(() => {
  navigation.setOptions({
    headerRight: () => (
      <Button
        title="Cerrar Sesión"
        onPress={async () => {
          await storage.clearAuth();
          navigation.replace('Login');
        }}
      />
    ),
  });
}, [navigation]);
```

---

### **FASE 4: Standalone APK Configuration** (1 semana)

#### 4.1 Actualizar app.json

**Archivo a MODIFICAR**: `app/app.json`

```json
{
  "expo": {
    "name": "Expo Builder",
    "slug": "expo-builder",
    "version": "1.0.0",
    "owner": "josejordandev",

    "android": {
      "package": "com.josejordandev.expobuilder",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#007AFF"
      },
      "permissions": ["INTERNET", "ACCESS_NETWORK_STATE"]
    },

    "extra": {
      "apiUrl": "https://api.expo-builder.com",
      "eas": {
        "projectId": "your-project-id-from-eas"
      }
    }
  }
}
```

#### 4.2 Crear eas.json

**Archivo a CREAR**: `app/eas.json`

```json
{
  "cli": {
    "version": ">= 7.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "env": {
        "API_URL": "https://api.expo-builder.com"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "env": {
        "API_URL": "https://api.expo-builder.com"
      }
    }
  }
}
```

#### 4.3 Comandos de Build

```bash
# 1. Inicializar EAS (una vez)
cd app
eas init

# 2. Configurar credentials
eas credentials

# 3. Build preview APK
eas build --platform android --profile preview

# 4. Build production AAB (para Play Store futuro)
eas build --platform android --profile production
```

---

### **FASE 5: Security & Rate Limiting** (1 semana)

#### 5.1 WebSocket Authentication

**Archivo a MODIFICAR**: `server/server.js`

**Agregar antes de `io.on('connection')` (línea 39)**:
```javascript
// WebSocket authentication
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return next(new Error('Invalid user'));
    }

    socket.userId = user.id; // ← Attach userId to socket
    next();
  } catch (error) {
    next(new Error('Authentication failed'));
  }
});

io.on('connection', (socket) => {
  logger.info('Client connected', {
    socketId: socket.id,
    userId: socket.userId // ← Log userId
  });

  // ... resto del código
});
```

**Frontend** - Actualizar `app/services/socket.js`:
```javascript
connect(serverUrl) {
  const token = await AsyncStorage.getItem('auth_token');

  this.socket = io(serverUrl, {
    auth: { token } // ← Enviar token
  });
}
```

#### 5.2 Input Validation

**Crear**: `server/src/middleware/validation.js`

```javascript
const { body, validationResult } = require('express-validator');

const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)/),
  body('username').isLength({ min: 3, max: 20 }).isAlphanumeric(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

module.exports = { validateRegistration };
```

---

### **FASE 6: Job Queues para CLI Tools** (2 semanas)

#### 6.1 Setup de Redis y Bull

```bash
cd server
npm install bull redis
```

**Crear**: `server/src/services/QueueService.js`

```javascript
const Queue = require('bull');

const projectQueue = new Queue('project-creation', {
  redis: process.env.REDIS_URL
});

const buildQueue = new Queue('eas-builds', {
  redis: process.env.REDIS_URL
});

// Worker para crear proyectos
projectQueue.process(async (job) => {
  const { userId, projectName, template } = job.data;

  job.progress(10);
  const project = await ProjectService.createProject(userId, projectName, template);
  job.progress(100);

  return project;
});

// Notificar via WebSocket cuando complete
projectQueue.on('completed', (job, result) => {
  io.to(job.data.userId).emit('project:created', result);
});

module.exports = { projectQueue, buildQueue };
```

#### 6.2 Modificar ProjectService para usar Queue

**Archivo a MODIFICAR**: `server/src/services/ProjectService.js`

```javascript
// En vez de ejecutar directamente:
async createProject(userId, projectName, template) {
  // Agregar a queue en vez de ejecutar inmediatamente
  const job = await projectQueue.add({
    userId,
    projectName,
    template
  });

  return {
    message: 'Project creation queued',
    jobId: job.id
  };
}
```

---

## Archivos Críticos por Fase

### FASE 1 - Backend Auth (ALTA PRIORIDAD)
1. ⚠️ **`server/src/middleware/auth.js`** - Reemplazo completo
2. ⚠️ **`server/src/services/ProjectService.js`** - Agregar userId a todos los métodos
3. 📝 **`server/src/models/User.js`** - CREAR
4. 📝 **`server/src/services/AuthService.js`** - CREAR
5. 📝 **`server/src/routes/auth.js`** - CREAR

### FASE 2 - Cloud Deployment (ALTA PRIORIDAD)
1. ⚠️ **`server/server.js`** - Agregar DB init, cambiar bind host
2. 📝 **`server/railway.json`** - CREAR
3. ⚠️ **`server/.env`** - Actualizar con nuevas variables

### FASE 3 - Frontend Auth (ALTA PRIORIDAD)
1. ⚠️ **`app/App.js`** - Agregar auth flow y navigation condicional
2. ⚠️ **`app/services/api.js`** - Remover localhost, agregar manejo 401
3. 📝 **`app/screens/LoginScreen.js`** - CREAR
4. 📝 **`app/screens/RegisterScreen.js`** - CREAR
5. ⚠️ **`app/utils/storage.js`** - Agregar userId methods

### FASE 4 - APK Config (MEDIA PRIORIDAD)
1. ⚠️ **`app/app.json`** - Actualizar con package, permissions
2. 📝 **`app/eas.json`** - CREAR

### FASE 5 - Security (MEDIA PRIORIDAD)
1. ⚠️ **`server/server.js`** - WebSocket auth
2. 📝 **`server/src/middleware/validation.js`** - CREAR

### FASE 6 - Queues (BAJA PRIORIDAD - Optimización)
1. 📝 **`server/src/services/QueueService.js`** - CREAR
2. ⚠️ **`server/src/services/ProjectService.js`** - Integrar queue

**Leyenda**:
- ⚠️ = Modificar archivo existente
- 📝 = Crear archivo nuevo

---

## Timeline Estimado

| Fase | Duración | Puede empezar |
|------|----------|---------------|
| Fase 1: Backend Auth & DB | 2-3 semanas | Inmediatamente |
| Fase 2: Cloud Deployment | 1-2 semanas | Después Fase 1 |
| Fase 3: Frontend Auth | 2-3 semanas | Paralelo con Fase 1 |
| Fase 4: APK Config | 1 semana | Después Fase 3 |
| Fase 5: Security | 1 semana | Después Fase 2 |
| Fase 6: Job Queues | 2 semanas | Después Fase 2 |

**Total estimado**: 9-12 semanas (2-3 meses)

**Nota**: Fases 1 y 3 pueden desarrollarse en paralelo (backend y frontend teams separados).

---

## Stack Tecnológico

### Backend
- **Database**: PostgreSQL + Sequelize ORM
- **Auth**: jsonwebtoken + bcryptjs
- **Job Queue**: Bull + Redis
- **Security**: helmet, express-rate-limit, express-validator
- **Deployment**: Railway (recomendado) o Render

### Frontend
- **React Native**: Expo SDK 54 (existente)
- **Navigation**: React Navigation (existente)
- **Storage**: AsyncStorage (existente)
- **HTTP**: Axios (existente)
- **WebSocket**: socket.io-client (existente)

### Infrastructure
- **Hosting**: Railway ($20/mes incluye Postgres y Redis)
- **Storage**: Filesystem del servidor inicialmente, S3 para escalar
- **SSL**: Automático (Railway/Render)
- **Monitoring**: Sentry para errores

---

## Riesgos y Mitigaciones

### 🔴 Riesgo Alto: CLI Tools en Cloud
**Problema**: Expo CLI, EAS CLI pueden no funcionar en containers
**Mitigación**:
- Probar en Docker local primero
- Alternativa: Usar Expo web API en vez de CLI
- Job queue para evitar conflictos

### 🟡 Riesgo Medio: Costos de Storage
**Problema**: Proyectos pueden consumir mucho espacio
**Mitigación**:
- Quota de 500MB por proyecto
- Auto-delete proyectos inactivos (30 días)
- Comprimir archivos

### 🟡 Riesgo Medio: Build Queue Bottleneck
**Problema**: Múltiples usuarios building simultáneamente
**Mitigación**:
- Job queue con límite de concurrencia
- Mostrar posición en queue
- EAS Build maneja la infraestructura de builds

### 🟢 Riesgo Bajo: Migración de Datos
**Problema**: Perder proyectos existentes de Termux
**Mitigación**:
- Export/import tool
- Usuarios mantienen copia local
- Modo dual (cloud + local) opcional

---

## Próximos Pasos Inmediatos

### 1. Setup Inicial (Día 1)
```bash
# Railway
railway login
railway init
railway add --database postgres

# O Render
# Crear cuenta, conectar GitHub, agregar Postgres
```

### 2. Backend Auth (Semana 1)
- Crear modelos User, Project
- Implementar AuthService
- Modificar auth middleware
- Crear endpoints /auth/register, /auth/login

### 3. Testing Local (Semana 2)
- Probar registro/login localmente
- Verificar JWT generation/verification
- Probar multi-usuario con Postman

### 4. Deploy a Cloud (Semana 3)
- Push a Railway/Render
- Configurar env variables
- Verificar health endpoint
- Probar desde móvil

### 5. Frontend Auth Screens (Semana 4-5)
- Crear LoginScreen, RegisterScreen
- Modificar App.js navigation
- Actualizar api.js

### 6. Primera Build APK (Semana 6)
- Configurar eas.json
- `eas build --platform android --profile preview`
- Instalar y probar en dispositivo real

---

## Conclusión

Este plan transforma Expo App Builder de una herramienta local Termux a una app Android standalone con backend cloud multi-usuario, manteniendo toda la funcionalidad existente pero haciéndola accesible para usuarios que no usan Termux.

**Enfoque incremental**: Cada fase agrega valor sin romper funcionalidad existente.

**Resultado final**: APK firmado distribuible que conecta a backend cloud, soporta múltiples usuarios, y mantiene capacidades de Project Builder.
