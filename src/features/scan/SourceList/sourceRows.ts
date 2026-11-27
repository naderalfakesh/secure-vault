import type { SourceRow } from './types';

// Disable camera rows on camera-less devices because the native camera picker aborts.
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
