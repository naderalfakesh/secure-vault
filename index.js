// Unistyles must be configured before Expo Router evaluates any route module,
// because the router loads every file under app/ up front, in path order.
import './src/theme/unistyles';
// The layout direction follows the language the app speaks (F17).
import './src/i18n/setup';
import 'expo-router/entry';
