import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';

export default function ProjectCard({ project, onChatPress, onBuildPress, onDelete }) {
  const handleDelete = () => {
    Alert.alert(
      'Eliminar Proyecto',
      `¿Estás seguro de eliminar "${project.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete(project.name),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name}>{project.name}</Text>
          <Text style={styles.template}>{project.template || 'blank'}</Text>
        </View>
        <Text style={styles.date}>
          Creado: {new Date(project.createdAt).toLocaleDateString('es-ES')}
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        <Pressable
          style={[styles.actionButton, styles.chatButton]}
          onPress={() => onChatPress(project)}
        >
          <Text style={styles.actionButtonText}>💬 Chat Claude</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.buildButton]}
          onPress={() => onBuildPress(project)}
        >
          <Text style={styles.actionButtonText}>🔨 Builds</Text>
        </Pressable>
      </View>

      <Pressable style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteText}>Eliminar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  content: {
    padding: 16,
    paddingBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  template: {
    fontSize: 12,
    color: '#007AFF',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  chatButton: {
    backgroundColor: '#007AFF',
  },
  buildButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    alignItems: 'center',
  },
  deleteText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
