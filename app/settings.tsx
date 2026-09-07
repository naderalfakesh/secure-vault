import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Share,
  Clipboard,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVault } from '../src/hooks/useVault';
import { documentService } from '../src/services/DocumentService';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const vault = useVault();
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const exportedData = await vault.exportEncrypted();

      Alert.alert('Export Successful', 'Your vault has been exported. Choose how to save it.', [
        {
          text: 'Copy to Clipboard',
          onPress: () => {
            Clipboard.setString(exportedData);
            Alert.alert('Copied', 'Vault data copied to clipboard.');
          },
        },
        {
          text: 'Share',
          onPress: async () => {
            try {
              await Share.share({
                title: 'SecureVault Backup',
                message: exportedData,
              });
            } catch {
              // User cancelled
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } catch (e: any) {
      Alert.alert('Export Failed', e.message || 'Could not export vault data.');
    } finally {
      setExporting(false);
    }
  }, [vault]);

  const handleImport = useCallback(() => {
    Alert.prompt(
      'Import Vault',
      'Paste your exported vault data below. This will replace all existing data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async (text?: string) => {
            if (!text?.trim()) {
              Alert.alert('Error', 'Please paste valid vault data.');
              return;
            }

            try {
              await vault.importEncrypted(text);
              Alert.alert('Import Successful', 'Your vault has been restored.');
            } catch (e: any) {
              Alert.alert('Import Failed', e.message || 'Could not import vault data.');
            }
          },
        },
      ],
      'plain-text',
    );
  }, [vault]);

  const handleClearData = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your documents and vault data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearing(true);
              // Get all keys and delete them
              const keys = await vault.getAllKeys();
              for (const key of keys) {
                try {
                  await vault.delete(key);
                } catch {
                  // Continue even if individual delete fails
                }
              }
              // Clear document cache
              await documentService.clearCache();

              Alert.alert('Data Cleared', 'All vault data has been deleted.', [
                {
                  text: 'OK',
                  onPress: () => router.replace('/'),
                },
              ]);
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to clear data.');
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  }, [vault]);

  const handleLockVault = useCallback(() => {
    router.replace('/');
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* Backup & Restore Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backup & Restore</Text>

          <TouchableOpacity style={styles.settingItem} onPress={handleExport} disabled={exporting}>
            <View style={styles.settingIcon}>
              <Text style={styles.settingEmoji}>📤</Text>
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Export Vault</Text>
              <Text style={styles.settingDescription}>
                Create an encrypted backup of your documents
              </Text>
            </View>
            {exporting && <ActivityIndicator size="small" color="#4361ee" />}
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={handleImport}>
            <View style={styles.settingIcon}>
              <Text style={styles.settingEmoji}>📥</Text>
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Import Vault</Text>
              <Text style={styles.settingDescription}>Restore from an encrypted backup</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>

          <TouchableOpacity style={styles.settingItem} onPress={handleLockVault}>
            <View style={styles.settingIcon}>
              <Text style={styles.settingEmoji}>🔐</Text>
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>Lock Vault</Text>
              <Text style={styles.settingDescription}>Lock the app and require authentication</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>

          <TouchableOpacity
            style={[styles.settingItem, styles.dangerItem]}
            onPress={handleClearData}
            disabled={clearing}
          >
            <View style={[styles.settingIcon, styles.dangerIcon]}>
              <Text style={styles.settingEmoji}>🗑️</Text>
            </View>
            <View style={styles.settingContent}>
              <Text style={[styles.settingTitle, styles.dangerText]}>Clear All Data</Text>
              <Text style={styles.settingDescription}>
                Permanently delete all documents and vault data
              </Text>
            </View>
            {clearing && <ActivityIndicator size="small" color="#dc3545" />}
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.aboutCard}>
            <Text style={styles.appName}>SecureVault</Text>
            <Text style={styles.appVersion}>Version {APP_VERSION}</Text>
            <Text style={styles.appDescription}>
              A secure document scanner and vault with native encryption. Your documents are
              encrypted using your device&apos;s secure hardware and protected with biometric
              authentication.
            </Text>
          </View>

          <View style={styles.featuresCard}>
            <Text style={styles.featuresTitle}>Features</Text>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🔐</Text>
              <Text style={styles.featureText}>AES-256 encryption</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>👆</Text>
              <Text style={styles.featureText}>Biometric authentication</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📱</Text>
              <Text style={styles.featureText}>Hardware-backed security</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>📄</Text>
              <Text style={styles.featureText}>Document scanning</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dangerTitle: {
    color: '#dc3545',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  dangerItem: {
    backgroundColor: '#fff5f5',
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e7f1ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dangerIcon: {
    backgroundColor: '#ffe5e5',
  },
  settingEmoji: {
    fontSize: 20,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  dangerText: {
    color: '#dc3545',
  },
  settingDescription: {
    fontSize: 13,
    color: '#6c757d',
  },
  aboutCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 16,
  },
  appDescription: {
    fontSize: 14,
    color: '#495057',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#495057',
  },
});
