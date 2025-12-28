import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Button, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCryptoVault } from '../../src/hooks/useCryptoVault';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { SafeAreaView } from 'react-native-safe-area-context';

const NoteDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vault = useCryptoVault();
  const [content, setContent] = useState('');

  useEffect(() => {
    const loadNote = async () => {
      if (id !== 'new') {
        try {
          const noteContent = await vault.get(id);
          setContent(noteContent);
        } catch (e: any) {
          Alert.alert('Error loading note', e.message);
        }
      }
    };
    loadNote();
  }, [id, vault]);

  const handleSave = async () => {
    const idToSave = id === 'new' ? uuidv4() : id;
    try {
      await vault.put(idToSave, content);
      router.back();
    } catch (e: any) {
      Alert.alert('Error saving note', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TextInput
        style={styles.input}
        value={content}
        onChangeText={setContent}
        multiline
        placeholder="Enter your note here..."
      />
      <Button title="Save Note" onPress={handleSave} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 10,
  },
});

export default NoteDetailScreen;
