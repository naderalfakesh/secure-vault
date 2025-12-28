import { Stack } from 'expo-router';

export default function DocumentsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'Documents',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Document',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
