import { Text as NativeText } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

import { fitsByDefault, maxScale, toneToColor } from './constants';
import { plainText, wholeWordFit } from './helpers';
import type { AppTextProps } from './types';

export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  align,
  fit,
  style,
  ...props
}: AppTextProps) {
  const { theme } = useUnistyles();
  const color = theme.colors[toneToColor[tone]];
  const text = (fit ?? fitsByDefault.has(variant)) ? plainText(children) : null;
  const fitProps = text === null ? null : wholeWordFit(text, props.numberOfLines);

  return (
    <NativeText
      maxFontSizeMultiplier={maxScale[variant]}
      {...props}
      {...fitProps}
      style={[theme.typography[variant], { color }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </NativeText>
  );
}
