FROM node:18-bullseye-slim

# Instalar dependencias del sistema y Java JDK 17
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    unzip \
    bash \
    rsync \
    openjdk-17-jdk \
    && rm -rf /var/lib/apt/lists/*

# Configurar variables de entorno para Java
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$PATH:$JAVA_HOME/bin

# Configurar directorio de trabajo
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias de Node.js
RUN npm install --production

# Instalar CLIs globales (Expo y EAS)
RUN npm install -g expo-cli eas-cli

# Instalar Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Copiar código fuente
COPY . .

# Crear directorio para proyectos
RUN mkdir -p /app-builder-projects

# Crear usuario no-root (usar UID 1000 con grupo node existente)
RUN useradd -r -u 1000 -g node -m -d /home/builder -s /bin/bash builder

# Crear directorio para Claude config
RUN mkdir -p /home/builder/.claude && \
    chown -R builder:node /home/builder/.claude

# Cambiar permisos de directorios
RUN chown -R builder:node /app /app-builder-projects

# Exponer puerto
EXPOSE 3001

# Configurar Claude Code
ENV CLAUDE_CONFIG_DIR=/home/builder/.claude
ENV CLAUDE_NO_TELEMETRY=1

# Variables de entorno por defecto (pueden ser sobrescritas por docker-compose)
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Cambiar a usuario no-root
USER builder

# Iniciar servidor
CMD ["node", "server.js"]
