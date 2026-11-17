import type { ReactNode } from 'react';

import type { SceneProps } from '../types';
import { Papers } from './Papers';
import { Sealed } from './Sealed';
import { Unlock } from './Unlock';

/** One layer of the slide's scene. */
export function Scene({ scene, layer, biometry, colors }: SceneProps): ReactNode {
  if (scene === 'papers') return <Papers colors={colors} layer={layer} />;
  if (scene === 'sealed') return <Sealed colors={colors} layer={layer} />;
  return <Unlock colors={colors} layer={layer} biometry={biometry} />;
}
