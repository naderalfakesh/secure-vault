import * as DocumentPicker from 'expo-document-picker';

import { PICKER_OPTIONS, PICKER_RETRY_MS } from './constants';
import { pickerBusy } from './helpers';

/** Opens the system picker, once more after a short wait if a pick is still closing. */
export async function openPicker(): Promise<DocumentPicker.DocumentPickerResult> {
  try {
    return await DocumentPicker.getDocumentAsync(PICKER_OPTIONS);
  } catch (error) {
    if (!pickerBusy(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, PICKER_RETRY_MS));
    return DocumentPicker.getDocumentAsync(PICKER_OPTIONS);
  }
}
