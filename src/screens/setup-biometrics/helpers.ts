import type { BiometricAvailability } from '@/features/auth/biometricAvailability';

import type { BiometryType } from '../../../modules/expo-vault';

/** The biometric the step names: what the phone reports, else what the session knows. */
export function stepBiometry(
  availability: BiometricAvailability | null,
  biometry: BiometryType,
): BiometryType {
  return availability?.kind && availability.kind !== 'none' ? availability.kind : biometry;
}
