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

// Environment presets
const ENVIRONMENTS = {
  LOCAL: {
    name: 'Local (Termux)',
    url: 'http://localhost:3001',
    description: 'Backend en el mismo dispositivo',
    icon: '📱',
  },
  PRODUCTION: {
    name: 'Producción (VPS)',
    url: 'https://builder.josejordan.dev',
    description: 'Backend en servidor remoto',
    icon: '☁️',
  },
  CUSTOM: {
    name: 'Personalizado',
    url: '',
    description: 'URL manual',
    icon: '⚙️',
  },
};

export default function SettingsScreen() {
  const [authToken, setAuthToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState('LOCAL');
  const [customUrl, setCustomUrl] = useState('');
  const [serverStatus, setServerStatus] = useState('unknown');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const token = await storage.getAuthToken();
    const url = await storage.getServerUrl();
    setAuthToken(token || '');
    setServerUrl(url || 'http://localhost:3001');

    // Detect which environment is active
    if (url === ENVIRONMENTS.LOCAL.url) {
      setSelectedEnvironment('LOCAL');
    } else if (url === ENVIRONMENTS.PRODUCTION.url) {
      setSelectedEnvironment('PRODUCTION');
    } else {
      setSelectedEnvironment('CUSTOM');
      setCustomUrl(url || '');
    }
  };

  const handleEnvironmentChange = (env) => {
    setSelectedEnvironment(env);
    if (env !== 'CUSTOM') {
      setServerUrl(ENVIRONMENTS[env].url);
    } else {
      setServerUrl(customUrl);
    }
  };

  const handleSaveSettings = async () => {
    // Validate URL based on environment
    let finalUrl = serverUrl;
    if (selectedEnvironment === 'CUSTOM') {
      if (!customUrl.trim()) {
        Alert.alert('Error', 'Por favor ingresa una URL personalizada');
        return;
      }
      finalUrl = customUrl;
    } else {
      finalUrl = ENVIRONMENTS[selectedEnvironment].url;
    }

    await storage.setAuthToken(authToken);
    await storage.setServerUrl(finalUrl);
    setServerUrl(finalUrl);

    Alert.alert(
      'Éxito',
      `Configuración guardada:\n${ENVIRONMENTS[selectedEnvironment].name}\n${finalUrl}`
    );
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
        <Text style={styles.sectionTitle}>Entorno de Servidor</Text>
        <Text style={styles.subtitle}>
          Selecciona dónde se encuentra el backend
        </Text>

        {/* Environment Selector */}
        {Object.entries(ENVIRONMENTS).map(([key, env]) => (
          <Pressable
            key={key}
            style={[
              styles.environmentCard,
              selectedEnvironment === key && styles.environmentCardActive,
            ]}
            onPress={() => handleEnvironmentChange(key)}
          >
            <View style={styles.environmentHeader}>
              <Text style={styles.environmentIcon}>{env.icon}</Text>
              <View style={styles.environmentInfo}>
                <Text
                  style={[
                    styles.environmentName,
                    selectedEnvironment === key && styles.environmentNameActive,
                  ]}
                >
                  {env.name}
                </Text>
                <Text style={styles.environmentDescription}>
                  {env.description}
                </Text>
                {key !== 'CUSTOM' && (
                  <Text style={styles.environmentUrl}>{env.url}</Text>
                )}
              </View>
              <View
                style={[
                  styles.radio,
                  selectedEnvironment === key && styles.radioActive,
                ]}
              >
                {selectedEnvironment === key && (
                  <View style={styles.radioDot} />
                )}
              </View>
            </View>
          </Pressable>
        ))}

        {/* Custom URL Input (only shown when CUSTOM is selected) */}
        {selectedEnvironment === 'CUSTOM' && (
          <>
            <Text style={styles.label}>URL Personalizada</Text>
            <TextInput
              style={styles.input}
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="https://tu-servidor.com"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        )}

        {/* Current URL Display */}
        <View style={styles.currentUrlContainer}>
          <Text style={styles.currentUrlLabel}>URL Actual:</Text>
          <Text style={styles.currentUrl}>{serverUrl}</Text>
        </View>

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
        <Text style={styles.infoText}>Expo Android Builder v2.0.0</Text>
        <Text style={styles.infoText}>Fases 1-3 completadas (60%)</Text>
        <Text style={styles.infoText}>
          ✅ CRUD Proyectos | ✅ Claude Code | ✅ EAS Build
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  environmentCard: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  environmentCardActive: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  environmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  environmentIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  environmentInfo: {
    flex: 1,
  },
  environmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  environmentNameActive: {
    color: '#007AFF',
  },
  environmentDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  environmentUrl: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: '#007AFF',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
  },
  currentUrlContainer: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  currentUrlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  currentUrl: {
    fontSize: 14,
    color: '#007AFF',
    fontFamily: 'monospace',
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
