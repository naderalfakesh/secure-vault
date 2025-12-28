import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { documentService } from '../../src/services/DocumentService';
import {
  Document,
  DocumentCategory,
  DocumentCategoryLabels,
  DocumentCategoryIcons,
} from '../../src/types';

const { width, height } = Dimensions.get('window');

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [showOcrText, setShowOcrText] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);

      await documentService.initialize();
      const doc = await documentService.getDocument(id);

      if (!doc) {
        setError('Document not found');
        return;
      }

      setDocument(doc);

      // Load the decrypted file
      const uri = await documentService.getDocumentFile(id);
      setFileUri(uri);
    } catch (e: any) {
      setError(e.message || 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await documentService.deleteDocument(id!);
              router.back();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete document');
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [id]);

  const handleShare = useCallback(async () => {
    if (!document || !fileUri) return;

    try {
      await Share.share({
        title: document.title,
        message: `Document: ${document.title}`,
        url: `file://${fileUri}`,
      });
    } catch (e: any) {
      if (e.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to share document');
      }
    }
  }, [document, fileUri]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4361ee" />
          <Text style={styles.loadingText}>Loading document...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !document) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error || 'Document not found'}</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Image Preview */}
        <TouchableOpacity
          style={styles.imageContainer}
          onPress={() => setShowFullScreen(true)}
          activeOpacity={0.9}
        >
          {fileUri ? (
            <Image
              source={{ uri: `file://${fileUri}` }}
              style={styles.image}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.placeholderIcon}>
                {document.fileType === 'pdf' ? '📄' : '🖼️'}
              </Text>
              <Text style={styles.placeholderText}>Tap to view</Text>
            </View>
          )}
          <View style={styles.expandHint}>
            <Text style={styles.expandHintText}>Tap to expand</Text>
          </View>
        </TouchableOpacity>

        {/* Document Info */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{document.title}</Text>

          <View style={styles.categoryRow}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryIcon}>
                {DocumentCategoryIcons[document.category]}
              </Text>
              <Text style={styles.categoryText}>
                {DocumentCategoryLabels[document.category]}
              </Text>
            </View>
            <Text style={styles.fileSize}>{formatFileSize(document.fileSize)}</Text>
          </View>

          {/* Tags */}
          {document.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {document.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Dates */}
          <View style={styles.dateSection}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Created</Text>
              <Text style={styles.dateValue}>{formatDate(document.createdAt)}</Text>
            </View>
            {document.updatedAt !== document.createdAt && (
              <View style={styles.dateRow}>
                <Text style={styles.dateLabel}>Updated</Text>
                <Text style={styles.dateValue}>{formatDate(document.updatedAt)}</Text>
              </View>
            )}
          </View>

          {/* OCR Text */}
          {document.ocrText && (
            <TouchableOpacity
              style={styles.ocrSection}
              onPress={() => setShowOcrText(!showOcrText)}
            >
              <View style={styles.ocrHeader}>
                <Text style={styles.ocrTitle}>Extracted Text</Text>
                <Text style={styles.ocrToggle}>{showOcrText ? '▼' : '▶'}</Text>
              </View>
              {showOcrText && (
                <Text style={styles.ocrText}>{document.ocrText}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleShare}
        >
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#dc3545" />
          ) : (
            <>
              <Text style={styles.actionIcon}>🗑️</Text>
              <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Full Screen Modal */}
      <Modal
        visible={showFullScreen}
        animationType="fade"
        onRequestClose={() => setShowFullScreen(false)}
      >
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowFullScreen(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          {fileUri && (
            <Image
              source={{ uri: `file://${fileUri}` }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#4361ee',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    width: width,
    height: width * 0.75,
    backgroundColor: '#1a1a2e',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#ffffff',
    fontSize: 14,
  },
  expandHint: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  expandHintText: {
    color: '#ffffff',
    fontSize: 12,
  },
  infoSection: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7f1ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 14,
    color: '#4361ee',
    fontWeight: '500',
  },
  fileSize: {
    fontSize: 14,
    color: '#6c757d',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  tagText: {
    fontSize: 12,
    color: '#495057',
  },
  dateSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6c757d',
  },
  dateValue: {
    fontSize: 14,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  ocrSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  ocrHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ocrTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  ocrToggle: {
    fontSize: 12,
    color: '#6c757d',
  },
  ocrText: {
    marginTop: 12,
    fontSize: 14,
    color: '#495057',
    lineHeight: 22,
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#fff5f5',
  },
  actionIcon: {
    fontSize: 18,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
  },
  deleteText: {
    color: '#dc3545',
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  fullScreenImage: {
    width: width,
    height: height,
  },
});
