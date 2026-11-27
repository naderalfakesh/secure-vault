import type { BiometricAvailability } from '@/features/auth/biometricAvailability';
import type { BiometryType } from '@modules/expo-vault';

export function stepBiometry(
  availability: BiometricAvailability | null,
  biometry: BiometryType,
): BiometryType {
  return availability?.kind && availability.kind !== 'none' ? availability.kind : biometry;
}
