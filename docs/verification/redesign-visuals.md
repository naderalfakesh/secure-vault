# Redesign visuals: icons, mark, countdown arc, Liquid Glass (F16), app icon and splash

Branch `feat/redesign-visuals`, from `feat/redesign-i18n` cb79742 (every
redesigned screen plus the i18n and accessibility pass). Scope is handover
§3.4 (icons), §3.5 (app icon and splash), the Sheet and TabBar rows of §4,
F16 in §8, and §10. This is the last code lane of the redesign.

This lane changes presentation only. There is no change to behaviour, crypto,
keys, the backup format, the schema, routes or data. The bundle id, scheme
and Keychain service are unchanged.

## New dependencies

| Package             | Version   | Installed with     | Why                                    |
| ------------------- | --------- | ------------------ | -------------------------------------- |
| `react-native-svg`  | `15.16.0` | `npx expo install` | The §3.4 SVG icon set, mark, arc       |
| `expo-glass-effect` | `~58.0.4` | `npx expo install` | `GlassView` for the tab bar and sheets |

`@expo/vector-icons` is removed. Nothing imports it any more (the step-1
Feather and Material fallbacks are gone) and no other package depends on it.
No new config plugin is needed, so CLAUDE.md's required native config list is
unchanged.

## Icons (§3.4)

- `src/components/ui/iconPaths.ts` holds the 43 paths of the design set,
  copied byte for byte from `Main.dc.html` (`renderVals().i`), mark included.
  Seven extra glyphs the app already used and the set does not cover
  (`unlock`, `fingerprint`, `photos`, `text`, `sparkles`, `umbrella` for
  insurance, `tray` for Other) are drawn on the same 24 pt grid in the same
  style, and marked as such in the file.
- `Icon` draws `Svg` + `Path` with `viewBox 0 0 24 24`, stroke 1.75, round
  caps and joins, no fill. It keeps its API (`name`, `size`, `tone`, `color`,
  `weight`, `accessibilityLabel`) and adds `strokeWidth` (the mark uses 1.5,
  as in the design). Screens did not change.
- iOS keeps SF Symbols (`expo-symbols`) where the system has the same glyph:
  lock, lock.open, faceid, touchid, camera, photo, photo.on.rectangle,
  folder, doc.text, doc.on.doc, magnifyingglass, square.grid.2x2, plus,
  xmark, checkmark, checkmark.circle, chevron.left/right, ellipsis,
  square.and.arrow.up/down, trash, pencil, tag, calendar,
  exclamationmark.triangle, info.circle, checkmark.shield, key, eye,
  eye.slash, text.alignleft, sparkles, archivebox,
  arrow.triangle.2.circlepath, delete.left, arrow.up.arrow.down, clock,
  person.text.rectangle, cross, banknote, umbrella, receipt, tray. The SVG is
  the `SymbolView` fallback.
- iOS draws the exact SVG where SF Symbols has no match: the mark, scan
  (corner brackets with a scan line), settings (the design's two sliders),
  filter (funnel), legal (scales) and restore (arrow out of a tray).
- Android draws the SVG for every glyph.
- Chevrons and back still mirror in RTL on both platforms (`scaleX: -1`);
  backspace does not. Icon-only buttons keep their labels: the Icon is
  decorative unless it gets an `accessibilityLabel`, and `IconButton`
  already requires one.

## Mark and countdown arc

- `Mark` draws the SVG mark at stroke 1.5 on the squircle with the design's
  sizes: 64 pt with a 38 pt glyph on the lock screen, 72/44 for the splash,
  80/46 on the privacy cover. Corners are 18/20/22 (plain round corners,
  like the design's CSS and the splash PNG). Light: white on `#3451D1`. Dark:
  `#8EA2FF` on `#1D2858`.
- The lockout shows the clock in the muted squircle, as the Lock board does.
- Onboarding has no brand mark in the design (intro art and the key squircle
  on "Add a PIN"); its glyphs now come from the SVG set.
- The undo toast's countdown is a drawn ring: a faint track and a
  `toastAction` arc that drains clockwise from twelve o'clock over the
  toast's duration (Reanimated `useAnimatedProps` on `strokeDashoffset`),
  seconds inside. With reduced motion the arc stays full and the label reads
  the static "8s" (§10.3).

## Liquid Glass (F16)

- `src/components/ui/Glass.tsx`: `useGlass()` is true only on iOS when
  `isLiquidGlassAvailable()` and `isGlassEffectAPIAvailable()` are both true
  (some iOS 26 betas crash without the second check) and Reduce Transparency
  is off. It listens to `reduceTransparencyChanged`, so the switch applies
  live. `GlassBackground` is a `GlassView` (`regular`) that fills its parent,
  takes the parent's corners and follows the app's own Appearance choice
  through `colorScheme`, not only the system one.
- TabBar: on glass the capsule drops its solid fill and hairline and draws the
  glass behind the tabs, with the corner radius at half its measured height
  so it stays a capsule at large text sizes. The float shadow stays.
- Sheet: on glass the panel drops `surfaceElevated` and draws the glass with
  the panel's corners (36 floating on iOS). The scrim, the grabber, the
  header and the spring are unchanged.
- Fallback everywhere else (Android, iOS below 26, Reduce Transparency on):
  the existing solid surfaces, i.e. the tab bar on `surface` with the
  hairline and the sheet on `surfaceElevated` (§2).
- SDK 58 API check: `GlassView` takes `glassEffectStyle`, `tintColor`,
  `isInteractive`, `colorScheme` and per-corner radii; SDK 58's native view
  waits until its ancestors are visible before installing the effect, so the
  sheet's fade-in no longer drops the glass. Nothing the design needs is
  missing. Not used: the design's glass IconButton for the viewer (§4) is
  "white 14% + blur", not system glass, and stays as it is.
- Privacy cover: unchanged. It is drawn in react-native-screens'
  `FullWindowOverlay`, a window-level view above every presented modal, and
  the glass lives inside the sheet's modal, so the cover still sits above a
  glass sheet. Needs a device check (below).

## App icon (§3.5)

Generated from the design's mark path by a throwaway `sharp` script outside
the repo (scratch folder, not committed); only the PNGs are committed.

| File                                  | Content                                                   | Used by                                |
| ------------------------------------- | --------------------------------------------------------- | -------------------------------------- |
| `assets/icon.png`                     | 1024, white outline mark (44/72 of the side) on `#3451D1` | `expo.icon`, `ios.icon.light`          |
| `assets/icon-dark.png`                | 1024, `#8EA2FF` mark on `#0A0D1A`                         | `ios.icon.dark`                        |
| `assets/icon-tinted.png`              | 1024, white mark on black (the system tints it)           | `ios.icon.tinted`                      |
| `assets/adaptive-icon.png`            | 1024, transparent, white mark inside the 66/108 safe zone | `android.adaptiveIcon.foregroundImage` |
| `assets/adaptive-icon-monochrome.png` | same glyph, for Android 13+ themed icons                  | `android.adaptiveIcon.monochromeImage` |
| `assets/favicon.png`                  | 48, the mark                                              | `web.favicon`                          |

`android.adaptiveIcon.backgroundColor` is `#3451D1`. iOS applies its own
squircle mask, so the iOS PNGs are full-bleed squares. Field names checked
in `@expo/config-types` (`IOSIcons.light/dark/tinted`,
`adaptiveIcon.monochromeImage`). Prebuild wrote the three appearances into
`AppIcon.appiconset` and an `adaptive-icon` with background, foreground and
monochrome layers.

## Native splash and the handoff (§3.5)

- `expo-splash-screen` plugin: `image` `assets/splash-icon.png` (the 72 pt
  squircle with the 44 pt glyph, nothing else), `imageWidth` 72,
  `backgroundColor` `#F5F6FA`; `dark`: `assets/splash-icon-dark.png` (mark on
  `#1D2858`) over `#0A0D1A`. No wordmark, no spinner. Both platforms centre
  the image (iOS storyboard, Android 12+ splash icon in its 288 dp canvas).
- The native splash can only centre its image, while the Lock board puts the
  mark near the top above the PIN pad. Moving the lock mark to the middle
  would push the keypad off the design, so the lock layout is unchanged and
  the handoff closes the gap instead: `SplashHandoff` (root layout) repaints
  the splash exactly (background plus the 72 pt `Mark` in the middle) before
  the native splash hides, then carries the mark to the lock screen's mark
  (which reports its window frame) in 360 ms, scaling 72 to 64, while the
  background fades. The two marks are drawn by the same component, so they
  meet with no jump. With reduced motion, during the lockout (different
  glyph), or on screens without the mark (setup, vault unavailable) it only
  cross-fades in 200 ms. It never takes touches, is hidden from assistive
  tech, and sits under the privacy cover.
- Review fixes: the handoff starts once and keeps the root size in a ref, so
  a resize mid-handoff (Split View, Stage Manager, multi-window, a foldable)
  can no longer cancel its timer and leave the opaque overlay up; a hard
  fallback clears it 1.5 s after release regardless. The squircle scales
  72 to 64 while the glyph carries its own scale, so it lands at exactly
  38 pt, not 39.1. The lock screen reads the lockout on its first render and
  re-reports when it changes, so a late lockout withdraws the target and the
  handoff fades instead of gliding onto the clock squircle.
- The native splash follows the system appearance, the handoff follows the
  app's Appearance setting. With an override that differs from the system
  the colours change at the handoff (one frame). Native splash code cannot
  read the stored setting, so this stays.

## Checks

| Check                       | Result                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `npm run validate`          | Pass: prettier, eslint, tsc, jest 80 suites and 667 tests, expo-doctor 20/20                     |
| Design paths                | All 43 design paths in `iconPaths.ts` match `Main.dc.html` exactly (script compare)              |
| `npx expo prebuild --clean` | Pass; `AppIcon.appiconset` has light, dark and tinted; the adaptive icon has a monochrome layer  |
| iOS Debug simulator build   | `** BUILD SUCCEEDED **` from the spaced SSD path (RNSVG and ExpoGlassEffect pods compile)        |
| Android `assembleDebug`     | `BUILD SUCCESSFUL` (arm64-v8a, JDK 17, `--max-workers=4`); the APK has `libcrypto.so` and splash |

iOS: `xcodebuild -workspace SecureVault.xcworkspace -scheme SecureVault
-configuration Debug -sdk iphonesimulator -destination "generic/platform=iOS
Simulator" CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO`, DerivedData on the
SSD. The `ios/` and `android/` folders and the build output were deleted
afterwards. Jest still prints the existing "worker process has failed to exit
gracefully" notice; the new suites show no open handles under
`--detectOpenHandles`.

## Native QA owed

No simulator, emulator or device was used in this lane.

- Icons, iOS and Android: every screen's glyphs render, none missing or
  boxed; SF Symbols on iOS where listed, the SVG elsewhere; the SVG-only ones
  (scan in the tab bar, settings sliders, filter, legal, restore, the mark)
  look the same weight as their SF neighbours.
- RTL (Arabic) on both: chevrons in Settings rows and the back buttons point
  the other way, backspace does not.
- Glass on an iOS 26+ device or simulator: the tab bar capsule and every sheet
  are glass, light and dark, and with the Appearance override set opposite to
  the system. Reduce Transparency on (Settings, Accessibility, Display & Text
  Size) switches both to solid live. Text in sheets stays legible over busy
  library content.
- Privacy cover over a glass sheet: open a sheet, go to the app switcher; the
  cover hides the sheet.
- Fallback: Android and an iOS below 26 show the solid tab bar with the
  hairline and solid sheets.
- Undo toast: the arc drains over 8 s and ends with the toast; reduced motion
  shows a full ring and "8s".
- Splash to lock: cold start in light and dark; the splash mark glides to the
  lock mark with no flash or jump; reduced motion only fades; a lockout cold
  start fades to the clock squircle; first run fades to onboarding.
- App icon: home screen light, dark and tinted on iOS 18+; Android adaptive
  icon in several launcher masks, and the themed (monochrome) icon on
  Android 13+.
