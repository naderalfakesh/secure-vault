import { Stack } from 'expo-router';
import { useUnistyles } from 'react-native-unistyles';

export default function DocumentsLayout() {
  const { theme } = useUnistyles();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: { color: theme.colors.textPrimary },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="[id]" options={{ title: '', headerBackTitle: 'Back' }} />
      <Stack.Screen
        name="add"
        options={{ title: 'Add document', presentation: 'modal', headerShown: false }}
      />
    </Stack>
  );
}
