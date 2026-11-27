import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { importKind, importMimeType, suggestedTitleFor } from '@/features/scan/pages';
import type { SourceProblem } from '@/features/scan/SourceList';
import { documentService } from '@/services/DocumentService';
import { isEncryptedPdf } from '@/services/pdfPassword';
import type { PickedFile } from '@/types';
import { isCameraAvailable, scanDocuments } from '@modules/expo-document-scanner';

import { IMPORT_TYPES, JPEG_TYPE, PHOTO_QUALITY, SCANNED_TITLE } from './constants';
import { photoName, scanPageName } from './helpers';
import type { SinglePick } from './types';

// Every picker copy is plaintext; unaccepted or unusable copies must be deleted before returning.

type IsMounted = () => boolean;
type CameraAllowed = () => Promise<boolean>;

export async function scanPages(
  cameraAllowed: CameraAllowed,
  isMounted: IsMounted,
): Promise<PickedFile[] | null> {
  if (!isCameraAvailable()) return null;
  // VisionKit requires app camera permission on iOS; ML Kit runs inside Play Services and needs none.
  if (Platform.OS === 'ios' && !(await cameraAllowed())) return null;
  const pages = await scanDocuments();
  if (pages.length === 0) return null;
  if (!isMounted()) {
    for (const page of pages) documentService.discardPickedCopy(page.uri);
    return null;
  }
  return pages.map((page, index) => ({
    uri: page.uri,
    name: scanPageName(index),
    type: JPEG_TYPE,
  }));
}

type ImportOutcome = { picked: SinglePick } | { problem: SourceProblem } | null;

export async function importFile(isMounted: IsMounted): Promise<ImportOutcome> {
  const result = await DocumentPicker.getDocumentAsync({
    type: IMPORT_TYPES,
    copyToCacheDirectory: true,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  documentService.discardSystemImportCopy(asset.name);
  const kind = importKind(asset.name, asset.mimeType);
  if (!kind) {
    documentService.discardPickedCopy(asset.uri);
    return { problem: { kind: 'unsupported', name: asset.name } };
  }
  const type = importMimeType(asset.name, asset.mimeType, kind);
  const previewUri = await documentService.previewForFile(asset.uri, type);
  if (!isMounted()) {
    if (previewUri) documentService.discardPreview(previewUri);
    documentService.discardPickedCopy(asset.uri);
    return null;
  }
  if (!previewUri) {
    const locked = kind === 'pdf' && (await isEncryptedPdf(asset.uri));
    documentService.discardPickedCopy(asset.uri);
    return { problem: { kind: locked ? 'protected' : 'unsupported', name: asset.name } };
  }
  return {
    picked: {
      file: { uri: asset.uri, name: asset.name, type, size: asset.size },
      previewUri,
      suggestedTitle: suggestedTitleFor(asset.name),
    },
  };
}

export async function pickPhoto(
  source: 'camera' | 'library',
  cameraAllowed: CameraAllowed,
  isMounted: IsMounted,
): Promise<SinglePick | null> {
  if (source === 'camera') {
    if (!isCameraAvailable()) return null;
    if (!(await cameraAllowed())) return null;
  }
  // System photo picker runs out-of-process and requires no photo library permission.
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: PHOTO_QUALITY })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: PHOTO_QUALITY,
        });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  if (!isMounted()) {
    documentService.discardPickedCopy(asset.uri);
    return null;
  }
  return {
    file: {
      uri: asset.uri,
      name: photoName(asset.fileName),
      type: asset.mimeType ?? JPEG_TYPE,
      size: asset.fileSize,
    },
    previewUri: asset.uri,
    suggestedTitle: source === 'camera' ? SCANNED_TITLE : suggestedTitleFor(asset.fileName),
  };
}
