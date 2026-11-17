import { choosePinHint, EASY_PIN_WARNING } from '@/features/auth/onboardingCopy';
import { t } from '@/i18n';

import type { BiometryType } from '../../../modules/expo-vault';
import type { Stage } from './types';

/** The second step: confirming, and saving what was confirmed. */
export function isConfirmStep(stage: Stage): boolean {
  return stage === 'confirm' || stage === 'saving';
}

export type PinPromptInput = {
  stage: Stage;
  /** The confirmation did not match the first PIN. */
  mismatch: boolean;
  /** A key that guards documents only needs a PIN: "Add a PIN". */
  keepsDocuments: boolean;
  vaultEmpty: boolean;
  biometry: BiometryType;
  /** A setup failure the owner has not moved past yet. */
  shownError: string | null;
};

export type PinPrompt = {
  title: string;
  /** What the saving state says, also spoken. */
  saving: string;
  /** The line under the title: an error, a warning or the step's hint. */
  message: string;
  alerting: boolean;
  failing: boolean;
};

/** What the Choose PIN screen says at each stage. */
export function pinPrompt({
  stage,
  mismatch,
  keepsDocuments,
  vaultEmpty,
  biometry,
  shownError,
}: PinPromptInput): PinPrompt {
  const title = isConfirmStep(stage)
    ? t('onboarding.pin.confirmTitle')
    : keepsDocuments
      ? t('onboarding.pin.addTitle')
      : t('onboarding.pin.chooseTitle');
  const saving = keepsDocuments ? t('onboarding.pin.savingPin') : t('onboarding.pin.creatingKey');
  const hint = mismatch
    ? t('onboarding.pin.mismatch')
    : stage === 'easy'
      ? EASY_PIN_WARNING
      : stage === 'confirm'
        ? t('onboarding.pin.confirmHint')
        : stage === 'saving'
          ? saving
          : keepsDocuments
            ? t('onboarding.pin.addHint')
            : vaultEmpty
              ? t('onboarding.pin.emptyVaultHint')
              : choosePinHint(biometry);
  const alerting = Boolean(shownError) || mismatch || stage === 'easy';
  const message = shownError ?? hint;
  const failing = Boolean(shownError) || mismatch;
  return { title, saving, message, alerting, failing };
}
