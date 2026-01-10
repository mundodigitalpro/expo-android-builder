import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import socketService from '../services/socket';
import { claudeApi, ampApi } from '../services/api';

const PROVIDERS = {
  CLAUDE: 'claude',
  AMP: 'amp',
};

export default function AICodeScreen({ route }) {
  const { project } = route.params;
  const [provider, setProvider] = useState(PROVIDERS.CLAUDE);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [connecting, setConnecting] = useState(true);
  const [ampAvailable, setAmpAvailable] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    const initializeSocket = async () => {
      try {
        setConnecting(true);
        await socketService.connect();
        setupSocketListeners();
        setConnecting(false);
        
        // Verificar disponibilidad de Amp
        checkAmpAvailability();
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        setConnecting(false);
        Alert.alert(
          'Error de Conexión',
          'No se pudo conectar al servidor.'
        );
      }
    };

    initializeSocket();

    return () => {
      cleanupSocketListeners();
    };
  }, []);

  // Reconfigurar listeners cuando cambia el provider
  useEffect(() => {
    if (!connecting) {
      cleanupSocketListeners();
      setupSocketListeners();
    }
  }, [provider]);

  const checkAmpAvailability = async () => {
    try {
      const response = await ampApi.getStatus();
      setAmpAvailable(response.data.available);
    } catch (error) {
      console.log('Amp not available:', error.message);
      setAmpAvailable(false);
    }
  };

  const setupSocketListeners = () => {
    if (provider === PROVIDERS.AMP) {
      socketService.on('amp:output', handleAmpOutput);
      socketService.on('amp:error', handleAmpError);
      socketService.on('amp:complete', handleAmpComplete);
      socketService.on('amp:started', handleAmpStarted);
      socketService.on('amp:thread', handleAmpThread);
    } else {
      socketService.on('claude:output', handleClaudeOutput);
      socketService.on('claude:error', handleClaudeError);
      socketService.on('claude:complete', handleClaudeComplete);
      socketService.on('claude:thread', handleClaudeThread);
    }
  };

  const cleanupSocketListeners = () => {
    socketService.off('amp:output');
    socketService.off('amp:error');
    socketService.off('amp:complete');
    socketService.off('amp:started');
    socketService.off('amp:thread');
    socketService.off('claude:output');
    socketService.off('claude:error');
    socketService.off('claude:complete');
    socketService.off('claude:thread');
  };

  // Amp handlers
  const handleAmpOutput = (data) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type: data.type === 'assistant' ? 'ai' : data.type,
        provider: 'amp',
        content: data.content,
        tool: data.tool,
        timestamp: new Date(),
      },
    ]);
  };

  const handleAmpError = (data) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type: 'error',
        provider: 'amp',
        content: data.content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleAmpComplete = (data) => {
    setLoading(false);
    setSessionId(null);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type: 'system',
        provider: 'amp',
        content: `Amp ha terminado. (exit code: ${data.code})`,
        timestamp: new Date(),
      },
    ]);
  };

  const handleAmpStarted = (data) => {
    setSessionId(data.sessionId);
  };

  const handleAmpThread = (data) => {
    // Guardar el thread ID de Amp para mantener contexto
    if (data.threadId) {
      console.log('Amp thread ID received:', data.threadId);
      setThreadId(data.threadId);
    }
  };

  // Claude handlers
  const handleClaudeOutput = (data) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type: 'ai',
        provider: 'claude',
        content: data.content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleClaudeError = (data) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type: 'error',
        provider: 'claude',
        content: data.content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleClaudeComplete = () => {
    setLoading(false);
    setSessionId(null);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type: 'system',
        provider: 'claude',
        content: 'Claude ha terminado de procesar tu solicitud.',
        timestamp: new Date(),
      },
    ]);
  };

  const handleClaudeThread = (data) => {
    if (data.threadId) {
      console.log('Claude thread ID received:', data.threadId);
      setThreadId(data.threadId);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    if (!socketService.isConnected()) {
      Alert.alert('Error de Conexión', 'No hay conexión con el servidor.');
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      provider: provider,
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const promptText = input;
    setInput('');
    setLoading(true);

    try {
      if (provider === PROVIDERS.AMP) {
        // Enviar via WebSocket para Amp
        socketService.emit('amp:execute', {
          projectName: project.name,
          prompt: promptText,
          threadId: threadId,
        });
      } else {
        // Usar API REST para Claude
        const result = await claudeApi.execute(
          project.path,
          promptText,
          socketService.getSocketId(),
          threadId
        );
        setSessionId(result.data.sessionId);
      }
    } catch (error) {
      console.error(`Error executing ${provider}:`, error);
      const errorMessage =
        error.response?.data?.error ||
        `No se pudo ejecutar ${provider === PROVIDERS.AMP ? 'Amp' : 'Claude'}.`;
      Alert.alert('Error', errorMessage);
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          type: 'error',
          provider: provider,
          content: errorMessage,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const cancelSession = async () => {
    if (!sessionId) return;

    try {
      if (provider === PROVIDERS.AMP) {
        socketService.emit('amp:cancel', { sessionId });
      } else {
        await claudeApi.cancel(sessionId);
      }
      setLoading(false);
      setSessionId(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          type: 'system',
          provider: provider,
          content: 'Sesión cancelada por el usuario.',
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Error cancelling session:', error);
      Alert.alert('Error', 'No se pudo cancelar la sesión');
    }
  };

  const switchProvider = (useAmp) => {
    if (loading) {
      Alert.alert('Espera', 'Hay una sesión en progreso. Cancélala primero.');
      return;
    }
    
    if (useAmp && !ampAvailable) {
      Alert.alert(
        'Amp no disponible',
        'Amp CLI no está instalado o no está autenticado. Ejecuta "amp login" en Termux.'
      );
      return;
    }
    
    setProvider(useAmp ? PROVIDERS.AMP : PROVIDERS.CLAUDE);
    setMessages([]);
    setThreadId(null);
  };

  const renderMessage = ({ item }) => {
    let messageStyle = [styles.message];
    let textStyle = [styles.messageText];

    if (item.type === 'user') {
      messageStyle.push(styles.userMessage);
      textStyle.push(styles.userMessageText);
    } else if (item.type === 'ai') {
      messageStyle.push(
        item.provider === 'amp' ? styles.ampMessage : styles.claudeMessage
      );
    } else if (item.type === 'tool') {
      messageStyle.push(styles.toolMessage);
      textStyle.push(styles.toolMessageText);
    } else if (item.type === 'error') {
      messageStyle.push(styles.errorMessage);
      textStyle.push(styles.errorMessageText);
    } else if (item.type === 'system') {
      messageStyle.push(styles.systemMessage);
      textStyle.push(styles.systemMessageText);
    }

    return (
      <View style={messageStyle}>
        {item.provider && item.type !== 'user' && (
          <Text style={styles.providerBadge}>
            {item.provider === 'amp' ? '⚡ Amp' : '🤖 Claude'}
            {item.tool && ` • ${item.tool}`}
          </Text>
        )}
        <Text style={textStyle}>{item.content}</Text>
      </View>
    );
  };

  const providerLabel = provider === PROVIDERS.AMP ? 'Amp' : 'Claude';
  const providerIcon = provider === PROVIDERS.AMP ? '⚡' : '🤖';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Provider Toggle */}
      <View style={styles.providerToggle}>
        <Text style={[
          styles.providerLabel,
          provider === PROVIDERS.CLAUDE && styles.activeProviderLabel
        ]}>
          🤖 Claude
        </Text>
        <Switch
          value={provider === PROVIDERS.AMP}
          onValueChange={switchProvider}
          trackColor={{ false: '#6366f1', true: '#10b981' }}
          thumbColor="#fff"
          disabled={loading}
        />
        <Text style={[
          styles.providerLabel,
          provider === PROVIDERS.AMP && styles.activeProviderLabel
        ]}>
          ⚡ Amp {!ampAvailable && '(N/A)'}
        </Text>
      </View>

      {/* Thread indicator for Amp */}
      {provider === PROVIDERS.AMP && threadId && (
        <View style={styles.threadBadge}>
          <Text style={styles.threadText}>
            🧵 Thread: {threadId.slice(0, 12)}...
          </Text>
        </View>
      )}

      {/* Project Header */}
      <View style={styles.projectHeader}>
        <Text style={styles.projectName}>📦 {project.name}</Text>
      </View>

      {connecting ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔄</Text>
          <Text style={styles.emptyTitle}>Conectando...</Text>
          <Text style={styles.emptyText}>
            Estableciendo conexión con el servidor
          </Text>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{providerIcon}</Text>
          <Text style={styles.emptyTitle}>Chat con {providerLabel}</Text>
          <Text style={styles.emptyText}>
            Escribe un mensaje para pedirle a {providerLabel} que modifique tu proyecto
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          contentContainerStyle={styles.messagesList}
        />
      )}

      {loading && (
        <View style={[
          styles.loadingIndicator,
          provider === PROVIDERS.AMP && styles.loadingIndicatorAmp
        ]}>
          <Text style={styles.loadingText}>
            {providerIcon} {providerLabel} está trabajando...
          </Text>
          <Pressable style={styles.cancelButton} onPress={cancelSession}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={
            connecting
              ? 'Conectando...'
              : `Escribe tu mensaje a ${providerLabel}...`
          }
          placeholderTextColor="#999"
          multiline
          maxLength={4000}
          editable={!loading && !connecting}
        />
        <Pressable
          style={[
            styles.sendButton,
            provider === PROVIDERS.AMP && styles.sendButtonAmp,
            (loading || !input.trim() || connecting) && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={loading || !input.trim() || connecting}
        >
          <Text style={styles.sendButtonText}>Enviar</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  providerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#1a1a2e',
    gap: 12,
  },
  providerLabel: {
    fontSize: 14,
    color: '#888',
  },
  activeProviderLabel: {
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
    fontWeight: '500',
  },
  projectHeader: {
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  messagesList: {
    padding: 8,
  },
  message: {
    padding: 12,
    margin: 8,
    borderRadius: 8,
    maxWidth: '85%',
  },
  providerBadge: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
    fontWeight: '500',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  claudeMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  ampMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  toolMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  errorMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffebee',
    borderWidth: 1,
    borderColor: '#ef5350',
  },
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: '#e3f2fd',
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  toolMessageText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  errorMessageText: {
    color: '#c62828',
  },
  systemMessageText: {
    color: '#1565c0',
    fontSize: 14,
  },
  loadingIndicator: {
    padding: 12,
    backgroundColor: '#fff9c4',
    borderTopWidth: 1,
    borderTopColor: '#fbc02d',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loadingIndicatorAmp: {
    backgroundColor: '#d1fae5',
    borderTopColor: '#10b981',
  },
  loadingText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ef5350',
    borderRadius: 4,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
  },
  sendButtonAmp: {
    backgroundColor: '#10b981',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
