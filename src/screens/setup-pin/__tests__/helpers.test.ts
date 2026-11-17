import { choosePinHint, EASY_PIN_WARNING } from '@/features/auth/onboardingCopy';
import { t } from '@/i18n';

import { isConfirmStep, type PinPromptInput, pinPrompt } from '../helpers';

const base: PinPromptInput = {
  stage: 'create',
  mismatch: false,
  keepsDocuments: false,
  vaultEmpty: false,
  biometry: 'faceId',
  shownError: null,
};

describe('isConfirmStep', () => {
  it('covers confirming and saving', () => {
    expect(isConfirmStep('create')).toBe(false);
    expect(isConfirmStep('easy')).toBe(false);
    expect(isConfirmStep('confirm')).toBe(true);
    expect(isConfirmStep('saving')).toBe(true);
  });
});

describe('pinPrompt', () => {
  it('asks a new vault to choose a PIN', () => {
    expect(pinPrompt(base)).toEqual({
      title: t('onboarding.pin.chooseTitle'),
      saving: t('onboarding.pin.creatingKey'),
      message: choosePinHint('faceId'),
      alerting: false,
      failing: false,
    });
  });

  it('asks an existing key to add a PIN', () => {
    const prompt = pinPrompt({ ...base, keepsDocuments: true });
    expect(prompt.title).toBe(t('onboarding.pin.addTitle'));
    expect(prompt.message).toBe(t('onboarding.pin.addHint'));
    expect(prompt.saving).toBe(t('onboarding.pin.savingPin'));
  });

  it('explains an emptied vault', () => {
    expect(pinPrompt({ ...base, vaultEmpty: true }).message).toBe(
      t('onboarding.pin.emptyVaultHint'),
    );
  });

  it('warns about an easy PIN without failing', () => {
    const prompt = pinPrompt({ ...base, stage: 'easy' });
    expect(prompt.message).toBe(EASY_PIN_WARNING);
    expect(prompt).toMatchObject({ alerting: true, failing: false });
  });

  it('confirms, then reports saving', () => {
    expect(pinPrompt({ ...base, stage: 'confirm' })).toMatchObject({
      title: t('onboarding.pin.confirmTitle'),
      message: t('onboarding.pin.confirmHint'),
    });
    expect(pinPrompt({ ...base, stage: 'saving' }).message).toBe(t('onboarding.pin.creatingKey'));
  });

  it('fails on a mismatch', () => {
    const prompt = pinPrompt({ ...base, stage: 'confirm', mismatch: true });
    expect(prompt.message).toBe(t('onboarding.pin.mismatch'));
    expect(prompt).toMatchObject({ alerting: true, failing: true });
  });

  it('puts a setup failure before the hint', () => {
    const prompt = pinPrompt({ ...base, shownError: 'Could not save' });
    expect(prompt.message).toBe('Could not save');
    expect(prompt).toMatchObject({ alerting: true, failing: true });
  });
});
