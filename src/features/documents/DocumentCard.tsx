import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Icon, Skeleton, Text } from '@/components/ui';
import type { Document } from '@/types';
import { formatDate, formatFileSize } from '@/utils/format';

import { categoryIcons, categoryLabel } from './categories';

export type DocumentCardProps = {
  document: Document;
  onPress: (document: Document) => void;
  getThumbnail: (id: string) => Promise<string | null>;
  /** Compact variant for horizontal rows. */
  compact?: boolean;
};

export function DocumentCard({
  document,
  onPress,
  getThumbnail,
  compact = false,
}: DocumentCardProps) {
  const [thumbnail, setThumbnail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getThumbnail(document.id)
      .then((uri) => {
        if (active) setThumbnail(uri);
      })
      .catch(() => {
        if (active) setThumbnail(null);
      });
    return () => {
      active = false;
    };
  }, [document.id, getThumbnail]);

  const label = `${document.title}, ${categoryLabel(document.category)}, ${formatDate(document.createdAt)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the document"
      onPress={() => onPress(document)}
      style={({ pressed }) => [styles.card(compact), pressed && styles.pressed]}
    >
      <View style={styles.thumbnail(compact)}>
        {thumbnail === undefined ? (
          <Skeleton width="100%" height={compact ? 96 : 150} borderRadius={0} />
        ) : thumbnail ? (
          <Image
            source={{ uri: `file://${thumbnail}` }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={150}
            accessible={false}
          />
        ) : (
          <View style={styles.placeholder}>
            <Icon
              name={document.fileType === 'pdf' ? 'pdf' : 'document'}
              size={28}
              tone="tertiary"
            />
          </View>
        )}
        <View style={styles.badge}>
          <Icon name={categoryIcons[document.category]} size={14} tone="secondary" />
        </View>
      </View>
      <View style={styles.body}>
        <Text variant="subheadline" numberOfLines={1} style={styles.title}>
          {document.title}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {formatDate(document.createdAt)}
          {compact ? '' : ` · ${formatFileSize(document.fileSize)}`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: (compact: boolean) => ({
    width: compact ? 140 : undefined,
    flex: compact ? undefined : 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  }),
  pressed: { opacity: 0.85 },
  thumbnail: (compact: boolean) => ({
    height: compact ? 96 : 150,
    backgroundColor: theme.colors.surfaceMuted,
  }),
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    width: 26,
    height: 26,
    borderRadius: theme.radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    ...theme.shadows.sm,
  },
  body: {
    padding: theme.spacing.sm,
    gap: 2,
  },
  title: {
    fontWeight: '600',
  },
}));
