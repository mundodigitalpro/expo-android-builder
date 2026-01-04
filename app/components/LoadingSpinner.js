import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

export default function LoadingSpinner({ message = 'Cargando...', details = '' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.message}>{message}</Text>
      {!!details && <Text style={styles.details}>{details}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  details: {
    marginTop: 8,
    fontSize: 12,
    color: '#888',
  },
});
