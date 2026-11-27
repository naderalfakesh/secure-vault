import type { PropsWithChildren } from 'react';
import type { ViewProps } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

export type ScreenProps = PropsWithChildren<
  ViewProps & {
    edges?: readonly Edge[];
    padded?: boolean;
  }
>;
