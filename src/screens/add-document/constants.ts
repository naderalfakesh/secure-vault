import { scanText } from '@/features/scan/scanCopy';

/** The title a scan or a camera photo starts with. */
export const SCANNED_TITLE = scanText('scan.defaultTitle');

/** JPEG quality for the camera and the photo picker. */
export const PHOTO_QUALITY = 0.85;

/** What the file importer offers. */
export const IMPORT_TYPES = ['application/pdf', 'image/*'];

/** Scanned pages, and photos that do not say what they are. */
export const JPEG_TYPE = 'image/jpeg';
