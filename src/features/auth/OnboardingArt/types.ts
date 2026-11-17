import type { useUnistyles } from 'react-native-unistyles';

import type { BiometryType } from '../../../../modules/expo-vault';

export type OnboardingScene = 'papers' | 'sealed' | 'unlock';

/** Each scene is drawn in two layers that rise in one after the other. */
export type Layer = 'back' | 'front';

export type Palette = ReturnType<typeof useUnistyles>['theme']['colors'];

export type LayerProps = { colors: Palette; layer: Layer };

export type UnlockProps = LayerProps & { biometry: BiometryType };

export type SceneProps = UnlockProps & { scene: OnboardingScene };

export type GlyphProps = { color: string };

export type OnboardingArtProps = {
  scene: OnboardingScene;
  biometry?: BiometryType;
  testID?: string;
};
