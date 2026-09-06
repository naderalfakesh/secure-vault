import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useCryptoVault } from '../src/hooks/useCryptoVault';
import { useSecurityStatus } from '../src/hooks/useSecurityStatus';
import { SafeAreaView } from 'react-native-safe-area-context';

const VaultLockedScreen = () => {
  const vault = useCryptoVault();
  const security = useSecurityStatus();

  useEffect(() => {
    if (!security.loading && !security.isSecure) {
      const issues = [...security.indicators, ...security.integrityIssues].join('\n');
      Alert.alert(
        'Untrusted Environment Detected',
        issues || 'This device appears to be rooted/jailbroken or tampered. Vault access is blocked.'
      );
    }
  }, [security]);

  const ensureSecure = () => {
    if (security.loading) {
      Alert.alert('Please wait', 'Running device security checks...');
      return false;
    }

    if (!security.isSecure) {
      Alert.alert(
        'Access blocked',
        'This device failed security checks (root/jailbreak or tampering detected).'
      );
      return false;
    }

    return true;
  };

  const handleUnlock = async () => {
    if (!ensureSecure()) return;

    try {
      const success = await vault.unlockWithBiometrics();
      if (success) {
        router.replace('/documents');
      }
    } catch (e: any) {
      Alert.alert('Unlock failed', e.message);
    }
  };

  const handleCreateVault = async () => {
    if (!ensureSecure()) return;

    try {
      await vault.createVault();
      Alert.alert('Vault created', 'You can now unlock your vault with biometrics.');
    } catch (e: any) {
      Alert.alert('Vault creation failed', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {security.loading && (
        <View style={styles.banner}>
          <ActivityIndicator color="#4361ee" />
          <Text style={styles.bannerText}>Verifying device integrity…</Text>
        </View>
      )}
      {!security.loading && !security.isSecure && (
        <View style={[styles.banner, styles.bannerWarning]}>
          <Text style={[styles.bannerText, styles.bannerWarningText]}>
            Security checks failed. Vault access disabled.
          </Text>
        </View>
      )}
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>🔐</Text>
      </View>
      <Text style={styles.title}>SecureVault</Text>
      <Text style={styles.subtitle}>Your documents, encrypted & protected</Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleUnlock}>
          <Text style={styles.primaryButtonText}>Unlock Vault</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={handleCreateVault}>
          <Text style={styles.secondaryButtonText}>Create New Vault</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  iconContainer: {
    marginBottom: 20,
  },
  icon: {
    fontSize: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4361ee',
  },
  secondaryButtonText: {
    color: '#4361ee',
    fontSize: 18,
    fontWeight: '600',
  },
  banner: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#e7f1ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  bannerWarning: {
    backgroundColor: '#ffe5e5',
  },
  bannerText: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerWarningText: {
    color: '#c1121f',
  },
});

export default VaultLockedScreen;
