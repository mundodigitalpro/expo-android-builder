# Plan MVP: Expo Android Builder en VPS Hetzner

**Versión:** 1.0  
**Fecha:** 31 Diciembre 2024  
**Objetivo:** Builds de Android en VPS propio para uso privado

---

## Resumen

Este plan simplificado transforma Expo App Builder para hacer builds de Android en un VPS Hetzner propio, **sin sobreingeniería**. El objetivo es replicar lo que hacía EAS Cloud pero localmente, solo para uso privado.

> 💡 **Para el plan multi-usuario con PostgreSQL, JWT y Play Store**, ver: `PLAN_MULTIUSUARIO_FUTURO.md`

---

## Arquitectura MVP

```
┌─────────────────────────────────────────────────────────────────┐
│                      VPS Hetzner (Ubuntu 22.04)                 │
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────────────────────┐    │
│  │  Nginx          │────▶│  Node.js Server                 │    │
│  │  + Let's Encrypt│     │  (PM2, puerto 3001)             │    │
│  │  (puerto 443)   │     │                                 │    │
│  └─────────────────┘     │  • Backend actual SIN cambios   │    │
│                          │  • ProjectService (filesystem)  │    │
│                          │  • EASService → LocalBuildService│    │
│                          │  • ClaudeService                │    │
│                          └──────────┬──────────────────────┘    │
│                                     │                           │
│                          ┌──────────▼──────────────────────┐    │
│                          │  Android SDK                     │    │
│                          │  • Java JDK 17                   │    │
│                          │  • Build Tools 33                │    │
│                          │  • Expo CLI local builds         │    │
│                          └─────────────────────────────────┘    │
│                                                                 │
│  📁 Almacenamiento:                                             │
│  /home/usuario/projects/     ← Proyectos                        │
│  /home/usuario/builds/       ← APKs generados                   │
└─────────────────────────────────────────────────────────────────┘
             ▲
             │ HTTPS/WSS
             │
┌────────────┴───────────┐
│  App React Native      │
│  (Expo Go / APK)       │
│  Token: simple         │
└────────────────────────┘
```

---

## Lo que NO necesitas para MVP

| ❌ Componente | Razón |
|---------------|-------|
| PostgreSQL + Sequelize | El filesystem actual funciona perfecto |
| Redis + Bull Queues | No tienes builds concurrentes |
| JWT multi-usuario | Mantén el token simple (.env) |
| Modelos User/Project ORM | No tienes múltiples usuarios |
| Rate limiting avanzado | Es tu VPS privado |
| Helmet/Security hardening | Firewall UFW es suficiente |
| WebSocket auth compleja | La conexión simple funciona |

---

## Fases de Implementación

### **FASE 1: Preparar VPS** (1-2 días)

#### 1.1 Configuración Base

```bash
# Conectar al VPS
ssh root@tu-vps-ip

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar
node -v  # v20.x.x
npm -v

# Instalar PM2 globalmente
npm install -g pm2

# Instalar Nginx
apt install -y nginx
systemctl enable nginx

# Instalar Git
apt install -y git
```

#### 1.2 Configurar Android SDK

```bash
# Instalar Java JDK 17
apt install -y openjdk-17-jdk
java -version  # openjdk 17.x.x

# Crear directorio para Android SDK
mkdir -p /opt/android-sdk
cd /opt

# Descargar Command Line Tools
wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
unzip commandlinetools-linux-9477386_latest.zip -d android-sdk
rm commandlinetools-linux-9477386_latest.zip

# Reorganizar estructura (Android SDK lo requiere así)
cd android-sdk
mkdir cmdline-tools/latest
mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# Configurar variables de entorno
cat >> ~/.bashrc << 'EOF'
export ANDROID_HOME=/opt/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
EOF
source ~/.bashrc

# Aceptar licencias
yes | sdkmanager --licenses

# Instalar componentes
sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0"
```

#### 1.3 Configurar Firewall

```bash
# Configurar UFW
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
ufw status
```

---

### **FASE 2: Deploy del Backend** (1 día)

#### 2.1 Clonar/Subir Código

```bash
# Opción A: Desde GitHub
cd /home/tu-usuario
git clone https://github.com/mundodigitalpro/expo-android-builder.git
cd expo-android-builder/server

# Opción B: Desde Termux con rsync
# (Ejecutar en Termux):
# rsync -avz ~/expo-android-builder/ usuario@tu-vps-ip:/home/usuario/expo-android-builder/
```

#### 2.2 Configurar Entorno

```bash
cd /home/tu-usuario/expo-android-builder/server

# Crear archivo .env
cat > .env << 'EOF'
PORT=3001
HOST=0.0.0.0
AUTH_TOKEN=tu-token-seguro-aqui
PROJECTS_BASE_PATH=/home/tu-usuario/app-builder-projects
NODE_ENV=production
EOF

# Crear directorio de proyectos
mkdir -p /home/tu-usuario/app-builder-projects
```

#### 2.3 Instalar y Arrancar

```bash
# Instalar dependencias
npm install --production

# Probar que arranca
npm start
# Verificar: "Server running on 0.0.0.0:3001"
# Ctrl+C para detener

# Iniciar con PM2
pm2 start server.js --name expo-builder
pm2 save
pm2 startup  # Seguir instrucciones para auto-inicio
```

---

### **FASE 3: Configurar Nginx + SSL** (medio día)

#### 3.1 Configurar Nginx

```bash
# Crear configuración
cat > /etc/nginx/sites-available/expo-builder << 'EOF'
server {
    listen 80;
    server_name tu-dominio.com;  # O tu IP

    client_max_body_size 100M;

    # API REST
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3001;
    }
}
EOF

# Activar sitio
ln -s /etc/nginx/sites-available/expo-builder /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

#### 3.2 SSL con Let's Encrypt (si tienes dominio)

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obtener certificado
certbot --nginx -d tu-dominio.com

# Auto-renovación ya configurada
```

---

### **FASE 4: Adaptar para Builds Locales** (1-2 días)

#### 4.1 Crear LocalBuildService

**Archivo nuevo:** `server/src/services/LocalBuildService.js`

```javascript
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

class LocalBuildService {
  constructor() {
    this.buildsPath = process.env.BUILDS_PATH || '/home/usuario/builds';
  }

  async buildAndroid(projectName, io, socketId) {
    const projectPath = path.join(
      process.env.PROJECTS_BASE_PATH,
      projectName
    );

    const buildId = `${projectName}-${Date.now()}`;
    
    logger.info('Iniciando build local', { projectName, buildId });

    return new Promise((resolve, reject) => {
      // Usar npx expo para build local
      const buildProcess = spawn('npx', [
        'expo', 'build:android',
        '-t', 'apk',
        '--no-publish'
      ], {
        cwd: projectPath,
        env: {
          ...process.env,
          ANDROID_HOME: '/opt/android-sdk',
          JAVA_HOME: '/usr/lib/jvm/java-17-openjdk-amd64'
        }
      });

      buildProcess.stdout.on('data', (data) => {
        const message = data.toString();
        logger.info('Build output', { message });
        io.to(socketId).emit('build:output', { message });
      });

      buildProcess.stderr.on('data', (data) => {
        const message = data.toString();
        // No todos los stderr son errores
        io.to(socketId).emit('build:output', { message });
      });

      buildProcess.on('close', async (code) => {
        if (code === 0) {
          const apkPath = await this.findApk(projectPath);
          resolve({
            success: true,
            buildId,
            apkPath,
            downloadUrl: `/api/builds/${buildId}/download`
          });
        } else {
          reject(new Error(`Build falló con código ${code}`));
        }
      });
    });
  }

  async findApk(projectPath) {
    const searchPaths = [
      path.join(projectPath, 'android/app/build/outputs/apk/release'),
      path.join(projectPath, 'android/app/build/outputs/apk/debug'),
    ];

    for (const searchPath of searchPaths) {
      try {
        const files = await fs.readdir(searchPath);
        const apk = files.find(f => f.endsWith('.apk'));
        if (apk) return path.join(searchPath, apk);
      } catch (e) {
        // Directorio no existe, continuar
      }
    }
    return null;
  }
}

module.exports = new LocalBuildService();
```

#### 4.2 Actualizar Configuración App

En la app React Native, actualizar la URL del servidor:

```javascript
// app/utils/storage.js
// Cambiar default de localhost a tu VPS
const DEFAULT_SERVER_URL = 'https://tu-dominio.com';
// o
const DEFAULT_SERVER_URL = 'http://tu-vps-ip';
```

---

## Modificaciones al Código Actual

### Cambios Mínimos Requeridos

| Archivo | Cambio |
|---------|--------|
| `server/server.js` | Agregar `HOST` al listen |
| `server/.env` | Agregar `HOST=0.0.0.0` |
| `app/utils/storage.js` | Cambiar URL default |

**Código para `server.js`** (línea 53):

```javascript
// ANTES:
server.listen(PORT, () => {

// DESPUÉS:
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
```

---

## Costos Estimados

| Concepto | Costo |
|----------|-------|
| VPS Hetzner CX21 | €5.83/mes |
| Dominio (opcional) | €10-15/año |
| **Total** | **~€6-7/mes** |

**Comparación con EAS Cloud:** $29/mes → €6/mes = **~80% ahorro**

---

## Comandos de Mantenimiento

```bash
# Ver logs del servidor
pm2 logs expo-builder

# Reiniciar servidor
pm2 restart expo-builder

# Actualizar código
cd /home/usuario/expo-android-builder
git pull
pm2 restart expo-builder

# Ver estado
pm2 status

# Espacio en disco
df -h
```

---

## Timeline

| Fase | Duración | Descripción |
|------|----------|-------------|
| 1 | 1-2 días | Preparar VPS (Node, Android SDK, Nginx) |
| 2 | 1 día | Deploy backend |
| 3 | 0.5 días | SSL y configuración Nginx |
| 4 | 1-2 días | Crear LocalBuildService |
| **Total** | **3-5 días** | MVP funcional |

---

## Próximos Pasos

1. [ ] Contratar/usar VPS Hetzner
2. [ ] Seguir FASE 1 (instalar dependencias)
3. [ ] Seguir FASE 2 (deploy backend)
4. [ ] Seguir FASE 3 (Nginx + SSL)
5. [ ] Seguir FASE 4 (LocalBuildService)
6. [ ] Probar build desde la app
7. [ ] Descargar e instalar APK

---

## Desarrollo Futuro

Para cuando quieras hacer la app multi-usuario y publicar en Play Store, consulta:

📋 **`PLAN_MULTIUSUARIO_FUTURO.md`** - Plan completo con:
- PostgreSQL + Sequelize
- JWT Auth multi-usuario  
- Redis + Bull Queues
- Rate limiting
- Security hardening
- Modelos User/Project
