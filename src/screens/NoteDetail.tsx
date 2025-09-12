import React, { useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Button, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useCryptoVault } from '../hooks/useCryptoVault';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { RouteProp } from '@react-navigation/native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { SafeAreaView } from 'react-native-safe-area-context';

type NoteDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'NoteDetail'
>;
type NoteDetailScreenRouteProp = RouteProp<RootStackParamList, 'NoteDetail'>;

const NoteDetailScreen = () => {
  const navigation = useNavigation<NoteDetailScreenNavigationProp>();
  const route = useRoute<NoteDetailScreenRouteProp>();
  const vault = useCryptoVault();
  const { noteId } = route.params;

  const [content, setContent] = useState('');

  useEffect(() => {
    const loadNote = async () => {
      if (noteId !== 'new') {
        try {
          const noteContent = await vault.get(noteId);
          setContent(noteContent);
        } catch (e: any) {
          Alert.alert('Error loading note', e.message);
        }
      }
    };
    loadNote();
  }, [noteId, vault]);

  const handleSave = async () => {
    const idToSave = noteId === 'new' ? uuidv4() : noteId;
    try {
      await vault.put(idToSave, content);
      navigation.goBack();
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