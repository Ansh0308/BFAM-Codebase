// App entry. The crash guard goes first so that an error thrown while the app's own
// libraries are loading (before app/_layout.tsx ever runs) is shown on screen instead of
// the app closing with no message. Then the normal Expo Router entry.
import { installCrashGuard } from './src/lib/crashGuard';

installCrashGuard();

import 'expo-router/entry';
