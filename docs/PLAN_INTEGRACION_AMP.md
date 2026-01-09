# Plan de Integración: Amp Code en Expo Android Builder

## Resumen Ejecutivo

**Objetivo**: Integrar Amp Code como alternativa a Claude Code en la aplicación, permitiendo al usuario elegir entre ambos agentes de IA.

**Fecha de creación**: 9 Enero 2026  
**Estado**: 📋 Planificado  
**Duración estimada**: 3-5 días  
**Desarrollador**: josejordandev

---

## ¿Por qué Amp Code?

| Característica | Claude Code | Amp Code |
|----------------|-------------|----------|
| CLI disponible | ✅ `claude` | ✅ `amp` |
| Streaming output | ✅ | ✅ JSON nativo |
| SDK Node.js oficial | ❌ | ✅ `@anthropic-ai/amp` |
| Multi-modelo | Solo Claude | GPT-5, Opus 4.5, Sonnet |
| Threads persistentes | ❌ | ✅ |
| Modo gratuito | ❌ | ✅ $10/día |
| MCP Integration | ❌ | ✅ |

**Ventajas clave de añadir Amp**:
1. Acceso a múltiples modelos (GPT-5, Claude Opus 4.5)
2. Threads que persisten entre sesiones
3. SDK oficial para Node.js con mejor integración
4. Modo gratuito para desarrollo

---

## Arquitectura Propuesta

### Estado Actual
```
App (ClaudeCodeScreen)
    ↓ WebSocket
Server (ClaudeService.js)
    ↓ spawn()
Claude CLI
```

### Estado Objetivo
```
App (AICodeScreen)
    ↓ WebSocket
    ↓ Parámetro: { provider: 'claude' | 'amp' }
Server (AIService.js)
    ├─→ ClaudeService.js → Claude CLI
    └─→ AmpService.js → Amp CLI / SDK
```

---

## Plan de Implementación

### FASE 1: Backend - AmpService.js (Día 1)

#### 1.1 Verificar instalación de Amp CLI en Termux

```bash
# Instalar Amp CLI
npm install -g @sourcegraph/amp

# Verificar instalación
amp --version

# Login (primera vez)
amp login
```

#### 1.2 Crear `server/src/services/AmpService.js`

**Archivo a CREAR**: `server/src/services/AmpService.js`

```javascript
const { spawn } = require('child_process');
const logger = require('../utils/logger');

class AmpService {
  constructor() {
    this.activeSessions = new Map();
    this.ampAvailable = false;
    this.checkAmpCLI();
  }

  async checkAmpCLI() {
    try {
      const checkProcess = spawn('amp', ['--version']);

      checkProcess.on('close', (code) => {
        if (code === 0) {
          this.ampAvailable = true;
          logger.info('Amp CLI detected and available');
        } else {
          this.ampAvailable = false;
          logger.warn('Amp CLI check returned non-zero exit code', { code });
        }
      });

      checkProcess.on('error', (error) => {
        this.ampAvailable = false;
        logger.warn('Amp CLI not available', { error: error.message });
      });
    } catch (error) {
      this.ampAvailable = false;
      logger.error('Error checking Amp CLI', { error: error.message });
    }
  }

  isAvailable() {
    return this.ampAvailable;
  }

  async executeAmpCommand(projectPath, prompt, socket, options = {}) {
    try {
      if (!this.ampAvailable) {
        throw new Error('Amp CLI is not installed or not available. Install with: npm install -g @sourcegraph/amp');
      }

      logger.info('Executing Amp Code command', {
        projectPath,
        promptLength: prompt.length
      });

      const sessionId = `amp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Argumentos para Amp CLI
      // -x: Execute mode (non-interactive)
      // --stream-json: Output como JSON stream
      // --dangerously-allow-all: Skip permission prompts
      const args = [
        '-x',
        '--stream-json',
        '--dangerously-allow-all',
        prompt
      ];

      // Si hay un threadId previo, continuar el thread
      if (options.threadId) {
        args.unshift('threads', 'continue', '--thread', options.threadId);
      }

      logger.info('Starting Amp process', {
        sessionId,
        args: args.map((a, i) => a.length > 50 ? `"${a.substring(0, 50)}..."` : a),
        cwd: projectPath
      });

      const ampProcess = spawn('amp', args, {
        cwd: projectPath,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { 
          ...process.env,
          AMP_API_KEY: process.env.AMP_API_KEY || ''
        }
      });

      this.activeSessions.set(sessionId, ampProcess);

      logger.info('Amp process spawned', { sessionId, pid: ampProcess.pid });

      // Buffer para acumular JSON parcial
      let jsonBuffer = '';

      // Stream stdout (JSON format)
      ampProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        jsonBuffer += chunk;

        // Intentar parsear líneas JSON completas
        const lines = jsonBuffer.split('\n');
        jsonBuffer = lines.pop() || ''; // Mantener línea incompleta en buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              this.handleAmpMessage(parsed, sessionId, socket);
            } catch (e) {
              // Si no es JSON válido, enviar como texto
              socket.emit('amp:output', {
                sessionId,
                type: 'text',
                content: line
              });
            }
          }
        }
      });

      // Stream stderr
      ampProcess.stderr.on('data', (data) => {
        const output = data.toString();
        logger.warn('Amp stderr received', { sessionId, content: output });
        socket.emit('amp:error', {
          sessionId,
          type: 'stderr',
          content: output
        });
      });

      // Proceso completado
      ampProcess.on('close', (code) => {
        logger.info('Amp process closed', { sessionId, exitCode: code });
        socket.emit('amp:complete', {
          sessionId,
          code
        });
        this.activeSessions.delete(sessionId);
      });

      // Error del proceso
      ampProcess.on('error', (error) => {
        logger.error('Amp process error', { sessionId, error: error.message });
        socket.emit('amp:error', {
          sessionId,
          type: 'error',
          content: `Process error: ${error.message}`
        });
        this.activeSessions.delete(sessionId);
      });

      return { sessionId };

    } catch (error) {
      logger.error('Failed to execute Amp Code', { error: error.message, projectPath });
      throw error;
    }
  }

  handleAmpMessage(message, sessionId, socket) {
    // Amp envía diferentes tipos de mensajes en JSON
    switch (message.type) {
      case 'system':
        socket.emit('amp:output', {
          sessionId,
          type: 'system',
          content: message.message || message.content
        });
        break;

      case 'assistant':
        socket.emit('amp:output', {
          sessionId,
          type: 'assistant',
          content: message.message?.content || message.content
        });
        break;

      case 'result':
        socket.emit('amp:output', {
          sessionId,
          type: 'result',
          content: message.result || message.content
        });
        break;

      case 'tool_use':
        socket.emit('amp:output', {
          sessionId,
          type: 'tool',
          tool: message.tool || message.name,
          content: message.input || message.content
        });
        break;

      default:
        socket.emit('amp:output', {
          sessionId,
          type: message.type || 'unknown',
          content: JSON.stringify(message)
        });
    }
  }

  stopSession(sessionId) {
    const process = this.activeSessions.get(sessionId);

    if (process) {
      process.kill('SIGTERM');
      this.activeSessions.delete(sessionId);
      logger.info('Amp session stopped', { sessionId });
      return true;
    }

    logger.warn('Attempted to stop non-existent Amp session', { sessionId });
    return false;
  }

  getActiveSessionsCount() {
    return this.activeSessions.size;
  }
}

module.exports = new AmpService();
```

#### 1.3 Crear rutas API para Amp

**Archivo a CREAR**: `server/src/routes/amp.js`

```javascript
const express = require('express');
const router = express.Router();
const ampService = require('../services/AmpService');
const { PROJECTS_BASE_PATH } = require('../config/constants');
const path = require('path');
const logger = require('../utils/logger');

// Verificar disponibilidad de Amp
router.get('/status', (req, res) => {
  res.json({
    available: ampService.isAvailable(),
    activeSessions: ampService.getActiveSessionsCount()
  });
});

// Ejecutar comando Amp (para llamadas REST, aunque preferimos WebSocket)
router.post('/execute', async (req, res) => {
  try {
    const { projectName, prompt, threadId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const projectPath = projectName 
      ? path.join(PROJECTS_BASE_PATH, projectName)
      : PROJECTS_BASE_PATH;

    // Nota: Para streaming real, usar WebSocket
    res.json({
      message: 'Use WebSocket for real-time streaming',
      endpoint: 'ws://server/socket.io',
      event: 'amp:execute'
    });

  } catch (error) {
    logger.error('Amp execute error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Cancelar sesión
router.post('/cancel', (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const stopped = ampService.stopSession(sessionId);

  if (stopped) {
    res.json({ message: 'Session cancelled', sessionId });
  } else {
    res.status(404).json({ error: 'Session not found', sessionId });
  }
});

module.exports = router;
```

#### 1.4 Registrar rutas y eventos WebSocket

**Archivo a MODIFICAR**: `server/server.js`

Añadir después de las rutas existentes:

```javascript
// Importar rutas de Amp
const ampRoutes = require('./src/routes/amp');
const ampService = require('./src/services/AmpService');

// Registrar rutas
app.use('/api/amp', authMiddleware, ampRoutes);

// WebSocket events para Amp (dentro del handler de socket.io)
socket.on('amp:execute', async (data) => {
  const { projectName, prompt, threadId } = data;
  const projectPath = projectName 
    ? path.join(PROJECTS_BASE_PATH, projectName)
    : PROJECTS_BASE_PATH;

  try {
    const result = await ampService.executeAmpCommand(
      projectPath, 
      prompt, 
      socket,
      { threadId }
    );
    socket.emit('amp:started', result);
  } catch (error) {
    socket.emit('amp:error', { 
      type: 'error', 
      content: error.message 
    });
  }
});

socket.on('amp:cancel', (data) => {
  const { sessionId } = data;
  ampService.stopSession(sessionId);
});
```

---

### FASE 2: Frontend - Pantalla AICode (Día 2-3)

#### 2.1 Crear `AICodeScreen.js` unificada

**Archivo a CREAR**: `app/screens/AICodeScreen.js`

Esta pantalla reemplazará/extenderá `ClaudeCodeScreen.js` con un toggle para elegir proveedor.

```javascript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { getSocket } from '../services/socket';

const PROVIDERS = {
  CLAUDE: 'claude',
  AMP: 'amp'
};

export default function AICodeScreen({ route }) {
  const { projectName } = route.params || {};
  
  const [provider, setProvider] = useState(PROVIDERS.CLAUDE);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [threadId, setThreadId] = useState(null); // Para Amp threads
  
  const flatListRef = useRef();
  const socketRef = useRef();

  useEffect(() => {
    socketRef.current = getSocket();
    setupSocketListeners();
    
    return () => {
      cleanupSocketListeners();
    };
  }, [provider]);

  const setupSocketListeners = () => {
    const socket = socketRef.current;
    
    if (provider === PROVIDERS.AMP) {
      socket.on('amp:output', handleAmpOutput);
      socket.on('amp:error', handleAmpError);
      socket.on('amp:complete', handleAmpComplete);
      socket.on('amp:started', handleAmpStarted);
    } else {
      socket.on('claude:output', handleClaudeOutput);
      socket.on('claude:error', handleClaudeError);
      socket.on('claude:complete', handleClaudeComplete);
    }
  };

  const cleanupSocketListeners = () => {
    const socket = socketRef.current;
    socket.off('amp:output');
    socket.off('amp:error');
    socket.off('amp:complete');
    socket.off('amp:started');
    socket.off('claude:output');
    socket.off('claude:error');
    socket.off('claude:complete');
  };

  const handleAmpOutput = (data) => {
    addMessage({
      type: data.type,
      content: data.content,
      provider: 'amp',
      timestamp: Date.now()
    });
  };

  const handleAmpError = (data) => {
    addMessage({
      type: 'error',
      content: data.content,
      provider: 'amp',
      timestamp: Date.now()
    });
  };

  const handleAmpComplete = (data) => {
    setIsLoading(false);
    setSessionId(null);
  };

  const handleAmpStarted = (data) => {
    setSessionId(data.sessionId);
    if (data.threadId) {
      setThreadId(data.threadId);
    }
  };

  // Handlers similares para Claude...
  const handleClaudeOutput = (data) => {
    addMessage({
      type: 'assistant',
      content: data.content,
      provider: 'claude',
      timestamp: Date.now()
    });
  };

  const handleClaudeError = (data) => {
    addMessage({
      type: 'error',
      content: data.content,
      provider: 'claude',
      timestamp: Date.now()
    });
  };

  const handleClaudeComplete = () => {
    setIsLoading(false);
    setSessionId(null);
  };

  const addMessage = (message) => {
    setMessages(prev => [...prev, { ...message, id: Date.now().toString() }]);
  };

  const sendMessage = () => {
    if (!inputText.trim() || isLoading) return;

    const socket = socketRef.current;
    const prompt = inputText.trim();

    // Añadir mensaje del usuario
    addMessage({
      type: 'user',
      content: prompt,
      provider: provider,
      timestamp: Date.now()
    });

    setInputText('');
    setIsLoading(true);

    if (provider === PROVIDERS.AMP) {
      socket.emit('amp:execute', {
        projectName,
        prompt,
        threadId // Continuar thread si existe
      });
    } else {
      socket.emit('claude:execute', {
        projectName,
        prompt
      });
    }
  };

  const cancelSession = () => {
    const socket = socketRef.current;
    
    if (provider === PROVIDERS.AMP) {
      socket.emit('amp:cancel', { sessionId });
    } else {
      socket.emit('claude:cancel', { sessionId });
    }
    
    setIsLoading(false);
  };

  const renderMessage = ({ item }) => {
    const isUser = item.type === 'user';
    const isError = item.type === 'error';
    
    return (
      <View style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.assistantMessage,
        isError && styles.errorMessage
      ]}>
        <Text style={styles.providerBadge}>
          {item.provider === 'amp' ? '⚡ Amp' : '🤖 Claude'}
        </Text>
        <Text style={styles.messageText}>{item.content}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Provider Toggle */}
      <View style={styles.providerToggle}>
        <Text style={[
          styles.providerLabel,
          provider === PROVIDERS.CLAUDE && styles.activeProvider
        ]}>
          🤖 Claude
        </Text>
        <Switch
          value={provider === PROVIDERS.AMP}
          onValueChange={(value) => {
            setProvider(value ? PROVIDERS.AMP : PROVIDERS.CLAUDE);
            setMessages([]); // Limpiar al cambiar
          }}
          trackColor={{ false: '#6366f1', true: '#10b981' }}
          thumbColor="#fff"
        />
        <Text style={[
          styles.providerLabel,
          provider === PROVIDERS.AMP && styles.activeProvider
        ]}>
          ⚡ Amp
        </Text>
      </View>

      {/* Thread indicator para Amp */}
      {provider === PROVIDERS.AMP && threadId && (
        <View style={styles.threadBadge}>
          <Text style={styles.threadText}>Thread: {threadId.slice(0, 8)}...</Text>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Pregunta a ${provider === PROVIDERS.AMP ? 'Amp' : 'Claude'}...`}
          multiline
          editable={!isLoading}
        />
        {isLoading ? (
          <TouchableOpacity style={styles.cancelButton} onPress={cancelSession}>
            <Text style={styles.buttonText}>⏹️</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.buttonText}>📤</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  providerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#16213e',
    gap: 12,
  },
  providerLabel: {
    fontSize: 14,
    color: '#888',
  },
  activeProvider: {
    color: '#fff',
    fontWeight: 'bold',
  },
  threadBadge: {
    backgroundColor: '#10b981',
    padding: 6,
    alignItems: 'center',
  },
  threadText: {
    color: '#fff',
    fontSize: 12,
  },
  messagesList: {
    flex: 1,
    padding: 12,
  },
  messageContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '85%',
  },
  userMessage: {
    backgroundColor: '#6366f1',
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    backgroundColor: '#2d3748',
    alignSelf: 'flex-start',
  },
  errorMessage: {
    backgroundColor: '#ef4444',
  },
  providerBadge: {
    fontSize: 10,
    color: '#aaa',
    marginBottom: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#16213e',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#2d3748',
    borderRadius: 20,
    padding: 12,
    color: '#fff',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#6366f1',
    borderRadius: 20,
    padding: 12,
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#ef4444',
    borderRadius: 20,
    padding: 12,
    marginLeft: 8,
  },
  buttonText: {
    fontSize: 18,
  },
});
```

#### 2.2 Actualizar navegación

**Archivo a MODIFICAR**: `app/App.js`

```javascript
// Añadir import
import AICodeScreen from './screens/AICodeScreen';

// En el Stack.Navigator, añadir o reemplazar:
<Stack.Screen 
  name="AICode" 
  component={AICodeScreen}
  options={{ title: 'AI Assistant' }}
/>
```

#### 2.3 Actualizar `services/api.js`

**Archivo a MODIFICAR**: `app/services/api.js`

Añadir:

```javascript
// Amp API
export const ampApi = {
  getStatus: () => api.get('/amp/status'),
  cancel: (sessionId) => api.post('/amp/cancel', { sessionId }),
};
```

---

### FASE 3: Configuración y Variables de Entorno (Día 3)

#### 3.1 Actualizar `.env` del servidor

**Archivo a MODIFICAR**: `server/.env`

```bash
# Existing config...
PORT=3001
AUTH_TOKEN=expo-builder-token-2024-secure

# Amp configuration (opcional si usas login)
AMP_API_KEY=your-amp-access-token
```

#### 3.2 Añadir configuración en Settings

**Archivo a MODIFICAR**: `app/screens/SettingsScreen.js`

Añadir sección para seleccionar proveedor de IA por defecto:

```javascript
// Añadir estado
const [defaultProvider, setDefaultProvider] = useState('claude');

// Añadir en el render
<View style={styles.section}>
  <Text style={styles.sectionTitle}>AI Provider</Text>
  <Picker
    selectedValue={defaultProvider}
    onValueChange={(value) => {
      setDefaultProvider(value);
      AsyncStorage.setItem('default_ai_provider', value);
    }}
  >
    <Picker.Item label="🤖 Claude Code" value="claude" />
    <Picker.Item label="⚡ Amp Code" value="amp" />
  </Picker>
</View>
```

---

### FASE 4: Testing y Documentación (Día 4-5)

#### 4.1 Tests manuales

| Test | Descripción | Estado |
|------|-------------|--------|
| Amp CLI disponible | Verificar `amp --version` en Termux | 🔲 |
| Amp login | Ejecutar `amp login` y verificar token | 🔲 |
| Backend AmpService | Probar `/api/amp/status` | 🔲 |
| WebSocket streaming | Enviar prompt y verificar output | 🔲 |
| Toggle provider | Cambiar entre Claude y Amp | 🔲 |
| Cancelar sesión | Probar botón de cancelar | 🔲 |
| Threads Amp | Verificar continuidad de threads | 🔲 |

#### 4.2 Comandos de prueba

```bash
# En Termux - verificar Amp
amp --version
amp login
echo "What is 2+2?" | amp -x

# Test del servidor
curl http://localhost:3001/api/amp/status \
  -H "Authorization: Bearer expo-builder-token-2024-secure"
```

---

## Archivos a Crear/Modificar

### Archivos NUEVOS (📝)

| Archivo | Descripción |
|---------|-------------|
| `server/src/services/AmpService.js` | Servicio principal de Amp |
| `server/src/routes/amp.js` | Rutas API para Amp |
| `app/screens/AICodeScreen.js` | Pantalla unificada Claude/Amp |

### Archivos a MODIFICAR (⚠️)

| Archivo | Cambios |
|---------|---------|
| `server/server.js` | Registrar rutas y eventos WebSocket de Amp |
| `server/.env` | Añadir `AMP_API_KEY` |
| `app/App.js` | Añadir navegación a AICodeScreen |
| `app/services/api.js` | Añadir `ampApi` |
| `app/screens/SettingsScreen.js` | Selector de proveedor por defecto |

---

## Dependencias

### Termux (desarrollo)

```bash
# Instalar Amp CLI
npm install -g @sourcegraph/amp

# Login
amp login
```

### VPS (producción) - Opcional

```bash
# En el VPS, si quieres usar Amp
npm install -g @sourcegraph/amp

# Configurar token via variable de entorno
export AMP_API_KEY=your-token-here
```

---

## Timeline

| Día | Tareas | Entregable |
|-----|--------|------------|
| **1** | FASE 1: Backend AmpService.js | Servidor responde a `/api/amp/status` |
| **2** | FASE 2: AICodeScreen.js (parte 1) | Toggle funcional, UI lista |
| **3** | FASE 2: WebSocket integration | Streaming funcionando |
| **4** | FASE 3: Configuración + FASE 4: Testing | Tests manuales pasan |
| **5** | Bugfixes, documentación, PR | Merge a main |

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Amp CLI no disponible en Termux | Baja | npm global funciona en Termux |
| Rate limiting de Amp | Media | Usar modo gratuito ($10/día) |
| Diferencias en output format | Media | Parsear JSON de Amp correctamente |
| Latencia mayor que Claude | Baja | Amp usa modelos optimizados |

---

## Referencias

- [Amp Owner's Manual](https://ampcode.com/manual)
- [Amp SDK Documentation](https://ampcode.com/manual/sdk)
- [Amp CLI Installation](https://ampcode.com/install)
- [Amp Pricing](https://ampcode.com/pricing)

---

## Próximos Pasos Inmediatos

1. **Instalar Amp CLI en Termux**:
   ```bash
   npm install -g @sourcegraph/amp
   amp login
   ```

2. **Probar Amp CLI manualmente**:
   ```bash
   amp -x "Create a hello world React component"
   ```

3. **Crear rama de desarrollo**:
   ```bash
   git checkout -b feature/amp-integration
   ```

4. **Empezar con FASE 1**: Crear `AmpService.js`

---

---

## Fixes Aplicados (9 Enero 2026)

### Fix 1: Mensajes duplicados
**Problema**: La respuesta de Amp aparecía dos veces.

**Causa**: Amp envía tanto `assistant` como `result` con el mismo contenido.

**Solución**: Filtrar mensajes `result` y `system init` en `AmpService.js`:
```javascript
case 'result':
  // No emitir - es duplicado del assistant
  logger.info('Amp result received (not emitting)');
  break;
```

### Fix 2: Contexto no persistente
**Problema**: Cada mensaje era una conversación nueva, Amp no recordaba el contexto.

**Causa**: No se estaba capturando ni reenviando el Thread ID de Amp.

**Solución**:
1. Capturar `session_id` del mensaje `system init`
2. Emitir evento `amp:thread` al frontend
3. Frontend guarda `threadId` en estado
4. Backend usa `amp threads continue <threadId>` para continuar

**Código clave**:
```javascript
// Backend - capturar thread ID
if (message.subtype === 'init' && message.session_id) {
  socket.emit('amp:thread', { threadId: message.session_id });
}

// Backend - continuar thread
if (options.threadId) {
  args = ['threads', 'continue', options.threadId, '--execute', prompt, ...];
}
```

---

**Última actualización**: 10 Enero 2026  
**Autor**: josejordandev (con asistencia de Amp)
