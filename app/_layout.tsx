import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'CryptoVault',
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="notes" 
          options={{ 
            headerShown: false 
          }} 
        />
        <Stack.Screen 
          name="settings" 
          options={{ 
            title: 'Settings',
            presentation: 'modal'
          }} 
        />
      </Stack>
    </SafeAreaProvider>
  );
}
