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

### Arquitectura Objetivo (Cloud Multi-Usuario con VPS Hetzner)
```
┌──────────────┐         ┌─────────────────────────────────────┐
│ Standalone   │ HTTPS   │  Hetzner VPS                        │
│ APK          │────────→│  (Ubuntu 22.04 LTS)                 │
│              │  WSS    │                                     │
│ Auth: JWT    │         │  ┌─────────────────────────┐        │
│ User: UUID   │         │  │ Nginx (Reverse Proxy)   │        │
└──────────────┘         │  │ + SSL (Let's Encrypt)   │        │
                         │  └──────────┬──────────────┘        │
                         │             ↓                        │
                         │  ┌──────────────────────┐           │
                         │  │ Node.js + Socket.io  │           │
                         │  │ (PM2 process manager)│           │
                         │  └──────┬───────────────┘           │
                         │         ↓                            │
                         │  ┌──────────────────────┐           │
                         │  │ PostgreSQL           │           │
                         │  │ - Users              │           │
                         │  │ - Projects (por user)│           │
                         │  │ - Builds             │           │
                         │  └──────────────────────┘           │
                         │  ┌──────────────────────┐           │
                         │  │ Redis (Bull Queues)  │           │
                         │  │ - Build jobs         │           │
                         │  │ - Project creation   │           │
                         │  └──────────────────────┘           │
                         │  ┌──────────────────────┐           │
                         │  │ Android SDK          │           │
                         │  │ - expo build:android │           │
                         │  │ - Local builds       │           │
                         │  │ Storage: Filesystem  │           │
                         │  └──────────────────────┘           │
                         └─────────────────────────────────────┘
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

### **FASE 2: Deployment en Hetzner VPS** (1 semana)

#### 2.1 Configuración del VPS

**Plataforma**: Hetzner VPS (servidor dedicado propio)

**Ventajas de usar VPS propio**:
- Control total del servidor y builds
- Mejor costo (€5-10/mes vs $29/mes EAS)
- Builds ilimitados sin restricciones
- No depender de servicios externos
- Datos y proyectos bajo tu control
- Ubicación en Europa (buena latencia)

**Requisitos del VPS**:
- **CPU**: 2-4 vCPUs (para builds de Android)
- **RAM**: 4-8GB (builds requieren memoria)
- **Storage**: 40-80GB SSD
- **OS**: Ubuntu 22.04 LTS
- **Ancho de banda**: Suficiente para descargas de APK

#### 2.2 Dependencias del Sistema

**Verificar/Instalar Node.js**:
```bash
# Verificar versión (necesitas Node 18+)
node -v

# Si no está instalado o versión antigua:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**Instalar PostgreSQL** (si no lo tienes):
```bash
sudo apt install -y postgresql postgresql-contrib

# Crear base de datos
sudo -u postgres psql
CREATE DATABASE expo_builder;
CREATE USER expo_user WITH PASSWORD 'tu-password-segura';
GRANT ALL PRIVILEGES ON DATABASE expo_builder TO expo_user;
\q
```

**Instalar Redis** (para job queues):
```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

**Instalar Nginx** (reverse proxy):
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

**Instalar PM2** (process manager para Node.js):
```bash
sudo npm install -g pm2
```

#### 2.3 Configurar Android SDK en VPS

**Para hacer builds de Android en el VPS, necesitas Android SDK**:

```bash
# Instalar Java JDK 17 (requerido por Android)
sudo apt install -y openjdk-17-jdk

# Verificar instalación
java -version

# Descargar Android Command Line Tools
cd /opt
sudo wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
sudo unzip commandlinetools-linux-9477386_latest.zip -d android-sdk
sudo rm commandlinetools-linux-9477386_latest.zip

# Configurar variables de entorno
echo 'export ANDROID_HOME=/opt/android-sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc

# Aceptar licencias
yes | sdkmanager --licenses

# Instalar build tools y platform
sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0"
```

#### 2.4 Deployment del Backend

**Clonar/Subir el código al VPS**:
```bash
# Opción 1: Clonar desde GitHub
cd /home/tu-usuario
git clone https://github.com/tu-usuario/expo-android-builder.git
cd expo-android-builder/server

# Opción 2: Subir desde Termux usando rsync
# (desde Termux):
# rsync -avz ~/expo-android-builder/ usuario@tu-vps-ip:/home/usuario/expo-android-builder/
```

**Configurar variables de entorno**:
```bash
# Crear .env en el servidor
cd /home/tu-usuario/expo-android-builder/server
nano .env

# Agregar:
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
DATABASE_URL=postgresql://expo_user:tu-password@localhost:5432/expo_builder
REDIS_URL=redis://localhost:6379
JWT_SECRET=tu-clave-secreta-minimo-32-caracteres
PROJECTS_BASE_PATH=/home/tu-usuario/app-builder-projects
MAX_PROJECTS_PER_USER=10
```

**Instalar dependencias**:
```bash
cd /home/tu-usuario/expo-android-builder/server
npm install --production
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

**Iniciar con PM2**:
```bash
# Iniciar servidor
pm2 start server.js --name expo-builder-api

# Guardar configuración PM2
pm2 save
pm2 startup
```

#### 2.5 Configurar Nginx como Reverse Proxy

**Crear archivo de configuración Nginx**:
```bash
sudo nano /etc/nginx/sites-available/expo-builder
```

**Contenido**:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # O IP del VPS

    # Límite de tamaño de upload (para APKs)
    client_max_body_size 100M;

    # API REST
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket (para Socket.io)
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001;
    }
}
```

**Activar sitio**:
```bash
sudo ln -s /etc/nginx/sites-available/expo-builder /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 2.6 SSL con Let's Encrypt (Opcional pero recomendado)

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com

# Auto-renovación (ya configurada automáticamente)
sudo certbot renew --dry-run
```

#### 2.7 Inicialización de DB en Startup

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

#### 2.8 Security Hardening

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

**Configurar firewall UFW**:
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
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

### **FASE 4: Builds de Android en VPS** (1 semana)

#### 4.1 Configurar Expo para Builds Locales

**Actualizar `app/app.json`**:

```json
{
  "expo": {
    "name": "Expo Builder",
    "slug": "expo-builder",
    "version": "1.0.0",

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
      "apiUrl": "https://tu-dominio.com"
    }
  }
}
```

#### 4.2 Crear BuildService en Backend

**Archivo a CREAR**: `server/src/services/BuildService.js`

```javascript
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class BuildService {
  constructor() {
    this.buildsPath = process.env.BUILDS_PATH || '/home/usuario/builds';
  }

  /**
   * Ejecuta build de Android usando expo build:android
   */
  async buildAndroid(userId, projectName, buildType = 'apk') {
    const projectPath = path.join(
      process.env.PROJECTS_BASE_PATH,
      userId,
      projectName
    );

    const buildId = `${projectName}-${Date.now()}`;
    const buildDir = path.join(this.buildsPath, buildId);

    // Crear directorio de build
    await fs.mkdir(buildDir, { recursive: true });

    return new Promise((resolve, reject) => {
      logger.info('Starting Android build', { projectName, buildType });

      // Ejecutar expo build:android
      const buildProcess = spawn('npx', [
        'expo',
        'build:android',
        `-t`, buildType,
        '--no-publish'
      ], {
        cwd: projectPath,
        env: {
          ...process.env,
          EXPO_NO_TELEMETRY: '1'
        }
      });

      let output = '';

      buildProcess.stdout.on('data', (data) => {
        output += data.toString();
        logger.info('Build output', { data: data.toString() });
      });

      buildProcess.stderr.on('data', (data) => {
        logger.error('Build error', { error: data.toString() });
      });

      buildProcess.on('close', async (code) => {
        if (code === 0) {
          // Buscar APK generado
          const apkPath = await this.findGeneratedApk(projectPath);

          if (apkPath) {
            // Copiar APK a directorio de builds
            const finalApkPath = path.join(buildDir, `${projectName}.apk`);
            await fs.copyFile(apkPath, finalApkPath);

            resolve({
              success: true,
              buildId,
              apkPath: finalApkPath,
              downloadUrl: `/api/builds/${buildId}/download`
            });
          } else {
            reject(new Error('APK not found after build'));
          }
        } else {
          reject(new Error(`Build failed with code ${code}`));
        }
      });
    });
  }

  async findGeneratedApk(projectPath) {
    const androidBuildPath = path.join(
      projectPath,
      'android',
      'app',
      'build',
      'outputs',
      'apk',
      'release'
    );

    try {
      const files = await fs.readdir(androidBuildPath);
      const apkFile = files.find(f => f.endsWith('.apk'));
      return apkFile ? path.join(androidBuildPath, apkFile) : null;
    } catch (error) {
      return null;
    }
  }

  async getBuildStatus(buildId) {
    const buildDir = path.join(this.buildsPath, buildId);
    const exists = await fs.access(buildDir).then(() => true).catch(() => false);

    if (!exists) {
      return { status: 'not_found' };
    }

    const apkExists = await fs.access(
      path.join(buildDir, `${buildId.split('-')[0]}.apk`)
    ).then(() => true).catch(() => false);

    return {
      status: apkExists ? 'completed' : 'building',
      buildId,
      downloadUrl: apkExists ? `/api/builds/${buildId}/download` : null
    };
  }
}

module.exports = new BuildService();
```

#### 4.3 Endpoints de Build en el Backend

**Archivo a CREAR**: `server/src/routes/builds.js`

```javascript
const express = require('express');
const router = express.Router();
const BuildService = require('../services/BuildService');
const authMiddleware = require('../middleware/auth');

// Iniciar build
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const { projectName, buildType } = req.body;
    const userId = req.user.id;

    const result = await BuildService.buildAndroid(userId, projectName, buildType);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Estado del build
router.get('/:buildId/status', authMiddleware, async (req, res, next) => {
  try {
    const { buildId } = req.params;
    const status = await BuildService.getBuildStatus(buildId);

    res.json(status);
  } catch (error) {
    next(error);
  }
});

// Descargar APK
router.get('/:buildId/download', authMiddleware, async (req, res, next) => {
  try {
    const { buildId } = req.params;
    const apkPath = path.join(
      process.env.BUILDS_PATH,
      buildId,
      `${buildId.split('-')[0]}.apk`
    );

    res.download(apkPath);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

**Registrar rutas en `server/server.js`**:
```javascript
const buildsRouter = require('./src/routes/builds');
app.use('/api/builds', buildsRouter);
```

#### 4.4 Job Queue para Builds (Recomendado)

**Para evitar sobrecarga, usar Bull queue**:

```javascript
// server/src/services/BuildQueue.js
const Queue = require('bull');
const BuildService = require('./BuildService');

const buildQueue = new Queue('android-builds', {
  redis: process.env.REDIS_URL
});

// Worker
buildQueue.process(async (job) => {
  const { userId, projectName, buildType } = job.data;

  job.progress(10);
  const result = await BuildService.buildAndroid(userId, projectName, buildType);
  job.progress(100);

  return result;
});

// Notificar cuando complete
buildQueue.on('completed', (job, result) => {
  // Emitir via WebSocket
  io.to(job.data.userId).emit('build:completed', result);
});

module.exports = buildQueue;
```

#### 4.5 Actualizar BuildStatusScreen en Frontend

**Modificar `app/screens/BuildStatusScreen.js`** para usar la nueva API:

```javascript
const startBuild = async () => {
  try {
    setLoading(true);

    const response = await api.post('/builds', {
      projectName: selectedProject,
      buildType: 'apk'
    });

    setBuildId(response.data.buildId);
    pollBuildStatus(response.data.buildId);
  } catch (error) {
    Alert.alert('Error', 'Failed to start build');
  }
};

const pollBuildStatus = async (buildId) => {
  const interval = setInterval(async () => {
    try {
      const response = await api.get(`/builds/${buildId}/status`);

      if (response.data.status === 'completed') {
        clearInterval(interval);
        setDownloadUrl(response.data.downloadUrl);
        setLoading(false);
      }
    } catch (error) {
      clearInterval(interval);
      setLoading(false);
    }
  }, 5000); // Poll cada 5 segundos
};
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

### FASE 2 - VPS Deployment (ALTA PRIORIDAD)
1. ⚠️ **`server/server.js`** - Agregar DB init, cambiar bind host a 0.0.0.0
2. ⚠️ **`server/.env`** - Actualizar con DATABASE_URL, REDIS_URL, JWT_SECRET
3. 📝 **Configurar Nginx** - Crear /etc/nginx/sites-available/expo-builder
4. 📝 **Configurar PM2** - pm2 start server.js y pm2 save

### FASE 3 - Frontend Auth (ALTA PRIORIDAD)
1. ⚠️ **`app/App.js`** - Agregar auth flow y navigation condicional
2. ⚠️ **`app/services/api.js`** - Remover localhost, agregar manejo 401
3. 📝 **`app/screens/LoginScreen.js`** - CREAR
4. 📝 **`app/screens/RegisterScreen.js`** - CREAR
5. ⚠️ **`app/utils/storage.js`** - Agregar userId methods

### FASE 4 - Builds en VPS (ALTA PRIORIDAD)
1. ⚠️ **`app/app.json`** - Actualizar con package, permissions, apiUrl
2. 📝 **`server/src/services/BuildService.js`** - CREAR (lógica de builds)
3. 📝 **`server/src/routes/builds.js`** - CREAR (endpoints de builds)
4. 📝 **`server/src/services/BuildQueue.js`** - CREAR (job queue)
5. ⚠️ **`app/screens/BuildStatusScreen.js`** - Modificar para usar nueva API
6. 📝 **Configurar Android SDK en VPS** - Instalar Java JDK, Android SDK, build tools

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

| Fase | Duración | Puede empezar | Notas |
|------|----------|---------------|-------|
| Fase 1: Backend Auth & DB | 2-3 semanas | Inmediatamente | Desarrollo local en Termux primero |
| Fase 2: VPS Deployment | 3-5 días | Después Fase 1 | Más rápido con VPS ya funcionando |
| Fase 3: Frontend Auth | 2-3 semanas | Paralelo con Fase 1 | Login/Register screens |
| Fase 4: Builds en VPS | 1-2 semanas | Después Fase 2 | Incluye setup de Android SDK |
| Fase 5: Security | 1 semana | Después Fase 2 | SSL, rate limiting, validación |
| Fase 6: Job Queues | 1-2 semanas | Después Fase 4 | Opcional pero recomendado |

**Total estimado**: 8-11 semanas (2-2.5 meses)

**Ventaja**: Con VPS ya funcionando, la FASE 2 se reduce significativamente.

**Nota**: Fases 1 y 3 pueden desarrollarse en paralelo (backend y frontend separados).

---

## Stack Tecnológico

### Backend
- **Database**: PostgreSQL + Sequelize ORM
- **Auth**: jsonwebtoken + bcryptjs
- **Job Queue**: Bull + Redis
- **Security**: helmet, express-rate-limit, express-validator
- **Deployment**: VPS Hetzner con PM2
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt (Certbot)

### Frontend
- **React Native**: Expo SDK 54 (existente)
- **Navigation**: React Navigation (existente)
- **Storage**: AsyncStorage (existente)
- **HTTP**: Axios (existente)
- **WebSocket**: socket.io-client (existente)

### Infrastructure
- **Hosting**: Hetzner VPS (€5-10/mes según plan)
  - CX21: 2 vCPU, 4GB RAM, 40GB SSD (~€5.83/mes)
  - CX31: 2 vCPU, 8GB RAM, 80GB SSD (~€10.76/mes)
- **Database**: PostgreSQL (instalado en VPS)
- **Cache/Queue**: Redis (instalado en VPS)
- **Storage**: Filesystem del VPS (proyectos y APKs)
- **SSL**: Let's Encrypt (gratuito)
- **Monitoring**: PM2 monitoring + logs (opcional: Sentry para errores)
- **Process Manager**: PM2 con auto-restart

**Costos mensuales estimados**:
- VPS Hetzner CX21: €5.83/mes
- Dominio (opcional): €10-15/año
- **Total**: ~€6-10/mes (vs $29/mes de EAS)

---

## Riesgos y Mitigaciones

### 🟢 Riesgo Bajo: CLI Tools en VPS (Resuelto)
**Antes**: Expo CLI podía no funcionar en containers restrictivos
**Ahora con VPS**: ✅ Control total del sistema, Android SDK instalable
**Ventajas**:
- Instalación directa de Android SDK
- Sin restricciones de container
- Builds ilimitados y gratuitos

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

### 1. Preparar VPS (Día 1-2)
```bash
# Conectar al VPS
ssh root@tu-vps-ip

# Instalar dependencias del sistema
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs postgresql postgresql-contrib redis-server nginx git

# Instalar Android SDK
apt install -y openjdk-17-jdk
# ... (seguir pasos de FASE 2.3)

# Instalar PM2
npm install -g pm2

# Configurar PostgreSQL
sudo -u postgres psql
CREATE DATABASE expo_builder;
CREATE USER expo_user WITH PASSWORD 'tu-password';
GRANT ALL PRIVILEGES ON DATABASE expo_builder TO expo_user;
\q
```

### 2. Backend Auth (Semana 1)
- Crear modelos User, Project con Sequelize
- Implementar AuthService (JWT)
- Modificar auth middleware
- Crear endpoints /auth/register, /auth/login
- Probar localmente en Termux primero

### 3. Deploy al VPS (Semana 2)
```bash
# Subir código al VPS
git clone https://github.com/tu-usuario/expo-android-builder.git
cd expo-android-builder/server
npm install

# Configurar .env
nano .env

# Iniciar con PM2
pm2 start server.js --name expo-builder-api
pm2 save
pm2 startup
```

### 4. Configurar Nginx y SSL (Semana 2)
- Configurar reverse proxy Nginx
- Obtener certificado SSL con Let's Encrypt
- Probar HTTPS y WebSocket desde internet

### 5. Frontend Auth Screens (Semana 3-4)
- Crear LoginScreen, RegisterScreen
- Modificar App.js navigation
- Actualizar api.js para usar URL del VPS
- Probar autenticación desde app

### 6. Configurar Builds en VPS (Semana 5)
- Instalar Android SDK completo en VPS
- Crear BuildService.js
- Implementar endpoints de builds
- Probar build local en VPS

### 7. Primera Build APK Standalone (Semana 6)
- Actualizar app.json
- Hacer build desde la app usando el VPS
- Descargar APK y probar en dispositivo real
- Firmar APK para distribución

---

## Conclusión

Este plan transforma Expo App Builder de una herramienta local Termux a una app Android standalone con backend cloud multi-usuario en **VPS Hetzner**, manteniendo toda la funcionalidad existente pero haciéndola accesible para usuarios que no usan Termux.

**Ventajas del enfoque con VPS propio**:
- 💰 **Costo reducido**: €6-10/mes vs $29/mes de EAS
- 🔧 **Control total**: Android SDK, builds ilimitados, sin restricciones
- 🚀 **Independencia**: No dependes de servicios externos para builds
- 📦 **Datos propios**: Proyectos y APKs bajo tu control completo
- ⚡ **Personalización**: Puedes optimizar el servidor según tus necesidades

**Enfoque incremental**: Cada fase agrega valor sin romper funcionalidad existente.

**Resultado final**: APK firmado distribuible que conecta a backend cloud en tu VPS Hetzner, soporta múltiples usuarios, y mantiene capacidades completas de Project Builder con builds locales ilimitados.
