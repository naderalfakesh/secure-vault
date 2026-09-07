// Unistyles must be configured before Expo Router evaluates any route module,
// because the router loads every file under app/ up front, in path order.
import './src/theme/unistyles';
import 'expo-router/entry';
