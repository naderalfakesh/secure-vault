import type { ReactNode } from 'react';

export type TitledScrollProps = {
  title: string;
  children: ReactNode;
  showsVerticalScrollIndicator?: boolean;
};
