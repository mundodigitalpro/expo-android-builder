# Guía de Instalación y Requisitos Previos

> **Documento esencial** para cualquier persona que quiera clonar e instalar Expo Android Builder en su propio entorno.

**Última actualización**: 6 de Enero, 2026

---

## Resumen Ejecutivo

Esta guía explica **todas las cuentas, herramientas y configuraciones** necesarias antes de poder usar Expo Android Builder. Sin completar estos pasos previos, la aplicación **no funcionará correctamente**.

### ⏱️ Tiempo Estimado de Configuración

| Escenario | Tiempo | Costo Mensual |
|-----------|--------|---------------|
| **Solo desarrollo local (Termux)** | 1-2 horas | $0 |
| **Con builds EAS Cloud** | 2-3 horas | $0-29/mes |
| **Con VPS de producción** | 4-6 horas | €6-10/mes |
| **Configuración completa** | 6-8 horas | ~€15/mes |

---

## 📋 Tabla de Requisitos

| Requisito | Obligatorio | Para qué se usa |
|-----------|-------------|-----------------|
| Dispositivo Android | ✅ Sí | Desarrollo y testing |
| Termux | ✅ Sí | Entorno de desarrollo |
| Node.js | ✅ Sí | Backend server |
| Expo Go | ✅ Sí | Testing de la app |
| Cuenta GitHub | ✅ Sí | Código fuente |
| GitHub Token (PAT) | ⚠️ Builds | GitHub Actions builds |
| Cuenta Expo/EAS | ⚠️ Builds | EAS Cloud builds |
| Suscripción Claude Code | ⚠️ AI | Asistente de desarrollo |
| VPS (ej: Hetzner) | ⚠️ Producción | Backend en producción |
| Dominio | ⚠️ Producción | HTTPS y acceso público |
| Cloudflare | ⚠️ Producción | DNS y SSL |

**Leyenda**: ✅ = Obligatorio | ⚠️ = Según funcionalidad deseada

---

## Nivel 1: Desarrollo Local Básico (Mínimo)

### 1.1 Dispositivo Android con Termux

**Qué necesitas:**
- Teléfono Android (Android 7.0 o superior)
- App Termux instalada desde F-Droid (NO Google Play)

**Instalación de Termux:**
```bash
# Descargar desde F-Droid (recomendado)
# https://f-droid.org/packages/com.termux/

# O usar la APK directa
# https://github.com/termux/termux-app/releases
```

> ⚠️ **Importante**: La versión de Google Play está desactualizada. Usa F-Droid.

### 1.2 Node.js en Termux

```bash
# Actualizar paquetes
pkg update && pkg upgrade

# Instalar Node.js
pkg install nodejs

# Verificar versión (requiere 18+)
node --version
npm --version
```

### 1.3 Git

```bash
pkg install git

# Configurar identidad
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
```

### 1.4 Expo Go

**Instalar desde Google Play Store:**
- App: "Expo Go" por Expo Project
- Enlace: https://play.google.com/store/apps/details?id=host.exp.exponent

### 1.5 Clonar e Instalar el Proyecto

```bash
# Clonar repositorio
cd ~
git clone https://github.com/mundodigitalpro/expo-android-builder.git
cd expo-android-builder

# Instalar dependencias del servidor
cd server
npm install

# Instalar dependencias de la app
cd ../app
npm install

# Configurar servidor
cd ../server
cp .env.example .env
# Editar .env si es necesario
```

### 1.6 Variables de Entorno Locales

Editar `server/.env`:

```env
PORT=3001
AUTH_TOKEN=expo-builder-token-2024-secure
PROJECTS_BASE_PATH=/data/data/com.termux/files/home/app-builder-projects
NODE_ENV=development
```

### 1.7 Primera Ejecución

```bash
cd ~/expo-android-builder/server
./start-all-services.sh
```

Escanea el código QR con Expo Go para abrir la app.

---

## Nivel 2: Builds con GitHub Actions

Para compilar APKs Android usando GitHub Actions (gratis, ilimitado en repos públicos).

### 2.1 Cuenta de GitHub

Si no tienes cuenta:
1. Ve a https://github.com/signup
2. Crea una cuenta gratuita
3. Verifica tu email

### 2.2 Personal Access Token (PAT)

**Necesario para:** Disparar workflows de GitHub Actions desde la app.

**Crear token:**
1. Ve a https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Nombre: `Expo Builder Token`
4. Expiración: 90 días o más
5. **Scopes requeridos:**
   - ✅ `repo` (Full control of private repositories)
   - ✅ `workflow` (Update GitHub Action workflows)
6. Click **"Generate token"**
7. **¡COPIA EL TOKEN INMEDIATAMENTE!** (solo se muestra una vez)

**Configurar en `.env`:**
```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
GITHUB_REPO_OWNER=tu-usuario-github
GITHUB_REPO_NAME=expo-android-builder
```

### 2.3 Keystore de Android (Para builds firmados)

**Crear keystore:**
```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore release.keystore \
  -alias tu-app-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Te pedirá:
# - Contraseña del keystore
# - Nombre y apellido
# - Unidad organizativa
# - Organización
# - Ciudad
# - Estado
# - Código de país (ES)
```

**Convertir a Base64:**
```bash
base64 -w 0 release.keystore > keystore.base64.txt
```

### 2.4 GitHub Actions Secrets

Ve a tu repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions**

Agregar estos 4 secrets:

| Nombre | Valor |
|--------|-------|
| `ANDROID_KEYSTORE_BASE64` | Contenido de `keystore.base64.txt` |
| `ANDROID_KEY_ALIAS` | El alias usado (ej: `tu-app-key`) |
| `ANDROID_STORE_PASSWORD` | Contraseña del keystore |
| `ANDROID_KEY_PASSWORD` | Contraseña de la key (usualmente igual) |

### 2.5 Verificar Configuración

1. Ve a **Actions** en tu repo
2. Click en **"Android Native Build (Gradle)"**
3. Click **"Run workflow"**
4. Selecciona:
   - `project_path`: app
   - `build_type`: debug
5. Espera ~15 minutos
6. Descarga el APK de **Artifacts**

---

## Nivel 3: Builds con EAS Cloud

Para usar Expo Application Services (builds en la nube de Expo).

### 3.1 Cuenta de Expo

1. Ve a https://expo.dev/signup
2. Crea cuenta gratuita o con GitHub
3. Verifica tu email

### 3.2 EAS CLI

```bash
# Instalar globalmente
npm install -g eas-cli

# Verificar
eas --version

# Login
eas login
# (usar credenciales de expo.dev)
```

### 3.3 Plan de Precios EAS

| Plan | Builds/mes | Costo | Ideal para |
|------|-----------|-------|------------|
| Free | 5 | $0 | Pruebas |
| On-demand | Ilimitados | $0.02/min | Uso ocasional |
| Production | 1000 | $29/mes | Uso regular |

### 3.4 Configurar Proyecto para EAS

El servidor auto-configura proyectos nuevos, pero manualmente:

```bash
cd ~/app-builder-projects/mi-proyecto

# Inicializar EAS
eas project:init --force

# Verificar configuración
cat eas.json
```

---

## Nivel 4: Integración Claude Code

Para el asistente de desarrollo con IA.

### 4.1 Suscripción a Claude

**Requisitos:**
- Cuenta de Anthropic/Claude
- Suscripción Pro ($20/mes) o Team

**Obtener acceso:**
1. Ve a https://claude.ai
2. Crea cuenta
3. Suscríbete a Pro

### 4.2 Claude Code CLI

```bash
# Instalar CLI
npm install -g @anthropic-ai/claude-code

# Autenticar
claude auth login
# (seguir instrucciones del navegador)

# Verificar
claude --version
```

### 4.3 Configuración en Termux

El directorio de configuración se crea en `~/.claude/`:
```bash
ls ~/.claude/
# Debería mostrar: claude_credentials.json
```

### 4.4 Configuración en Docker (VPS)

Para usar Claude Code en el backend de producción:

```yaml
# docker-compose.yml
volumes:
  - /home/usuario/.claude:/home/node/.claude:rw
environment:
  - CLAUDE_CONFIG_DIR=/home/node/.claude
```

> ⚠️ **Nota**: Claude Code CLI requiere usuario no-root en Docker.

---

## Nivel 5: VPS de Producción

Para desplegar el backend en un servidor accesible públicamente.

### 5.1 VPS Recomendado: Hetzner Cloud

**Por qué Hetzner:**
- Precio competitivo (€4-6/mes)
- Datacenter en Europa
- Buen rendimiento

**Plan mínimo:**
| Recurso | Especificación |
|---------|----------------|
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disco | 40 GB NVMe |
| OS | Ubuntu 24.04 LTS |
| Precio | ~€6/mes |

**Crear VPS:**
1. Ve a https://hetzner.cloud
2. Crea cuenta
3. Crea servidor (CX22 o superior)
4. Descarga clave SSH

### 5.2 Dominio

**Requisitos:**
- Un dominio propio (ej: `tusitio.dev`)
- Acceso a configuración DNS

**Proveedores recomendados:**
- Cloudflare Registrar (gratis DNS)
- Namecheap
- Google Domains

### 5.3 Cloudflare (Recomendado)

**Para qué se usa:**
- DNS management
- SSL/TLS automático
- CDN y protección DDoS

**Configuración:**
1. Crea cuenta en https://cloudflare.com
2. Añade tu dominio
3. Cambia nameservers a Cloudflare
4. Crea registro A:
   - Tipo: A
   - Nombre: builder (o subdominio elegido)
   - Contenido: [IP del VPS]
   - Proxy: Activado (nube naranja)

### 5.4 Instalar Dependencias en VPS

```bash
# Conectar al VPS
ssh usuario@ip-del-vps

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose-plugin

# Verificar
docker --version
docker compose version
```

### 5.5 Java JDK 17 (Para builds locales)

```bash
sudo apt install -y openjdk-17-jdk
java -version
```

### 5.6 Android SDK (Para builds locales)

```bash
# Crear directorio
sudo mkdir -p /opt/android-sdk
sudo chown -R $USER:$USER /opt/android-sdk

# Descargar Command Line Tools
cd /tmp
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip -d /opt/android-sdk

# Organizar estructura
cd /opt/android-sdk
mkdir -p cmdline-tools/latest
mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true

# Aceptar licencias
/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses

# Instalar componentes
/opt/android-sdk/cmdline-tools/latest/bin/sdkmanager \
  --sdk_root=/opt/android-sdk \
  "platform-tools" \
  "platforms;android-33" \
  "build-tools;33.0.0"

# Configurar variables
echo 'export ANDROID_HOME=/opt/android-sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc
```

### 5.7 Clonar y Desplegar

```bash
# Clonar repositorio
cd ~/apps
git clone https://github.com/mundodigitalpro/expo-android-builder.git builder
cd builder

# Configurar variables de entorno
cp server/.env.example server/.env
nano server/.env
# Editar con tus valores reales

# Desplegar
./deploy.sh
```

### 5.8 Nginx y SSL

```bash
# Instalar Nginx y Certbot
sudo apt install nginx certbot python3-certbot-nginx

# Crear configuración
sudo nano /etc/nginx/sites-available/builder
```

Contenido de configuración Nginx:
```nginx
server {
    listen 80;
    server_name builder.tudominio.dev;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name builder.tudominio.dev;

    ssl_certificate /etc/letsencrypt/live/builder.tudominio.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/builder.tudominio.dev/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/builder /etc/nginx/sites-enabled/

# Obtener certificado SSL
sudo certbot --nginx -d builder.tudominio.dev

# Recargar Nginx
sudo systemctl reload nginx
```

---

## 📦 Resumen de Configuración `.env`

### Desarrollo Local (Termux)

```env
PORT=3001
AUTH_TOKEN=expo-builder-token-2024-secure
PROJECTS_BASE_PATH=/data/data/com.termux/files/home/app-builder-projects
NODE_ENV=development
```

### Producción (VPS)

```env
PORT=3001
AUTH_TOKEN=[token-seguro-generado]
PROJECTS_BASE_PATH=/app-builder-projects
NODE_ENV=production

# GitHub Actions
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxx
GITHUB_REPO_OWNER=tu-usuario
GITHUB_REPO_NAME=expo-android-builder

# Claude Code (opcional, configurado vía volúmenes Docker)
# CLAUDE_CONFIG_DIR=/home/node/.claude
```

---

## ✅ Checklist de Verificación

### Nivel 1: Desarrollo Local
- [ ] Termux instalado desde F-Droid
- [ ] Node.js 18+ instalado
- [ ] Git configurado
- [ ] Expo Go instalado
- [ ] Proyecto clonado
- [ ] `npm install` completado en server y app
- [ ] `.env` configurado
- [ ] `./start-all-services.sh` funciona
- [ ] App se abre en Expo Go

### Nivel 2: GitHub Actions
- [ ] Cuenta GitHub creada
- [ ] Personal Access Token generado (scopes: repo, workflow)
- [ ] Keystore generado y convertido a base64
- [ ] 4 secrets configurados en GitHub
- [ ] Primer build de prueba exitoso

### Nivel 3: EAS Cloud
- [ ] Cuenta Expo creada
- [ ] EAS CLI instalado
- [ ] Login con `eas login`
- [ ] Proyecto inicializado con `eas project:init`

### Nivel 4: Claude Code
- [ ] Suscripción Claude Pro activa
- [ ] Claude Code CLI instalado
- [ ] Autenticado con `claude auth login`
- [ ] Funciona en Termux

### Nivel 5: VPS Producción
- [ ] VPS creado (Hetzner u otro)
- [ ] SSH accesible
- [ ] Docker instalado
- [ ] Java 17 instalado
- [ ] Android SDK instalado
- [ ] Dominio apuntando al VPS
- [ ] SSL configurado
- [ ] Backend desplegado
- [ ] Health check funciona: `curl https://tu-dominio/health`

---

## 🆘 Problemas Comunes

### "EACCES: permission denied"
```bash
# Dar permisos a la carpeta de proyectos
mkdir -p ~/app-builder-projects
chmod 755 ~/app-builder-projects
```

### "GitHub token no tiene scope workflow"
Regenera el token con el scope `workflow` habilitado.

### "EAS: Project does not exist"
```bash
cd ~/app-builder-projects/mi-proyecto
eas project:init --force
```

### "Claude Code: No API key"
```bash
claude auth login
# Seguir instrucciones
```

### "Docker: GLIBC not found"
Java debe instalarse DENTRO del contenedor, no desde el host si usas Ubuntu 24.04.

### "Nginx: 502 Bad Gateway"
```bash
# Verificar que Docker está corriendo
docker compose ps

# Ver logs
docker compose logs
```

---

## 📚 Referencias

- [README.md](../README.md) - Visión general del proyecto
- [DEPLOYMENT_VPS.md](./DEPLOYMENT_VPS.md) - Guía detallada de VPS
- [GITHUB_ACTIONS_SETUP.md](./GITHUB_ACTIONS_SETUP.md) - Configuración de GitHub Actions
- [GUIA_DESARROLLADOR.md](./GUIA_DESARROLLADOR.md) - Para desarrolladores
- [INICIO_RAPIDO.md](./INICIO_RAPIDO.md) - Primeros pasos

---

**¿Preguntas?** Abre un issue en GitHub: https://github.com/mundodigitalpro/expo-android-builder/issues
