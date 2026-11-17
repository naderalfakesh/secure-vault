import type { PropsWithChildren } from 'react';
import type { ViewProps } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

export type ScreenProps = PropsWithChildren<
  ViewProps & {
    /** Safe-area edges to pad. Tabs and headers usually own top or bottom. */
    edges?: readonly Edge[];
    padded?: boolean;
  }
>;
