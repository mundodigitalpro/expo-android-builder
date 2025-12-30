import React, { useState } from 'react';
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

export default function NewProjectScreen({ navigation }) {
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateProject = async () => {
    const validationError = validateProjectName(projectName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await projectsApi.create(projectName, 'blank');
      Alert.alert('Éxito', `Proyecto "${projectName}" creado correctamente`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const errorMessage =
        error.response?.data?.error || 'No se pudo crear el proyecto';
      Alert.alert('Error', errorMessage);
      console.error('Error creating project:', error);
    } finally {
      setLoading(false);
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

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleCreateProject}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
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
