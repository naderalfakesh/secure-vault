import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>Document Detail</Text>
        <Text style={styles.id}>ID: {id}</Text>
        <Text style={styles.placeholder}>
          Document viewer will be implemented here
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  id: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 20,
  },
  placeholder: {
    fontSize: 16,
    color: '#adb5bd',
    textAlign: 'center',
  },
});
