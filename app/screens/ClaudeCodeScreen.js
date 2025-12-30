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
} from 'react-native';
import socketService from '../services/socket';
import { claudeApi } from '../services/api';

export default function ClaudeCodeScreen({ route }) {
  const { project } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [connecting, setConnecting] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    // Conectar WebSocket de forma asíncrona
    const initializeSocket = async () => {
      try {
        setConnecting(true);
        await socketService.connect();

        // Escuchar eventos de Claude
        socketService.on('claude:output', handleClaudeOutput);
        socketService.on('claude:error', handleClaudeError);
        socketService.on('claude:complete', handleClaudeComplete);

        setConnecting(false);
        console.log('Socket initialized successfully');
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
        setConnecting(false);
        Alert.alert(
          'Error de Conexión',
          'No se pudo conectar al servidor. Verifica que el servidor esté corriendo y que la URL sea correcta.'
        );
      }
    };

    initializeSocket();

    return () => {
      // Cleanup: remover listeners
      socketService.off('claude:output');
      socketService.off('claude:error');
      socketService.off('claude:complete');
    };
  }, []);

  const handleClaudeOutput = (data) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString() + Math.random(),
        type: 'claude',
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
        content: 'Claude ha terminado de procesar tu solicitud.',
        timestamp: new Date(),
      },
    ]);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    // Verificar que el socket esté conectado
    if (!socketService.isConnected()) {
      Alert.alert(
        'Error de Conexión',
        'No hay conexión con el servidor. Por favor, verifica que el servidor esté corriendo.'
      );
      return;
    }

    // Agregar mensaje del usuario
    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const promptText = input;
    setInput('');
    setLoading(true);

    try {
      const result = await claudeApi.execute(
        project.path,
        promptText,
        socketService.getSocketId()
      );
      setSessionId(result.data.sessionId);
    } catch (error) {
      console.error('Error executing Claude:', error);
      const errorMessage =
        error.response?.data?.error ||
        'No se pudo ejecutar Claude. Verifica que el servidor esté corriendo y Claude CLI esté instalado.';
      Alert.alert('Error', errorMessage);
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          type: 'error',
          content: errorMessage,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const cancelSession = async () => {
    if (!sessionId) return;

    try {
      await claudeApi.cancel(sessionId);
      setLoading(false);
      setSessionId(null);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString() + Math.random(),
          type: 'system',
          content: 'Sesión cancelada por el usuario.',
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Error cancelling session:', error);
      Alert.alert('Error', 'No se pudo cancelar la sesión');
    }
  };

  const renderMessage = ({ item }) => {
    let messageStyle = [styles.message];
    let textStyle = [styles.messageText];

    if (item.type === 'user') {
      messageStyle.push(styles.userMessage);
      textStyle.push(styles.userMessageText);
    } else if (item.type === 'claude') {
      messageStyle.push(styles.claudeMessage);
    } else if (item.type === 'error') {
      messageStyle.push(styles.errorMessage);
      textStyle.push(styles.errorMessageText);
    } else if (item.type === 'system') {
      messageStyle.push(styles.systemMessage);
      textStyle.push(styles.systemMessageText);
    }

    return (
      <View style={messageStyle}>
        <Text style={textStyle}>{item.content}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
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
          <Text style={styles.emptyIcon}>🤖</Text>
          <Text style={styles.emptyTitle}>Chat con Claude</Text>
          <Text style={styles.emptyText}>
            Escribe un mensaje para pedirle a Claude que modifique tu proyecto
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
        <View style={styles.loadingIndicator}>
          <Text style={styles.loadingText}>Claude está trabajando...</Text>
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
          placeholder={connecting ? "Conectando..." : "Escribe tu mensaje a Claude..."}
          placeholderTextColor="#999"
          multiline
          maxLength={2000}
          editable={!loading && !connecting}
        />
        <Pressable
          style={[
            styles.sendButton,
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
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  claudeMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    fontSize: 16,
    color: '#333',
  },
  userMessageText: {
    color: '#fff',
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
  loadingText: {
    fontSize: 14,
    color: '#f57f17',
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
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 8,
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
