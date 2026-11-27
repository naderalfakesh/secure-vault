import type { ViewStyle } from 'react-native';

// Neither UISwitch (under forced RTL) nor Android Switch mirrors its "on" side automatically.
export const MIRRORED: ViewStyle = { transform: [{ scaleX: -1 }] };
