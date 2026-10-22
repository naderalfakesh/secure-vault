import { fireEvent, render } from '@testing-library/react-native';

import { darkColors, lightColors } from '@/theme/colors';

import { OnGlassContext } from '../Glass';
import { PassphraseField } from '../PassphraseField';
import { StrengthMeter } from '../StrengthMeter';

describe('PassphraseField', () => {
  it('sits on a solid surface with a hairline edge inside a glass sheet', async () => {
    const view = await render(
      <OnGlassContext.Provider value>
        <PassphraseField label="Passphrase" value="" onChangeText={jest.fn()} />
      </OnGlassContext.Provider>,
    );
    expect(view.getByTestId('passphrase-box')).toHaveStyle({
      backgroundColor: lightColors.surface,
      borderColor: lightColors.border,
    });
  });

  it('keeps the muted fill outside glass', async () => {
    const view = await render(
      <PassphraseField label="Passphrase" value="" onChangeText={jest.fn()} />,
    );
    expect(view.getByTestId('passphrase-box')).toHaveStyle({
      backgroundColor: lightColors.surfaceMuted,
    });
  });

  it('is a labelled secure field with no correction or capitalisation', async () => {
    const onChangeText = jest.fn();
    const view = await render(
      <PassphraseField label="Passphrase" value="" onChangeText={onChangeText} />,
    );
    const input = view.getByLabelText('Passphrase');

    expect(input).toHaveProp('secureTextEntry', true);
    expect(input).toHaveProp('autoCorrect', false);
    expect(input).toHaveProp('autoCapitalize', 'none');
    expect(input).toHaveProp('spellCheck', false);
    await fireEvent.changeText(input, 'قمر فوق جبل');
    expect(onChangeText).toHaveBeenCalledWith('قمر فوق جبل');
  });

  it('accepts Arabic-Indic digits and any script as typed, and lays them out by content', async () => {
    const onChangeText = jest.fn();
    const view = await render(
      <PassphraseField label="Passphrase" value="" onChangeText={onChangeText} />,
    );
    const input = view.getByLabelText('Passphrase');

    expect(input).not.toHaveProp('keyboardType');
    expect(input).toHaveStyle({ writingDirection: 'auto' });
    for (const typed of ['٢٠٢٦ ١٢٣٤', '۱۲۳ رمز', 'Ωμέγα 日本 עברית 42']) {
      await fireEvent.changeText(input, typed);
      expect(onChangeText).toHaveBeenLastCalledWith(typed);
    }
  });

  it('shows and hides the passphrase with a named toggle', async () => {
    const view = await render(
      <PassphraseField label="Passphrase" value="x" onChangeText={jest.fn()} />,
    );

    await fireEvent.press(view.getByRole('button', { name: 'Show passphrase' }));
    expect(view.getByLabelText('Passphrase')).toHaveProp('secureTextEntry', false);
    await fireEvent.press(view.getByRole('button', { name: 'Hide passphrase' }));
    expect(view.getByLabelText('Passphrase')).toHaveProp('secureTextEntry', true);
  });

  it('marks an error with a danger border and an alert', async () => {
    const view = await render(
      <PassphraseField
        label="Repeat passphrase"
        value="abc"
        onChangeText={jest.fn()}
        error="The passphrases don't match."
      />,
    );

    expect(view.getByRole('alert')).toBeOnTheScreen();
    expect(view.getByText("The passphrases don't match.")).toBeOnTheScreen();
    expect(view.getByLabelText('Repeat passphrase')).toHaveProp(
      'accessibilityHint',
      "The passphrases don't match.",
    );
    expect(view.getByTestId('passphrase-box')).toHaveStyle({
      borderColor: lightColors.danger,
    });
  });
});

describe('StrengthMeter', () => {
  it('says nothing for an empty passphrase', async () => {
    const view = await render(<StrengthMeter passphrase="" />);

    expect(view.queryByText(/Weak|Fair|Good|Strong/)).toBeNull();
  });

  it('labels and colours the estimate', async () => {
    const view = await render(<StrengthMeter passphrase="correct horse battery staple" />);

    expect(view.getByLabelText('Passphrase strength: Strong')).toBeOnTheScreen();
    expect(view.getByText('Strong', { includeHiddenElements: true })).toHaveStyle({
      color: lightColors.success,
    });
  });

  it('fills one danger segment for a weak passphrase', async () => {
    const view = await render(<StrengthMeter passphrase="password" />);
    const hidden = { includeHiddenElements: true };

    expect(view.getByTestId('strength-segment-1', hidden)).toHaveStyle({
      backgroundColor: lightColors.danger,
    });
    expect(view.getByTestId('strength-segment-2', hidden)).toHaveStyle({
      backgroundColor: lightColors.borderStrong,
    });
  });

  it('keeps the empty track visible on a solid sheet in both themes', () => {
    // WCAG relative luminance contrast between the track and the sheet.
    const luminance = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const contrast = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    for (const palette of [lightColors, darkColors]) {
      expect(contrast(palette.borderStrong, palette.surfaceElevated)).toBeGreaterThan(
        contrast(palette.surfaceMuted, palette.surfaceElevated),
      );
      expect(contrast(palette.borderStrong, palette.surfaceElevated)).toBeGreaterThanOrEqual(1.4);
    }
  });
});
