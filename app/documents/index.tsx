import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DocumentsListScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📁</Text>
        <Text style={styles.emptyTitle}>No Documents Yet</Text>
        <Text style={styles.emptySubtitle}>
          Add your first document by tapping the button below
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            // TODO: Navigate to add document screen
          }}
        >
          <Text style={styles.addButtonText}>+ Add Document</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.settingsButtonText}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  footer: {
    padding: 20,
    gap: 12,
  },
  addButton: {
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  settingsButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  settingsButtonText: {
    color: '#6c757d',
    fontSize: 16,
  },
});
