import { View } from 'react-native';

import { Button, Icon, InlineAlert, PassphraseField, StrengthMeter, Text } from '@/components/ui';
import { passphraseProblem } from '@/services/BackupService';

import { backupCopy as copy } from '../../../backupCopy';
import { CAN_SAVE } from '../../constants';
import { passphraseChecks } from '../../helpers';
import type { Destination } from '../../types';
import { Rule } from '../Rule';
import { styles } from './PassphraseForm.styles';

export type PassphraseFormProps = {
  passphrase: string;
  onPassphraseChange: (value: string) => void;
  confirmation: string;
  onConfirmationChange: (value: string) => void;
  /** Where the return key sends the backup. */
  preferred: Destination;
  onCreate: (destination: Destination) => void;
};

/**
 * Passphrase with an on-device strength estimate that never blocks, the
 * repeat, the two rules that are enforced, and where the backup goes.
 */
export function PassphraseForm({
  passphrase,
  onPassphraseChange,
  confirmation,
  onConfirmationChange,
  preferred,
  onCreate,
}: PassphraseFormProps) {
  const { longEnough, varied, matches } = passphraseChecks(passphrase, confirmation);
  const valid = passphraseProblem(passphrase, confirmation) === null;

  return (
    <>
      <Text variant="subheadline" tone="secondary">
        {copy['create.intro']}
      </Text>
      <PassphraseField
        label={copy['create.passphrase']}
        value={passphrase}
        onChangeText={onPassphraseChange}
      />
      <StrengthMeter passphrase={passphrase} />
      <Text variant="footnote" tone="secondary">
        {copy['create.hint']}
      </Text>
      <PassphraseField
        label={copy['create.repeat']}
        value={confirmation}
        onChangeText={onConfirmationChange}
        returnKeyType="go"
        onSubmitEditing={() => onCreate(preferred)}
      />
      {matches ? (
        <View accessible accessibilityLabel={copy['create.match']} style={styles.match}>
          <Icon name="check" size={16} tone="success" />
          <Text variant="footnote" tone="success" style={styles.matchText}>
            {copy['create.match']}
          </Text>
        </View>
      ) : confirmation.length > 0 && longEnough && varied ? (
        <Text variant="footnote" tone="secondary" accessibilityLiveRegion="polite">
          {copy['create.mismatch']}
        </Text>
      ) : null}
      <View style={styles.rules}>
        <Rule met={longEnough} label={copy['create.rule.length']} />
        <Rule met={varied} label={copy['create.rule.repeated']} />
      </View>
      <InlineAlert tone="info" message={copy['create.sameEverywhere']} />
      {CAN_SAVE() ? (
        <>
          <Button label={copy['create.save']} onPress={() => onCreate('save')} disabled={!valid} />
          <Button
            label={copy['create.share']}
            variant="tinted"
            onPress={() => onCreate('share')}
            disabled={!valid}
          />
        </>
      ) : (
        <Button label={copy['create.button']} onPress={() => onCreate('share')} disabled={!valid} />
      )}
    </>
  );
}
