import { Stack } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

export default function SetupLayout() {
  // Reduced motion: the setup steps cross-fade instead of sliding.
  const reduceMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: reduceMotion ? 'fade' : 'default',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="pin" />
      <Stack.Screen name="biometrics" />
    </Stack>
  );
}
