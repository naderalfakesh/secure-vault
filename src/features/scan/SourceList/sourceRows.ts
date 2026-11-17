import type { SourceRow } from './types';

/**
 * The camera rows depend on the hardware: the platform scanner and a
 * plain photo when there is a camera; both disabled with the reason when there
 * is none, because the native camera picker aborts on a camera-less device.
 * Without the scanner but with a camera, only the photo row is offered.
 */
export function sourceRows(
  scannerSupported: boolean,
  cameraAvailable: boolean,
  cameraDenied: boolean,
): SourceRow[] {
  const rows: SourceRow[] = [];
  if (!cameraDenied) {
    if (!cameraAvailable) {
      rows.push(
        {
          key: 'scan',
          icon: 'scan',
          title: 'sources.scan.title',
          subtitle: 'sources.noCamera',
          disabled: true,
        },
        {
          key: 'camera',
          icon: 'camera',
          title: 'sources.camera.title',
          subtitle: 'sources.noCamera',
          disabled: true,
        },
      );
    } else {
      if (scannerSupported) {
        rows.push({
          key: 'scan',
          icon: 'scan',
          title: 'sources.scan.title',
          subtitle: 'sources.scan.subtitle',
        });
      }
      rows.push({
        key: 'camera',
        icon: 'camera',
        title: 'sources.camera.title',
        subtitle: 'sources.camera.subtitle',
      });
    }
  }
  rows.push(
    {
      key: 'library',
      icon: 'photos',
      title: 'sources.library.title',
      subtitle: 'sources.library.subtitle',
    },
    {
      key: 'files',
      icon: 'files',
      title: 'sources.files.title',
      subtitle: 'sources.files.subtitle',
    },
  );
  return rows;
}
