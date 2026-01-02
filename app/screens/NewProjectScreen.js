import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { projectsApi } from '../services/api';
import { validateProjectName } from '../utils/validators';
import socketService from '../services/socket';

export default function NewProjectScreen({ navigation }) {
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Job status tracking
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [outputLines, setOutputLines] = useState([]);

  const pollingInterval = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
      // Disconnect socket listeners
      socketService.off('project-job:started');
      socketService.off('project-job:output');
      socketService.off('project-job:complete');
      socketService.off('project-job:error');
    };
  }, []);

  // Setup Socket.io listeners when job starts
  useEffect(() => {
    if (!jobId) return;

    const setupSocketListeners = async () => {
      try {
        await socketService.connect();

        socketService.on('project-job:started', (data) => {
          if (data.jobId === jobId) {
            console.log('Job started:', data);
          }
        });

        socketService.on('project-job:output', (data) => {
          if (data.jobId === jobId) {
            setOutputLines(prev => [...prev, data.message]);
          }
        });

        socketService.on('project-job:complete', (data) => {
          if (data.jobId === jobId) {
            console.log('Job completed:', data);
            setProgress(100);
            setPhase('completed');
            stopPolling();

            // Show success and navigate back
            setTimeout(() => {
              Alert.alert('Éxito', `Proyecto "${projectName}" creado correctamente`, [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            }, 500);
          }
        });

        socketService.on('project-job:error', (data) => {
          if (data.jobId === jobId) {
            console.error('Job failed:', data);
            setPhase('failed');
            stopPolling();
            Alert.alert('Error', data.error || 'No se pudo crear el proyecto');
            setLoading(false);
          }
        });

      } catch (error) {
        console.warn('Socket connection failed (will use polling):', error);
      }
    };

    setupSocketListeners();
  }, [jobId]);

  const startPolling = (jobId) => {
    // Poll every 2 seconds
    pollingInterval.current = setInterval(async () => {
      try {
        const response = await projectsApi.getJobStatus(jobId);
        const data = response.data;

        setJobStatus(data.status);
        setProgress(data.progress || 0);
        setPhase(data.phase || '');

        // Update output if available
        if (data.recentOutput && data.recentOutput.length > 0) {
          setOutputLines(prev => {
            const newLines = [...prev, ...data.recentOutput];
            return newLines.slice(-20); // Keep last 20 lines
          });
        }

        // Stop polling if completed or failed
        if (data.status === 'completed') {
          stopPolling();
          Alert.alert('Éxito', `Proyecto "${projectName}" creado correctamente`, [
            { text: 'OK', onPress: () => navigation.goBack() },
          ]);
        } else if (data.status === 'failed') {
          stopPolling();
          Alert.alert('Error', data.error || 'No se pudo crear el proyecto');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  };

  const handleCreateProject = async () => {
    const validationError = validateProjectName(projectName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setProgress(0);
    setPhase('initializing');
    setOutputLines([]);

    try {
      // Call async endpoint
      const response = await projectsApi.create(projectName, 'blank', true); // async=true
      const data = response.data;

      console.log('Project creation job started:', data);
      setJobId(data.jobId);
      setJobStatus(data.status);

      // Start polling for status
      startPolling(data.jobId);

    } catch (error) {
      const errorMessage =
        error.response?.data?.error || 'No se pudo iniciar la creación del proyecto';
      Alert.alert('Error', errorMessage);
      console.error('Error creating project:', error);
      setLoading(false);
    }
  };

  const getPhaseMessage = () => {
    switch (phase) {
      case 'initializing':
        return 'Inicializando...';
      case 'creating':
        return 'Creando proyecto Expo...';
      case 'git-init':
        return 'Inicializando repositorio Git...';
      case 'config':
        return 'Configurando app.json...';
      case 'eas-config':
        return 'Creando configuración EAS...';
      case 'metadata':
        return 'Guardando metadatos...';
      case 'completed':
        return '¡Proyecto creado exitosamente!';
      case 'failed':
        return 'Error al crear proyecto';
      default:
        return 'Procesando...';
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Crear Nuevo Proyecto</Text>
      <Text style={styles.subtitle}>
        Crea un nuevo proyecto Expo con template blank
      </Text>

      <View style={styles.form}>
        <Text style={styles.label}>Nombre del Proyecto</Text>
        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={projectName}
          onChangeText={(text) => {
            setProjectName(text);
            setError('');
          }}
          placeholder="mi-app-increible"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.hint}>
          Solo letras, números, guiones y guiones bajos (3-50 caracteres)
        </Text>

        <View style={styles.templateInfo}>
          <Text style={styles.templateTitle}>Template: Blank</Text>
          <Text style={styles.templateDesc}>
            Proyecto básico con componentes esenciales de React Native y Expo
          </Text>
        </View>

        {/* Progress Bar and Status */}
        {loading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>{getPhaseMessage()}</Text>
              <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
            </View>

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>

            <Text style={styles.progressSubtext}>
              Este proceso puede tardar 1-2 minutos...
            </Text>

            {/* Output console (last few lines) */}
            {outputLines.length > 0 && (
              <View style={styles.outputContainer}>
                <Text style={styles.outputTitle}>Actividad reciente:</Text>
                <ScrollView
                  style={styles.outputScroll}
                  nestedScrollEnabled={true}
                >
                  {outputLines.slice(-5).map((line, index) => (
                    <Text key={index} style={styles.outputLine} numberOfLines={2}>
                      {line}
                    </Text>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreateProject}
          disabled={loading}
        >
          {loading && progress < 100 ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator color="#fff" size="small" style={styles.buttonSpinner} />
              <Text style={styles.buttonText}>Creando... {Math.round(progress)}%</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Crear Proyecto</Text>
          )}
        </Pressable>

        <Pressable
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
        >
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  hint: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    marginBottom: 20,
  },
  templateInfo: {
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  templateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  templateDesc: {
    fontSize: 14,
    color: '#666',
  },
  progressContainer: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  progressPercent: {
    fontSize: 15,
    fontWeight: '700',
    color: '#007AFF',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  outputContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  outputTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
  },
  outputScroll: {
    maxHeight: 100,
  },
  outputLine: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#555',
    marginBottom: 2,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonSpinner: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#666',
    fontSize: 16,
  },
});
