import { Stack } from 'expo-router';

export default function DocumentsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: 'Document Details',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="add"
        options={{
          title: 'Add Document',
          presentation: 'modal',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
