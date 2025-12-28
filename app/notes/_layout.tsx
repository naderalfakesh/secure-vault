import { Stack } from 'expo-router';

export default function NotesLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="index" 
        options={{ 
          title: 'Your Notes',
          headerShown: true
        }} 
      />
      <Stack.Screen 
        name="[id]" 
        options={{ 
          title: 'Note',
          headerShown: true
        }} 
      />
    </Stack>
  );
}
