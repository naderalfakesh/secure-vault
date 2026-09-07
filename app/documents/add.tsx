import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { documentService } from '../../src/services/DocumentService';
import { ocrService } from '../../src/services/OcrService';
import type { PickedFile } from '../../src/types';
import { DocumentCategory, DocumentCategoryLabels, DocumentCategoryIcons } from '../../src/types';

type SaveStep = 'idle' | 'ocr' | 'encrypting' | 'saving';

export default function AddDocumentScreen() {
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const [selectedFile, setSelectedFile] = useState<PickedFile | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>(DocumentCategory.OTHER);
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState<SaveStep>('idle');

  const handlePickImage = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file: PickedFile = {
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        };
        setSelectedFile(file);
        setPreviewUri(asset.uri);
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
        setStep('preview');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to pick image');
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow access to your camera.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file: PickedFile = {
          uri: asset.uri,
          name: `scan_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        };
        setSelectedFile(file);
        setPreviewUri(asset.uri);
        setTitle('Scanned Document');
        setStep('preview');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to take photo');
    }
  }, []);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const file: PickedFile = {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/pdf',
          size: asset.size,
        };
        setSelectedFile(file);
        setPreviewUri(asset.mimeType?.startsWith('image') ? asset.uri : null);
        setTitle(asset.name.replace(/\.[^/.]+$/, ''));
        setStep('preview');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to pick document');
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedFile) return;

    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for the document.');
      return;
    }

    try {
      setSaving(true);
      await documentService.initialize();

      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Run OCR on images
      let ocrText: string | undefined;
      const isImage = selectedFile.type?.startsWith('image');

      if (isImage && previewUri) {
        setSaveStep('ocr');
        try {
          const ocrResult = await ocrService.extractText(previewUri);
          if (ocrResult.text && ocrService.isTextMeaningful(ocrResult.text)) {
            ocrText = ocrService.cleanText(ocrResult.text);
          }
        } catch (e) {
          // OCR failed, continue without it
          console.warn('OCR failed:', e);
        }
      }

      setSaveStep('encrypting');

      await documentService.addDocument(selectedFile, {
        title: title.trim(),
        category,
        tags: tagList,
        ocrText,
      });

      setSaveStep('saving');
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save document');
      setSaving(false);
      setSaveStep('idle');
    }
  }, [selectedFile, title, category, tags, previewUri]);

  const getSaveButtonText = () => {
    switch (saveStep) {
      case 'ocr':
        return 'Extracting text...';
      case 'encrypting':
        return 'Encrypting...';
      case 'saving':
        return 'Saving...';
      default:
        return 'Save Document';
    }
  };

  const handleBack = useCallback(() => {
    if (step === 'preview') {
      setStep('select');
      setSelectedFile(null);
      setPreviewUri(null);
      setTitle('');
      setTags('');
    } else {
      router.back();
    }
  }, [step]);

  if (step === 'select') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.content}>
          <Text style={styles.heading}>Add a Document</Text>
          <Text style={styles.subheading}>Choose how you want to add your document</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity style={styles.option} onPress={handleTakePhoto}>
              <View style={styles.optionIcon}>
                <Text style={styles.optionEmoji}>📷</Text>
              </View>
              <Text style={styles.optionTitle}>Scan with Camera</Text>
              <Text style={styles.optionDescription}>Take a photo of a document</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handlePickImage}>
              <View style={styles.optionIcon}>
                <Text style={styles.optionEmoji}>🖼️</Text>
              </View>
              <Text style={styles.optionTitle}>Choose from Gallery</Text>
              <Text style={styles.optionDescription}>Select an existing photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={handlePickDocument}>
              <View style={styles.optionIcon}>
                <Text style={styles.optionEmoji}>📄</Text>
              </View>
              <Text style={styles.optionTitle}>Pick a File</Text>
              <Text style={styles.optionDescription}>Import a PDF or image file</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.cancelButton} onPress={handleBack}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview */}
          <View style={styles.previewContainer}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewPlaceholderIcon}>📄</Text>
                <Text style={styles.previewPlaceholderText}>
                  {selectedFile?.name || 'PDF Document'}
                </Text>
              </View>
            )}
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Document title"
                placeholderTextColor="#adb5bd"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
              >
                {Object.values(DocumentCategory).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={styles.categoryChipIcon}>{DocumentCategoryIcons[cat]}</Text>
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === cat && styles.categoryChipTextSelected,
                      ]}
                    >
                      {DocumentCategoryLabels[cat]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tags (optional)</Text>
              <TextInput
                style={styles.input}
                value={tags}
                onChangeText={setTags}
                placeholder="e.g., important, 2024, work"
                placeholderTextColor="#adb5bd"
              />
              <Text style={styles.hint}>Separate tags with commas</Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={saving}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <View style={styles.savingContainer}>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.saveButtonText}>{getSaveButtonText()}</Text>
              </View>
            ) : (
              <Text style={styles.saveButtonText}>Save Document</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 32,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 16,
  },
  option: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e7f1ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionEmoji: {
    fontSize: 28,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6c757d',
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6c757d',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  previewContainer: {
    height: 200,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    alignItems: 'center',
  },
  previewPlaceholderIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  previewPlaceholderText: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  hint: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
  },
  categoryScroll: {
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#4361ee',
    borderColor: '#4361ee',
  },
  categoryChipIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  categoryChipText: {
    fontSize: 14,
    color: '#495057',
    fontWeight: '500',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  saveButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#4361ee',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
