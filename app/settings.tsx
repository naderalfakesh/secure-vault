import React from "react";
import { View, Text, StyleSheet, Button, Alert } from "react-native";
import { useCryptoVault } from "../src/hooks/useCryptoVault";
import { SafeAreaView } from 'react-native-safe-area-context';

const SettingsScreen = () => {
  const vault = useCryptoVault();

  const handleExport = async () => {
    try {
      const exportedData = await vault.exportEncrypted();
      Alert.alert("Vault Exported", exportedData);
      console.log(exportedData);
    } catch (e: any) {
      Alert.alert("Export failed", e.message);
    }
  };

  const handleImport = () => {
    Alert.prompt(
      "Import Vault",
      "Paste the exported data here.",
      async (text) => {
        if (text) {
          try {
            await vault.importEncrypted(text);
            Alert.alert("Import successful", "Your vault has been restored.");
          } catch (e: any) {
            Alert.alert("Import failed", e.message);
          }
        }
      }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.buttonContainer}>
        <Button title="Export Vault" onPress={handleExport} />
      </View>
      <View style={styles.buttonContainer}>
        <Button title="Import Vault" onPress={handleImport} />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  buttonContainer: {
    marginVertical: 10,
  },
});

export default SettingsScreen;
