import { router } from 'expo-router';

export function goToLibrary() {
  if (router.canGoBack?.()) router.back();
  else router.replace('/');
}
