import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Button, FlatList, Alert, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useCryptoVault } from '../hooks/useCryptoVault';
import { SafeAreaView } from 'react-native-safe-area-context';

type NoteListScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'NoteList'
>;

const NoteListScreen = () => {
  const navigation = useNavigation<NoteListScreenNavigationProp>();
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
          onPress={() => navigation.navigate('Settings')}
        />
      </View>
      <FlatList
        data={notes}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => navigation.navigate('NoteDetail', { noteId: item })}>
            <View style={styles.noteItem}>
              <Text>{item}</Text>
              <Button title="Delete" onPress={() => handleDelete(item)} color="red" />
            </View>
          </TouchableOpacity>
        )}
      />
      <Button
        title="Create New Note"
        onPress={() => navigation.navigate('NoteDetail', { noteId: 'new' })}
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
