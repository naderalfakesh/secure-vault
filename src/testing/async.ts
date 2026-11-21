import { act } from '@testing-library/react-native';

import { wait } from '@/utils/time';

/** Lets real timers run for `ms` inside an `act` scope, for flows driven by timeouts. */
export const settle = (ms: number) =>
  act(async () => {
    await wait(ms);
  });
