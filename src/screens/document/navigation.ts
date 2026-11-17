import { router } from 'expo-router';

/** Back to where the viewer was opened from, or the Library when there is no history. */
export function goToLibrary() {
  if (router.canGoBack?.()) router.back();
  else router.replace('/');
}
