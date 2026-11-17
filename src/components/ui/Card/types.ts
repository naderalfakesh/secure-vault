import type { PropsWithChildren } from 'react';
import type { ViewProps } from 'react-native';

export type CardProps = PropsWithChildren<ViewProps & { padded?: boolean }>;
