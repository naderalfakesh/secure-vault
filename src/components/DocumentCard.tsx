import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Document, DocumentCategoryIcons, DocumentCategoryLabels } from '../types';

interface DocumentCardProps {
  document: Document;
  onPress: (document: Document) => void;
  getThumbnail: (id: string) => Promise<string | null>;
}

export function DocumentCard({ document, onPress, getThumbnail }: DocumentCardProps) {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadThumbnail = async () => {
      try {
        const uri = await getThumbnail(document.id);
        if (mounted) {
          setThumbnailUri(uri);
        }
      } catch (e) {
        console.warn('Failed to load thumbnail:', e);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadThumbnail();

    return () => {
      mounted = false;
    };
  }, [document.id, getThumbnail]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const accessibilityLabel = `${document.title}, ${DocumentCategoryLabels[document.category]} document, created ${formatDate(document.createdAt)}, ${formatFileSize(document.fileSize)}`;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(document)}
      activeOpacity={0.7}
      accessible={true}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityHint="Double tap to view document details"
    >
      <View style={styles.thumbnailContainer}>
        {loading ? (
          <View style={styles.thumbnailPlaceholder}>
            <ActivityIndicator size="small" color="#4361ee" />
          </View>
        ) : thumbnailUri ? (
          <Image
            source={{ uri: `file://${thumbnailUri}` }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Text style={styles.placeholderIcon}>
              {document.fileType === 'pdf' ? '📄' : '🖼️'}
            </Text>
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryIcon}>
            {DocumentCategoryIcons[document.category]}
          </Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {document.title}
        </Text>
        <Text style={styles.categoryLabel}>
          {DocumentCategoryLabels[document.category]}
        </Text>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{formatDate(document.createdAt)}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaText}>{formatFileSize(document.fileSize)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    margin: 4,
  },
  thumbnailContainer: {
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e9ecef',
  },
  placeholderIcon: {
    fontSize: 32,
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  categoryIcon: {
    fontSize: 14,
  },
  info: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 12,
    color: '#4361ee',
    marginBottom: 4,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 11,
    color: '#6c757d',
  },
  metaDot: {
    fontSize: 11,
    color: '#6c757d',
    marginHorizontal: 4,
  },
});

export default DocumentCard;
