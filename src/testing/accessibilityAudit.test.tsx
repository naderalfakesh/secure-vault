import { render } from '@testing-library/react-native';
import { Pressable, Text, View } from 'react-native';

import { auditAccessibility } from './accessibilityAudit';

describe('accessibility audit', () => {
  it('flags an icon-only button without a label and a target under 44 pt', async () => {
    const view = await render(
      <View>
        <Pressable accessibilityRole="button" onPress={() => {}} style={{ width: 30, height: 30 }}>
          <View />
        </Pressable>
      </View>,
    );
    const problems = auditAccessibility(view.toJSON());
    expect(problems).toEqual([
      expect.stringMatching(/no accessibility label/),
      expect.stringMatching(/30 pt high/),
      expect.stringMatching(/30 pt wide/),
    ]);
  });

  it('accepts a labelled control, text as a name, and hit slop that reaches 44 pt', async () => {
    const view = await render(
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={4}
          style={{ width: 36, height: 36 }}
        >
          <View />
        </Pressable>
        <Pressable accessibilityRole="button" style={{ minHeight: 44 }}>
          <Text>Continue</Text>
        </Pressable>
      </View>,
    );
    expect(auditAccessibility(view.toJSON())).toEqual([]);
  });

  it('skips controls hidden from assistive technology', async () => {
    const view = await render(
      <View accessibilityElementsHidden>
        <Pressable accessibilityRole="button" style={{ width: 10, height: 10 }} />
      </View>,
    );
    expect(auditAccessibility(view.toJSON())).toEqual([]);
  });
});
