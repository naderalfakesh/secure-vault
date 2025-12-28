import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Button, FlatList, Alert, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCryptoVault } from '../../src/hooks/useCryptoVault';
import { SafeAreaView } from 'react-native-safe-area-context';

const NoteListScreen = () => {
  const vault = useCryptoVault();
  const [notes, setNotes] = useState<string[]>([]);

  const loadNotes = useCallback(async () => {
    try {
      const keys = await vault.getAllKeys();
      setNotes(keys);
    } catch (e: any) {
      Alert.alert('Error loading notes', e.message);
    }
  }, [vault]);

  useFocusEffect(
    useCallback(() => {
      loadNotes();
    }, [loadNotes])
  );

  const handleDelete = async (key: string) => {
    try {
      await vault.delete(key);
      loadNotes();
    } catch (e: any) {
      Alert.alert('Error deleting note', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Notes</Text>
        <Button
          title="Settings"
          onPress={() => router.push('/settings')}
        />
      </View>
      <FlatList
        data={notes}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/notes/${item}`)}>
            <View style={styles.noteItem}>
              <Text>{item}</Text>
              <Button title="Delete" onPress={() => handleDelete(item)} color="red" />
            </View>
          </TouchableOpacity>
        )}
      />
      <Button
        title="Create New Note"
        onPress={() => router.push('/notes/new')}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  noteItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
});

export default NoteListScreen;
