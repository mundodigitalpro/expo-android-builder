1 # VPS Deployment Guide - Expo Android Builder
    2 
    3 > Complete guide for deploying Expo Android Builder on a Hetzner Cloud VPS using Docker
    4 
    5 **Production Instance**: https://builder.josejordan.dev
    6 **Deployment Date**: December 31, 2024
    7 **Status**: ✅ Active
    8 
    9 ---
   10 
   11 ## Overview
   12 
   13 This document describes the **production deployment** of Expo Android Builder on a Hetzner Cloud VPS. Unlike the original Termux-based architecture, this 
      deployment uses Docker containers with Android SDK and Java JDK mounted from the host system.
   14 
   15 ### Architecture Comparison
   16 
   17 | Component | Termux (Development) | VPS (Production) |
   18 |-----------|---------------------|------------------|
   19 | **Platform** | Android device | Hetzner Cloud VPS (Ubuntu 24.04) |
   20 | **Backend Runtime** | Node.js direct | Docker container (Node.js 18) |
   21 | **Frontend** | Expo Go app | API-only (for external clients) |
   22 | **Android SDK** | Inside Termux | Host system (/opt/android-sdk) |
   23 | **Java JDK** | Inside Termux | Host system (OpenJDK 17) |
   24 | **Reverse Proxy** | None | Nginx with SSL/TLS |
   25 | **Process Manager** | Manual/scripts | Docker Compose |
   26 | **SSL** | None | Let's Encrypt (DNS-01 Cloudflare) |
   27 
   28 ---
   29 
   30 ## Production Architecture
   31 
   32 ```
   33 Internet
   34    │
   35    ↓
   36 Cloudflare DNS (proxy enabled)
   37    │
   38    ↓
   39 Hetzner Cloud Firewall (80, 443)
   40    │
   41    ↓
   42 VPS Ubuntu 24.04 (2 vCPU, 4GB RAM)
   43    │
   44    ├─→ UFW Firewall
   45    │
   46    ├─→ Nginx (reverse proxy, SSL termination)
   47    │    │
   48    │    └─→ builder.josejordan.dev → localhost:3001
   49    │
   50    ├─→ Docker Container (expo-builder)
   51    │    │
   52    │    ├─ Node.js 18 (Express + Socket.io)
   53    │    ├─ Backend server on port 3001
   54    │    └─ Volume mounts:
   55    │         ├─ /opt/android-sdk (read-only)
   56    │         └─ /usr/lib/jvm/java-17-openjdk-amd64 (read-only)
   57    │
   58    └─→ Host System
   59         ├─ Java JDK 17 (/usr/lib/jvm/java-17-openjdk-amd64)
   60         ├─ Android SDK (/opt/android-sdk)
   61         │   ├─ Command Line Tools 12.0
   62         │   ├─ Platform Tools (ADB)
   63         │   ├─ Build Tools 33.0.0
   64         │   └─ Platform Android 33 (API 33)
   65         └─ Projects volume (Docker managed)
   66 ```
   67 
   68 ---
   69 
   70 ## Prerequisites
   71 
   72 ### VPS Specifications
   73 
   74 | Resource | Specification |
   75 |----------|---------------|
   76 | Provider | Hetzner Cloud |
   77 | Plan | CX22 or higher |
   78 | CPU | 2 vCPU (minimum) |
   79 | RAM | 4 GB (minimum) |
   80 | Storage | 40 GB NVMe |
   81 | OS | Ubuntu 24.04 LTS |
   82 | Network | 20 TB/month transfer |
   83 
   84 ### Required Software
   85 
   86 - Docker 28.2.2+
   87 - Docker Compose v2.40.1+
   88 - Nginx
   89 - Certbot (for SSL)
   90 - Git
   91 
   92 ### DNS Setup
   93 
   94 - Domain with Cloudflare DNS management
   95 - A record pointing to VPS IP
   96 - Cloudflare API token for DNS-01 challenge
   97 
   98 ---
   99 
  100 ## Installation Steps
  101 
  102 ### Step 1: Install Java JDK 17
  103 
  104 ```bash
  105 # Update repositories
  106 sudo apt update
  107 
  108 # Install OpenJDK 17
  109 sudo apt install -y openjdk-17-jdk
  110 
  111 # Verify installation
  112 java -version
  113 # Expected output: openjdk version "17.0.17"
  114 
  115 javac -version
  116 # Expected output: javac 17.0.17
  117 ```
  118 
  119 **Installation location**: `/usr/lib/jvm/java-17-openjdk-amd64`
  120 
  121 ---
  122 
  123 ### Step 2: Install Android SDK
  124 
  125 #### Create directory and set permissions
  126 
  127 ```bash
  128 sudo mkdir -p /opt/android-sdk
  129 sudo chown -R $USER:$USER /opt/android-sdk
  130 ```
  131 
  132 #### Download Command Line Tools
  133 
  134 ```bash
  135 cd /tmp
  136 wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
  137 ```
  138 
  139 #### Extract and organize
  140 
  141 ```bash
  142 # Extract
  143 unzip commandlinetools-linux-11076708_latest.zip -d /opt/android-sdk
  144 
  145 # Reorganize structure (required by Android SDK)
  146 cd /opt/android-sdk
  147 mkdir -p cmdline-tools/latest
  148 mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true
  149 ```
  150 
  151 #### Accept licenses
  152 
  153 ```bash
  154 /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses
  155 # Press 'y' for each license (7 total)
  156 ```
  157 
  158 #### Install required components
  159 
  160 ```bash
  161 /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager \
  162   --sdk_root=/opt/android-sdk \
  163   "platform-tools" \
  164   "platforms;android-33" \
  165   "build-tools;33.0.0"
  166 ```
  167 
  168 #### Configure environment variables
  169 
  170 ```bash
  171 cat >> ~/.bashrc << 'EOF'
  172 
  173 # Android SDK
  174 export ANDROID_HOME=/opt/android-sdk
  175 export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
  176 export PATH=$PATH:$ANDROID_HOME/platform-tools
  177 
  178 # Java JDK
  179 export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
  180 EOF
  181 
  182 source ~/.bashrc
  183 ```
  184 
  185 #### Verify installation
  186 
  187 ```bash
  188 sdkmanager --version    # 12.0
  189 adb --version           # 1.0.41
  190 echo $ANDROID_HOME      # /opt/android-sdk
  191 echo $JAVA_HOME         # /usr/lib/jvm/java-17-openjdk-amd64
  192 ```
  193 
  194 **Total disk usage**: ~800 MB (SDK ~448 MB + Java ~350 MB)
  195 
  196 ---
  197 
  198 ### Step 3: Clone Repository and Prepare Backend
  199 
  200 ```bash
  201 # Clone repository
  202 cd ~
  203 git clone https://github.com/mundodigitalpro/expo-android-builder.git
  204 cd expo-android-builder
  205 
  206 # Copy backend server files to deployment location
  207 sudo mkdir -p /root/apps/builder
  208 sudo cp -r server/* /root/apps/builder/
  209 ```
  210 
  211 ---
  212 
  213 ### Step 4: Create Docker Configuration
  214 
  215 #### Dockerfile
  216 
  217 Create `/root/apps/builder/Dockerfile`:
  218 
  219 ```dockerfile
  220 FROM node:18-bullseye-slim
  221 
  222 # Install system dependencies
  223 RUN apt-get update && apt-get install -y \
  224     git \
  225     curl \
  226     wget \
  227     unzip \
  228     && rm -rf /var/lib/apt/lists/*
  229 
  230 WORKDIR /app
  231 
  232 # Install dependencies
  233 COPY package*.json ./
  234 RUN npm install --production
  235 
  236 # Copy application code
  237 COPY . .
  238 
  239 # Create projects directory
  240 RUN mkdir -p /app-builder-projects
  241 
  242 # Expose port
  243 EXPOSE 3001
  244 
  245 # Environment variables
  246 ENV NODE_ENV=production
  247 ENV PORT=3001
  248 ENV HOST=0.0.0.0
  249 
  250 # Start server
  251 CMD ["node", "server.js"]
  252 ```
  253 
  254 #### docker-compose.yml
  255 
  256 Create `/root/apps/builder/docker-compose.yml`:
  257 
  258 ```yaml
  259 version: '3.8'
  260 
  261 services:
  262   expo-builder:
  263     build: .
  264     container_name: expo-builder
  265     restart: unless-stopped
  266     ports:
  267       - "3001:3001"
  268     environment:
  269       - NODE_ENV=production
  270       - PORT=3001
  271       - HOST=0.0.0.0
  272       - AUTH_TOKEN=${AUTH_TOKEN}
  273       - PROJECTS_BASE_PATH=/app-builder-projects
  274       - ANDROID_HOME=/opt/android-sdk
  275       - JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
  276       - PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/usr/l
      ib/jvm/java-17-openjdk-amd64/bin
  277     volumes:
  278       # Docker managed volume for projects
  279       - app-builder-projects:/app-builder-projects
  280       # Mount Android SDK from host (read-only)
  281       - /opt/android-sdk:/opt/android-sdk:ro
  282       # Mount Java JDK from host (read-only)
  283       - /usr/lib/jvm/java-17-openjdk-amd64:/usr/lib/jvm/java-17-openjdk-amd64:ro
  284     networks:
  285       - builder-network
  286 
  287 volumes:
  288   app-builder-projects:
  289     driver: local
  290 
  291 networks:
  292   builder-network:
  293     driver: bridge
  294 ```
  295 
  296 #### .env file
  297 
  298 Create `/root/apps/builder/.env`:
  299 
  300 ```bash
  301 AUTH_TOKEN=your-secure-token-here
  302 ```
  303 
  304 **Important**: Replace `your-secure-token-here` with a strong, randomly generated token.
  305 
  306 ---
  307 
  308 ### Step 5: Fix package.json (uuid compatibility)
  309 
  310 The uuid package needs to be downgraded for CommonJS compatibility:
  311 
  312 Edit `/root/apps/builder/package.json`:
  313 
  314 ```json
  315 {
  316   "dependencies": {
  317     "uuid": "^9.0.0"  // Changed from ^13.0.0
  318   }
  319 }
  320 ```
  321 
  322 This fixes the `ERR_REQUIRE_ESM` error that occurs with uuid v13+.
  323 
  324 ---
  325 
  326 ### Step 6: Configure Nginx and SSL
  327 
  328 Use the existing `new-subdomain.sh` script from the VPS setup:
  329 
  330 ```bash
  331 ~/hetzner-vps-setup/scripts/new-subdomain.sh builder 3001
  332 ```
  333 
  334 This script will:
  335 1. Create Nginx configuration at `/etc/nginx/sites-available/builder`
  336 2. Enable the site (symlink to `/etc/nginx/sites-enabled/`)
  337 3. Obtain SSL certificate via Certbot (DNS-01 Cloudflare)
  338 4. Reload Nginx
  339 
  340 **Manual Nginx configuration** (if not using script):
  341 
  342 ```nginx
  343 # /etc/nginx/sites-available/builder
  344 server {
  345     listen 80;
  346     server_name builder.josejordan.dev;
  347     return 301 https://$server_name$request_uri;
  348 }
  349 
  350 server {
  351     listen 443 ssl http2;
  352     server_name builder.josejordan.dev;
  353 
  354     ssl_certificate /etc/letsencrypt/live/builder.josejordan.dev/fullchain.pem;
  355     ssl_certificate_key /etc/letsencrypt/live/builder.josejordan.dev/privkey.pem;
  356 
  357     client_max_body_size 100M;
  358 
  359     location / {
  360         proxy_pass http://localhost:3001;
  361         proxy_http_version 1.1;
  362         proxy_set_header Upgrade $http_upgrade;
  363         proxy_set_header Connection 'upgrade';
  364         proxy_set_header Host $host;
  365         proxy_set_header X-Real-IP $remote_addr;
  366         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  367         proxy_set_header X-Forwarded-Proto $scheme;
  368         proxy_cache_bypass $http_upgrade;
  369     }
  370 
  371     # WebSocket support
  372     location /socket.io {
  373         proxy_pass http://localhost:3001;
  374         proxy_http_version 1.1;
  375         proxy_set_header Upgrade $http_upgrade;
  376         proxy_set_header Connection "upgrade";
  377         proxy_set_header Host $host;
  378     }
  379 }
  380 ```
  381 
  382 ---
  383 
  384 ### Step 7: Configure Cloudflare DNS
  385 
  386 1. **Add A record**:
  387    - Type: A
  388    - Name: builder
  389    - Content: [VPS IP address]
  390    - Proxy status: Proxied (orange cloud)
  391 
  392 2. **Configure Cache Rule** (important for API responses):
  393    - Rule name: "Bypass cache for builder API"
  394    - Match: `builder.josejordan.dev/*`
  395    - Action: Bypass cache
  396 
  397 ---
  398 
  399 ### Step 8: Build and Start Container
  400 
  401 ```bash
  402 cd /root/apps/builder
  403 
  404 # Build Docker image
  405 docker compose build
  406 
  407 # Start container
  408 docker compose up -d
  409 
  410 # Verify container is running
  411 docker compose ps
  412 
  413 # Check logs
  414 docker compose logs -f
  415 ```
  416 
  417 ---
  418 
  419 ### Step 9: Verification
  420 
  421 #### Health Check
  422 
  423 ```bash
  424 # Local health check
  425 curl http://localhost:3001/health
  426 
  427 # Public health check
  428 curl https://builder.josejordan.dev/health
  429 ```
  430 
  431 Expected response:
  432 ```json
  433 {
  434   "status": "ok",
  435   "timestamp": "2024-12-31T...",
  436   "uptime": 123.456
  437 }
  438 ```
  439 
  440 #### Verify Android SDK Access
  441 
  442 ```bash
  443 # Enter container
  444 docker exec -it expo-builder bash
  445 
  446 # Inside container, verify SDK
  447 echo $ANDROID_HOME          # /opt/android-sdk
  448 echo $JAVA_HOME             # /usr/lib/jvm/java-17-openjdk-amd64
  449 java -version               # openjdk 17.0.17
  450 sdkmanager --version        # 12.0
  451 adb --version               # 1.0.41
  452 ```
  453 
  454 ---
  455 
  456 ## Maintenance
  457 
  458 ### View Logs
  459 
  460 ```bash
  461 cd /root/apps/builder
  462 docker compose logs -f
  463 ```
  464 
  465 ### Restart Service
  466 
  467 ```bash
  468 cd /root/apps/builder
  469 docker compose restart
  470 ```
  471 
  472 ### Stop Service
  473 
  474 ```bash
  475 cd /root/apps/builder
  476 docker compose down
  477 ```
  478 
  479 ### Update Application
  480 
  481 ```bash
  482 cd ~/expo-android-builder
  483 git pull
  484 
  485 # Copy updated files
  486 sudo cp -r server/* /root/apps/builder/
  487 
  488 # Rebuild and restart
  489 cd /root/apps/builder
  490 docker compose down
  491 docker compose build
  492 docker compose up -d
  493 ```
  494 
  495 ### Clean Docker Resources
  496 
  497 ```bash
  498 # Remove unused images
  499 docker image prune -a
  500 
  501 # Remove unused volumes (CAUTION: this removes project data!)
  502 docker volume prune
  503 
  504 # View disk usage
  505 docker system df
  506 ```
  507 
  508 ### SSL Certificate Renewal
  509 
  510 Certificates auto-renew via `certbot.timer`. Check status:
  511 
  512 ```bash
  513 # View all certificates
  514 sudo certbot certificates
  515 
  516 # Test renewal
  517 sudo certbot renew --dry-run
  518 ```
  519 
  520 ---
  521 
  522 ## Resource Usage
  523 
  524 | Resource | Usage | Notes |
  525 |----------|-------|-------|
  526 | Disk Space | ~1.5 GB | SDK (448MB) + Java (350MB) + Docker image (~200MB) + projects |
  527 | Memory | ~200-300 MB | Container at idle |
  528 | CPU | Low (<5%) | Spikes during builds |
  529 | Network | Minimal | Builds download dependencies |
  530 
  531 ---
  532 
  533 ## Security Considerations
  534 
  535 ### Authentication
  536 
  537 - Bearer token required for all `/api/*` endpoints
  538 - Token stored in `.env` file (not in version control)
  539 - Use strong, randomly generated tokens
  540 
  541 ### Firewall
  542 
  543 - **Hetzner Cloud Firewall**: Only ports 22, 80, 443 allowed
  544 - **UFW (host)**: Same ports configured
  545 - Container isolated on Docker bridge network
  546 
  547 ### SSL/TLS
  548 
  549 - Let's Encrypt certificates with Cloudflare DNS-01 challenge
  550 - Auto-renewal every 60 days
  551 - TLS 1.2+ enforced by Nginx
  552 
  553 ### Container Security
  554 
  555 - Non-root user recommended (not implemented in MVP)
  556 - Read-only mounts for SDK and Java
  557 - Project volumes isolated from host filesystem
  558 
  559 ---
  560 
  561 ## Troubleshooting
  562 
  563 ### Container Keeps Restarting
  564 
  565 Check logs for errors:
  566 ```bash
  567 docker compose logs
  568 ```
  569 
  570 Common issue: uuid package ESM/CommonJS incompatibility
  571 - **Solution**: Downgrade uuid to v9.0.0 in package.json
  572 
  573 ### SDK Not Found in Container
  574 
  575 Verify volume mounts:
  576 ```bash
  577 docker compose config
  578 ```
  579 
  580 Check environment variables:
  581 ```bash
  582 docker exec expo-builder env | grep ANDROID_HOME
  583 ```
  584 
  585 ### Nginx 502 Bad Gateway
  586 
  587 Container not running or port mismatch:
  588 ```bash
  589 docker compose ps
  590 sudo ss -tulpn | grep :3001
  591 ```
  592 
  593 ### Build Failures
  594 
  595 Enter container and test manually:
  596 ```bash
  597 docker exec -it expo-builder bash
  598 cd /app-builder-projects/test-project
  599 npx expo build:android
  600 ```
  601 
  602 Check Android SDK licenses:
  603 ```bash
  604 docker exec expo-builder sdkmanager --licenses
  605 ```
  606 
  607 ---
  608 
  609 ## Differences from PLAN_MVP_VPS.md
  610 
  611 The original plan proposed PM2 for process management. The actual implementation uses Docker for these reasons:
  612 
  613 | Aspect | Original Plan (PM2) | Actual Implementation (Docker) |
  614 |--------|-------------------|--------------------------------|
  615 | **Process Management** | PM2 | Docker Compose |
  616 | **Isolation** | None | Container isolation |
  617 | **Dependency Management** | System-wide | Container-specific |
  618 | **Reproducibility** | Manual setup | Dockerfile (infrastructure as code) |
  619 | **SDK Access** | Direct installation | Volume mounts from host |
  620 | **Portability** | VPS-specific | Portable via Docker |
  621 | **Resource Limits** | PM2 config | Docker resources (if needed) |
  622 
  623 **Benefits of Docker approach**:
  624 - Easier to recreate environment
  625 - Better isolation from host system
  626 - Simplified dependency management
  627 - Consistent with existing VPS infrastructure (all apps use Docker)
  628 
  629 ---
  630 
  631 ## Production Endpoints
  632 
  633 ### Base URL
  634 
  635 - **Development**: http://localhost:3001
  636 - **Production**: https://builder.josejordan.dev
  637 
  638 ### API Endpoints
  639 
  640 All endpoints require `Authorization: Bearer <token>` header except `/health`.
  641 
  642 - `GET /health` - Health check (public)
  643 - `GET /api/projects` - List all projects
  644 - `POST /api/projects` - Create new project
  645 - `GET /api/projects/:name` - Get project details
  646 - `DELETE /api/projects/:name` - Delete project
  647 
  648 ### WebSocket
  649 
  650 - Endpoint: `wss://builder.josejordan.dev/socket.io`
  651 - Events: `claude:message`, `claude:response`, `build:status`, etc.
  652 
  653 ---
  654 
  655 ## Future Improvements
  656 
  657 - [ ] Non-root user in Docker container
  658 - [ ] Resource limits (CPU/memory) in docker-compose.yml
  659 - [ ] Health check in Dockerfile
  660 - [ ] Automated backups of project volumes
  661 - [ ] Monitoring and alerting (Prometheus/Grafana)
  662 - [ ] Multi-stage Docker build for smaller image
  663 - [ ] GitHub Actions for CI/CD
  664 
  665 ---
  666 
  667 ## References
  668 
  669 - [VPS Setup Documentation](/home/josejordan/hetzner-vps-setup/)
  670 - [Android Build Environment Guide](/home/josejordan/hetzner-vps-setup/docs/08-android-build-environment.md)
  671 - [Original MVP Plan](./PLAN_MVP_VPS.md)
  672 - [Docker Documentation](https://docs.docker.com/)
  673 - [Expo CLI Documentation](https://docs.expo.dev/workflow/expo-cli/)
  674 
  675 ---
  676 
  677 **Last Updated**: December 31, 2024
  678 **Deployed Version**: 1.0.0
  679 **Maintainer**: [@mundodigitalpro](https://github.com/mundodigitalpro)
---

## ✅ Production Configuration - Verified January 1, 2026

### Final Architecture (Hybrid Approach)

After resolving GLIBC compatibility issues, the production deployment uses a **hybrid approach**:

| Component | Location | Version | Size | Notes |
|-----------|----------|---------|------|-------|
| **Java JDK 17** | Inside container | 17.0.17 | ~400MB | Installed via apt (compatible with Debian 11) |
| **Android SDK** | Mounted from host | 12.0 | 448MB | Read-only mount from `/opt/android-sdk` |
| **Expo CLI** | Inside container | 6.3.12 | ~700MB | Global npm install |
| **EAS CLI** | Inside container | 16.28.0 | Included | Global npm install |
| **Node.js** | Inside container | 18.20.8 | Base image | node:18-bullseye-slim |
| **uuid package** | Inside container | 9.0.0 | - | Downgraded for CommonJS compatibility |

**Total Docker Image Size**: 1.38GB

### Why Hybrid Instead of All-Host or All-Container?

**Problem Encountered (Dec 31)**: Mounting Java from Ubuntu 24.04 host (GLIBC 2.39) into Debian 11 container (GLIBC 2.31) caused fatal incompatibility:
```
java: /lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.34' not found
```

**Solution (Jan 1)**: Hybrid approach balances space efficiency with compatibility:
- ✅ **Java inside container**: Guarantees GLIBC compatibility (Debian 11 → Debian 11)
- ✅ **Android SDK mounted**: Shares 448MB across containers, no GLIBC dependency
- ✅ **CLIs inside container**: Isolated dependencies, easier updates

### Verified Functionality

```bash
# Java - ✅ Working
$ docker exec expo-builder java -version
openjdk version "17.0.17" 2025-10-21

# Android SDK Manager - ✅ Working
$ docker exec expo-builder sdkmanager --version
12.0

# ADB - ✅ Working
$ docker exec expo-builder adb --version
Android Debug Bridge version 1.0.41

# Expo CLI - ✅ Working (with Node 17+ warning)
$ docker exec expo-builder expo --version
6.3.12

# EAS CLI - ✅ Working
$ docker exec expo-builder eas --version
eas-cli/16.28.0 linux-x64 node-v18.20.8

# Public endpoint - ✅ Working
$ curl https://builder.josejordan.dev/health
{"status":"ok","timestamp":"2026-01-01T19:12:36.516Z","uptime":66.89}
```

### Key Changes from Initial Deployment

1. **Dockerfile**: Added `openjdk-17-jdk` installation and global npm packages (expo-cli, eas-cli)
2. **docker-compose.yml**: Removed Java mount from host, kept only Android SDK mount
3. **package.json**: Downgraded `uuid` from ^13.0.0 to ^9.0.0 (CommonJS compatibility)
4. **Image size**: Increased from 296MB to 1.38GB (trade-off for full functionality)

### Git Commits

- `446f08e` - fix: Install Java and CLIs inside container for GLIBC compatibility
- `7883e1d` - fix: Downgrade uuid to v9.0.0 for CommonJS compatibility

---

**Status**: ✅ Fully operational with all features working
**Updated**: January 2, 2026
**Version**: 1.0.2 (Git-based Deployment)

---

## ✅ Git-Based Deployment System - January 2, 2026

### Migration from Manual Copy to Git Clone

**Problem**: The original deployment used manual file copying from development directory to `/apps/builder`:
```bash
# Old approach (error-prone)
sudo cp -r server/* /apps/builder/
```

**Issues**:
- Manual synchronization required
- No version control in production
- Risk of forgetting to copy files
- `git pull` commands would fail (not a git repository)

**Solution**: Convert `/apps/builder` to a git repository clone.

### New Deployment Architecture

```
Development                  GitHub                    Production
─────────────                ──────                    ──────────
/home/josejordan/            Repository                /home/josejordan/apps/
expo-android-builder/        (git)                     builder/
├── server/                                            ├── server/
├── app/                                               ├── app/
└── docs/                                              └── docs/
     │                                                       ▲
     │                                                       │
     └─ git push ──> GitHub ──> git pull ──────────────────┘
```

### Implementation Steps (Completed)

1. **Backup Configuration**:
```bash
# Save .env file
cp /home/josejordan/apps/builder/server/.env \
   /home/josejordan/apps/builder.env.backup
```

2. **Stop Running Services**:
```bash
cd /home/josejordan/apps/builder/server
docker compose down
```

3. **Replace with Git Clone**:
```bash
# Remove old directory
rm -rf /home/josejordan/apps/builder

# Clone repository
git clone git@github.com:mundodigitalpro/expo-android-builder.git \
          /home/josejordan/apps/builder
```

4. **Restore Configuration**:
```bash
# Restore .env file
cp /home/josejordan/apps/builder.env.backup \
   /home/josejordan/apps/builder/server/.env
```

5. **Create Deployment Scripts**:

Created two deployment scripts for convenience:

**`/home/josejordan/apps/builder/server/deploy.sh`**:
```bash
#!/bin/bash
# Full deployment script with all steps
set -e

echo "🚀 Starting deployment of Expo Android Builder..."

cd "$(dirname "$0")/.."

# Pull latest changes
echo "📥 Pulling latest changes from repository..."
git pull origin main

cd server

# Stop containers
echo "🛑 Stopping running containers..."
docker compose down

# Build fresh image
echo "🔨 Building Docker image (no cache)..."
docker compose build --no-cache

# Start containers
echo "▶️  Starting containers..."
docker compose up -d

# Show logs
echo "📋 Recent logs:"
docker compose logs --tail=20

echo ""
echo "✅ Deployment completed successfully!"
```

**`/home/josejordan/apps/builder/deploy.sh`** (root):
```bash
#!/bin/bash
# Quick wrapper script
set -e
cd "$(dirname "$0")"
exec ./server/deploy.sh
```

### Deployment Workflow

#### Option 1: From project root
```bash
cd /home/josejordan/apps/builder
./deploy.sh
```

#### Option 2: From server directory
```bash
cd /home/josejordan/apps/builder/server
./deploy.sh
```

### What the Deploy Script Does

1. ✅ **Pull latest code**: `git pull origin main`
2. ✅ **Stop services**: `docker compose down`
3. ✅ **Build fresh image**: `docker compose build --no-cache`
4. ✅ **Start services**: `docker compose up -d`
5. ✅ **Show logs**: Recent 20 lines for verification

### Benefits of Git-Based Deployment

| Aspect | Manual Copy (Old) | Git Clone (New) |
|--------|------------------|-----------------|
| **Synchronization** | Manual | Automatic with git pull |
| **Version Control** | No | Full git history |
| **Traceability** | None | Git commit SHAs |
| **Rollback** | Difficult | `git checkout <commit>` |
| **Automation** | Requires scripts | Built into git |
| **Reliability** | Error-prone | Consistent |

### Development to Production Workflow

1. **Develop locally** (in `/home/josejordan/expo-android-builder`):
```bash
cd /home/josejordan/expo-android-builder
# Make changes...
```

2. **Test changes**:
```bash
cd server
./start-all-services.sh
# Test locally...
```

3. **Commit and push**:
```bash
git add .
git commit -m "feat: Add new feature"
git push origin main
```

4. **Deploy to production**:
```bash
cd /home/josejordan/apps/builder
./deploy.sh
```

### Verification

After deployment, verify everything works:

```bash
# Check container status
cd /home/josejordan/apps/builder/server
docker compose ps

# Check logs
docker compose logs --tail=50

# Test health endpoint
curl https://builder.josejordan.dev/health

# Verify git repository
cd /home/josejordan/apps/builder
git status
git log -1
```

### Quick Commands Reference

```bash
# Deploy latest changes
cd /home/josejordan/apps/builder && ./deploy.sh

# View logs
cd /home/josejordan/apps/builder/server && docker compose logs -f

# Restart without rebuild
cd /home/josejordan/apps/builder/server && docker compose restart

# Check git status
cd /home/josejordan/apps/builder && git status

# Rollback to previous commit
cd /home/josejordan/apps/builder && git checkout <commit-hash> && ./deploy.sh
```

### Migration Summary

| Action | Date | Commit | Status |
|--------|------|--------|--------|
| Convert to git repository | Jan 2, 2026 | - | ✅ Complete |
| Create deploy scripts | Jan 2, 2026 | - | ✅ Complete |
| Test deployment | Jan 2, 2026 | - | ✅ Verified |
| Production running | Jan 2, 2026 | 5a96e7f | ✅ Active |

**Production Status**: ✅ Running with git-based deployment
**Last Deployment**: January 2, 2026
**Current Commit**: bf66c8a - fix: Use /bin/sh for spawn and add bash to Dockerfile

---

## ✅ Local Build System - January 2, 2026

### Feature: Local Android Builds (Non-EAS)

The system now supports building Android APKs locally on the VPS using the installed Android SDK and Java JDK, without relying on EAS Cloud.

| Component | Status | Detail |
|-----------|--------|---------|
| **Service** | ✅ Active | `LocalBuildService.js` using `expo prebuild` + `gradlew assembleDebug` |
| **Streaming** | ✅ Active | Real-time output via Socket.io |
| **NDK** | ✅ Installed | Version `27.1.12297006` |
| **Shell** | ✅ Fixed | Using `/bin/sh -c` for spawn compatibility |

### NDK Requirement & Installation

Local builds require the Android NDK. Since the SDK is mounted from the host, the NDK should be installed in the host's SDK directory.

**Requirements**:
- **NDK Version**: `27.1.12297006`
- **Disk Space**: ~1.3 GB additional

**Installation Steps (on VPS Host)**:
1. Temporarily change SDK mount to read-write in `docker-compose.yml`:
   ```yaml
   volumes:
     - /opt/android-sdk:/opt/android-sdk:rw  # Changed from :ro
   ```
2. Restart container: `docker compose down && docker compose up -d`
3. Install NDK via container's sdkmanager:
   ```bash
   docker exec expo-builder sdkmanager "ndk;27.1.12297006"
   ```
4. Verify installation:
   ```bash
   ls /opt/android-sdk/ndk/27.1.12297006/
   ```
5. (Optional) Revert mount to `:ro` for security.

### Local Build API Endpoints

All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| **POST** | `/api/local-builds/start` | Start build (params: `projectPath`, `buildType`) |
| **GET** | `/api/local-builds/status/:id` | Check build progress |
| **GET** | `/api/local-builds/list` | List all local builds |
| **POST** | `/api/local-builds/cancel` | Cancel running build |
| **GET** | `/api/local-builds/download/:id` | Download generated APK |

### Final Verification Result

- **Build ID**: `local-1767354642115-8pmjh`
- **Result**: ✅ Success
- **Time**: ~15 minutes
- **APK Location**: `.../android/app/build/outputs/apk/debug/app-debug.apk`

---

**Current Status**: 🚀 FULLY OPERATIONAL (EAS + Local Builds)
**Last Update**: January 2, 2026 (13:50)
