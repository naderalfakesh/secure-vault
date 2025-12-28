import React from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { router } from 'expo-router';
import { useCryptoVault } from '../src/hooks/useCryptoVault';
import { SafeAreaView } from 'react-native-safe-area-context';

const VaultLockedScreen = () => {
  const vault = useCryptoVault();

  const handleUnlock = async () => {
    try {
      const success = await vault.unlockWithBiometrics();
      if (success) {
        router.replace('/notes');
      }
    } catch (e: any) {
      Alert.alert('Unlock failed', e.message);
    }
  };

  const handleCreateVault = async () => {
    try {
      await vault.createVault();
      Alert.alert('Vault created', 'You can now unlock your vault with biometrics.');
    } catch (e: any) {
      Alert.alert('Vault creation failed', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>CryptoVault</Text>
      <Button title="Unlock Vault" onPress={handleUnlock} />
      <View style={styles.separator} />
      <Button title="Create a New Vault" onPress={handleCreateVault} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  separator: {
    marginVertical: 10,
  }
});

export default VaultLockedScreen;
