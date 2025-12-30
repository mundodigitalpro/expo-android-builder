import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native';
import { storage } from '../utils/storage';
import { healthCheck } from '../services/api';

export default function SettingsScreen() {
  const [authToken, setAuthToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [serverStatus, setServerStatus] = useState('unknown');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const token = await storage.getAuthToken();
    const url = await storage.getServerUrl();
    setAuthToken(token || '');
    setServerUrl(url || 'http://localhost:3001');
  };

  const handleSaveSettings = async () => {
    await storage.setAuthToken(authToken);
    await storage.setServerUrl(serverUrl);
    Alert.alert('Éxito', 'Configuración guardada correctamente');
  };

  const checkServerStatus = async () => {
    try {
      setServerStatus('checking');
      await healthCheck();
      setServerStatus('online');
      Alert.alert('Servidor Online', 'El servidor está funcionando correctamente');
    } catch (error) {
      setServerStatus('offline');
      Alert.alert(
        'Servidor Offline',
        'No se pudo conectar al servidor. Asegúrate de que esté corriendo.'
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Configuración del Servidor</Text>

        <Text style={styles.label}>URL del Servidor</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://localhost:3001"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Token de Autenticación</Text>
        <TextInput
          style={styles.input}
          value={authToken}
          onChangeText={setAuthToken}
          placeholder="expo-builder-token-2024-secure"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={true}
        />

        <Pressable style={styles.button} onPress={handleSaveSettings}>
          <Text style={styles.buttonText}>Guardar Configuración</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado del Servidor</Text>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Estado:</Text>
          <View
            style={[
              styles.statusIndicator,
              serverStatus === 'online' ? styles.statusOnline : null,
              serverStatus === 'offline' ? styles.statusOffline : null,
              serverStatus === 'checking' ? styles.statusChecking : null,
            ]}
          >
            <Text style={styles.statusText}>
              {serverStatus === 'online' && '✓ Online'}
              {serverStatus === 'offline' && '✗ Offline'}
              {serverStatus === 'checking' && '... Verificando'}
              {serverStatus === 'unknown' && '? Desconocido'}
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.button, styles.secondaryButton]}
          onPress={checkServerStatus}
        >
          <Text style={styles.secondaryButtonText}>Verificar Conexión</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información</Text>
        <Text style={styles.infoText}>Expo App Builder v1.0.0</Text>
        <Text style={styles.infoText}>
          Crea apps Expo con integración de Claude Code
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 16,
    color: '#666',
    marginRight: 8,
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
  },
  statusOffline: {
    backgroundColor: '#FF3B30',
  },
  statusChecking: {
    backgroundColor: '#FFA500',
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});
