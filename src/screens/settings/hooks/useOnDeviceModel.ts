import { useCallback, useEffect, useState } from 'react';

import { useToast } from '@/components/ui';
import {
  downloadOnDeviceModel,
  type ModelInfo,
  onDeviceModelInfo,
  selectIntelligence,
} from '@/features/intelligence';
import { t } from '@/i18n';

import { modelName } from '../helpers';

/** The suggestion engine in use, the on-device model's state, and its download. */
export function useOnDeviceModel() {
  const toast = useToast();
  const [engine, setEngine] = useState<string>('');
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [modelRefresh, setModelRefresh] = useState(0);
  const [downloading, setDownloading] = useState(false);
  // Only Gemini Nano is downloaded by the app; Apple's model comes with Apple Intelligence.
  const canDownload = model?.status === 'downloadable' && model.engine === 'gemini-nano';

  const downloadModel = useCallback(async () => {
    if (!model || downloading) return;
    const name = modelName(model.engine);
    setDownloading(true);
    try {
      await downloadOnDeviceModel();
      toast.show({
        message: t('settings.suggestions.downloaded', { engine: name }),
        tone: 'success',
      });
    } catch {
      toast.show({
        message: t('settings.suggestions.downloadFailed', { engine: name }),
        tone: 'danger',
      });
    } finally {
      setDownloading(false);
      setModelRefresh((count) => count + 1);
    }
  }, [downloading, model, toast]);

  useEffect(() => {
    let active = true;
    selectIntelligence().then((selected) => {
      if (active) setEngine(selected.engine);
    });
    onDeviceModelInfo().then((info) => {
      if (active) setModel(info);
    });
    return () => {
      active = false;
    };
  }, [modelRefresh]);

  return { engine, model, downloading, canDownload, downloadModel };
}
