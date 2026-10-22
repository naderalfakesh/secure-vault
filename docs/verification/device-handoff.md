# Device handoff checklist

Build: `main` at `e13d762` (Expo SDK 58, version 1.0.0 (1)). **No physical
device has ever run SecureVault.** Every result so far comes from the iOS 27
simulator and the Android emulator. This list is what only a real phone can
show. Work through it in order; each item has the expected result.

Devices: one iPhone (iOS 26 or later for glass) and one Android phone (the
Pixel 9). Set auto-lock to **Immediately** unless an item says otherwise.

## Install

**Android.** Sideload the release APK:
`_build/cryptoNoteVault/device-handoff/SecureVault-1.0.0-1-release.apk` on the
SSD (signed with the template's debug key, R8 on, JS bundle embedded, no Metro
needed). Check its sha256 against the value in the handoff message before
installing. A store build needs a real upload key; this one is for testing
only.

**iOS.** Needs your Apple team, so build it yourself. The project lives on the
SSD at `/Volumes/Samsung SSD 990 2TB/projects/cryptoNoteVault`; the space in
the path is fine, because SDK 58 quotes its build phases and the old quoting
patch is no longer needed.

1. `nvm use 24 && npm ci`
2. `npx expo prebuild --clean --platform ios` (runs `pod install`; if that
   fails on encoding, run `cd ios && LANG=en_US.UTF-8 pod install`).
3. `open ios/SecureVault.xcworkspace` in Xcode 27.1.
4. SecureVault target › Signing & Capabilities: tick Automatically manage
   signing and pick your team. The bundle ID stays
   `com.naderalfakesh.securevault`.
5. Choose your iPhone as the destination (Developer Mode on, trusted).
6. Product › Scheme › Edit Scheme › Run › Build Configuration: **Release**.
7. Run. Trust the developer profile on the phone if asked.

One-line alternative after step 2 and a team set once in Xcode:
`npx expo run:ios --device --configuration Release`.

## 1. First run and lock

- [ ] **1.1 Onboarding.** Intro (Skip, Back, swipe), Choose PIN, easy-PIN
      warning, mismatch, "Creating your vault key", biometrics step, empty
      Library. Expected: every step works, no crash.
- [ ] **1.2 PIN.** Lock, unlock with the PIN; a wrong PIN shakes and counts.
      Expected: right PIN opens, wrong one is refused.
- [ ] **1.3 Face ID / fingerprint.** Enable at setup; lock; unlock with
      biometrics. Then deny Face ID at its first prompt: Settings shows "not
      allowed" with Open Settings; allow it there, return, the row enables.
      Android: a phone with only class-2 face unlock shows no biometrics step.
- [ ] **1.4 Declined biometrics stay off.** Decline at setup, then later
      reset the PIN or restore. Expected: Face ID stays off (QA saw it turn
      back on once on the simulator).
- [ ] **1.5 Lockout.** Five wrong PINs. Expected: 30 s pause, empty dimmed
      dots and the clock mark; relaunching does not reset the pause. Change
      PIN: five wrong current PINs pause it too; the device unlock still opens
      the vault.
- [ ] **1.6 Auto-lock.** Immediately, 1 minute and 5 minutes: leave and
      return before and after the time. Expected: locks only after the set
      time; rotation does not lock.
- [ ] **1.7 Privacy cover.** Open the app switcher on the Library, the viewer
      and with a sheet open (import, create backup). Expected: solid cover,
      no content in the snapshot. Android: check a sheet (dialog window) is
      also hidden in Recents.
- [ ] **1.8 iOS Keychain prompt count (review F2).** Count Face ID / passcode
      prompts per action: unlock, open a document, scroll a Library full of
      thumbnails, share, create backup, restore. Expected: one prompt per
      action at most. **Fail** if it prompts per thumbnail or repeats inside
      one action. Note the action and the count.
- [ ] **1.9 iOS after a reboot.** Reboot the iPhone, unlock it, open the
      app. Expected: lock screen, the PIN opens the vault, nothing cleared
      (a launch before the first unlock must never wipe data).

## 2. Scan and import

- [ ] **2.1 Camera scan, iOS (VisionKit).** Scan 3 pages; review (remove,
      hold and move, Add pages, Discard); Continue; Cancel while reading;
      save. Expected: pages in the chosen order in the viewer; text read and
      a title suggested.
- [ ] **2.2 Camera scan, Android (ML Kit document scanner).** Same as 2.1.
      Expected: same; note the scanner's URI scheme if visible.
- [ ] **2.3 Camera permission.** iOS: deny at the first prompt; callout, Open
      Settings, allow, return; callout gone. Android: deny Take a photo twice.
- [ ] **2.4 Photos.** Import a photo and a HEIC photo. Expected: saved,
      thumbnail shows.
- [ ] **2.5 Files.** A PDF, a password-protected PDF, a PDF that cannot be
      rendered, a `.txt` or `.numbers` file. Expected: supported ones save;
      the others get a plain sentence, not a raw error.
- [ ] **2.6 Cloud providers.** iOS: a file from iCloud Drive. Android: a file
      from Google Drive (a `content://` provider), and a provider that ignores
      the type filter. Expected: imports work; no `temp_import_` copy left.
- [ ] **2.7 Lock during import.** Lock during review, during reading and
      during encrypting. Expected: back to the lock screen; after unlock a
      notice explains what happened; nothing half-saved.
- [ ] **2.8 Search.** Search for text read from a scan. Expected: hit with
      the snippet highlighted (SQLCipher FTS5); sort by expiry date works.

## 3. Library, viewer, share

- [ ] **3.1 Library.** Rows, collections, See all, sort, filter, move,
      delete with undo. Expected: all work; undo restores the document.
- [ ] **3.2 Viewer.** Open an image and a multi-page PDF; zoom, swipe pages,
      page strip, Copy text. Expected: smooth, right page counts.
- [ ] **3.3 Clipboard.** iOS: copied text is not offered on a Mac through
      Universal Clipboard, is gone after 2 minutes and after a lock, and no
      "Allow Paste" prompt appears at the lock when another app copied since
      (that copy is kept). Android 13+: no clipboard preview, gone after a
      lock, no "pasted from your clipboard" toast.
- [ ] **3.4 Share.** Share an image and a PDF to Files, Mail and a chat app.
      A large PDF shows "Preparing a copy"; Cancel leaves nothing. Two shares
      of the same document on Android get different URIs.
- [ ] **3.5 Share sheet on lock.** iOS: open the share sheet, go home for
      more than 2 minutes, return. Expected: sheet gone, lock screen, then
      the banner with Share again after unlock. Also lock with Save to Files
      or Mail open over the sheet.
- [ ] **3.6 Android share chooser.** Chooser up more than 2 minutes, then Back
      or a pick: lock screen. Within 2 minutes: stays open. Home from the
      chooser within 2 minutes with auto-lock Immediately: locks on return
      (QA saw it stay open in 3 of 4 emulator runs before the fix).
- [ ] **3.7 Confirm before sharing.** Turn it on: cancelling the device
      prompt keeps the warning; success shares.

## 4. Backup

- [ ] **4.1 Create.** Create a backup with an Arabic passphrase and with a
      weak but valid one; share it out (Files / Drive). Expected: "Last
      created on this phone" updates with the local date; a lock during the
      share leaves the date unchanged.
- [ ] **4.2 Restore on the same phone.** Expected: "Vault restored: N
      entries", every document opens.
- [ ] **4.3 iOS backup restored on Android.** Expected: all documents and
      text identical.
- [ ] **4.4 Android backup restored on iOS.** Expected: same.
- [ ] **4.5 Cancel.** With a large backup (hundreds of MB), cancel right
      after Restore, early in Checking, and at the last Checking entry.
      Expected: "Restore cancelled. Nothing was changed.", same documents. A
      cancel just before Restoring either cancels or the sheet shows "This
      can't be stopped." and the restore completes.
- [ ] **4.6 Wrong passphrase, damaged file, not a backup.** Expected: a plain
      sentence each; "Choose another file" opens the picker again.
- [ ] **4.7 Low storage (BACKUP_NO_SPACE).** Fill the phone until free space
      is below the backup's size, then restore. Expected: refused with the
      no-space sentence and the vault unchanged. Android: the picked backup
      must not vanish while the sheet is open.
- [ ] **4.8 Lock during restore.** Lock during Checking and Restoring.
      Expected: restore finishes behind the lock; the PIN unlock answers
      while it runs; the outcome shows after unlock.
- [ ] **4.9 iOS device backup.** Optional: iCloud/Finder backup of the phone
      holds only ciphertext; restoring to a new phone is untested.

## 5. Security edge cases

- [ ] **5.1 Keystore window lapse (Android).** Start a restore, let the
      Keystore window lapse so the prompt reappears, cancel it before and
      after the wipe. Expected: pre-wipe sentence with the vault untouched,
      or the partial sentence after the wipe; Restore works again.
- [ ] **5.2 Screen lock changed (KEY_INVALIDATED).** Add a new fingerprint or
      change the screen lock (iOS: change the passcode). Expected: plain
      sentence; documents stay or "Delete everything" leads to setup; never
      a crash.
- [ ] **5.3 Lost PIN plus removed screen lock (Android).** Expected: the
      unavailable screen with the plain sentence and only "Delete
      everything", which leads to setup (QA saw setup over orphaned entries
      on the emulator).
- [ ] **5.4 iOS reinstall.** Set up a vault, delete the app, reinstall.
      Expected: onboarding, no old lock screen; a new setup works.
- [ ] **5.5 Update over a previous build.** Install an older build with
      documents, then this one over it. Expected: lock screen, the old PIN
      unlocks, every document opens.
- [ ] **5.6 Delete everything.** Also while an export or restore runs.
      Expected: reason line shows; relaunch goes to setup.

## 6. Release build

- [ ] **6.1 Index opens (SQLCipher linked).** On both release builds the
      Library loads and search works. Expected: no `SQLCIPHER_UNAVAILABLE`,
      no "file is not a database".
- [ ] **6.2 R8 and the vault module (Android).** Encrypt, decrypt, export and
      restore all work in the release APK. Expected: no crash or
      `ClassNotFound`/`NoSuchMethod` from `expo-vault`.
- [ ] **6.3 iOS Release with patched ML Kit (ADR 0001).** The Release device
      build links the rewritten arm64 ML Kit objects. Expected: it builds,
      launches and text reading works on a scan. Optional: an App Store
      archive validates.
- [ ] **6.4 Settings version.** Expected: "1.0.0 (1)"; no dev Tools bubble,
      no LogBox.

## 7. Accessibility and locale

- [ ] **7.1 VoiceOver (spoken).** Every control named; PIN keys speak their
      digit; wrong PIN and lockout spoken once; progress during check,
      restore, backup and reading spoken without flooding; "This can't be
      stopped" and Cancel spoken; onboarding "Step n of 3".
- [ ] **7.2 TalkBack (spoken).** Same as 7.1.
- [ ] **7.3 AX5 / largest text.** Walk every screen. Expected: sheets scroll
      to their last button, tab bar and PIN pad usable (see known issues).
- [ ] **7.4 Reduce Motion / Reduce Transparency.** Screens cross-fade, no
      shake, glass turns solid live.
- [ ] **7.5 Arabic locale.** Phone in Arabic: the app stays English, left to
      right. With Arabic-Indic digits (`ar-EG-u-nu-arab`), the keypad shows
      them and the same PIN unlocks. Arabic file names read correctly.

## 8. Privacy (optional)

- [ ] **8.1 Network capture during text reading.** Proxy or log the phone's
      traffic while a scan is read. Record whether ML Kit contacts Clearcut
      or firebaselogging hosts (the in-app disclosure says Google says ML Kit
      doesn't send the text). Expected: no document content leaves the phone.

## 9. App icon

- [ ] **9.1 iOS.** Home screen light, dark and tinted icons.
- [ ] **9.2 Android.** Adaptive icon in several launcher masks; themed
      (monochrome) icon on Android 13+. Note any halo.

## Known issues

Accepted cosmetic leftovers, seen on the simulator or emulator. Note them only
if they are worse on a device.

- iOS splash flashes ~30 ms of colour (and the status bar) when the pinned
  Appearance differs from the system. Matching schemes are clean.
- Android RTL switch thumb sits on the right. RTL is a dev preview only; there
  is no Arabic translation yet.
- AX5: the lock subtitle needs a scroll, and collection tiles break mid-word.
- A rare transient "file picker couldn't open" toast after a very fast tap;
  the next tap works.
- iOS: an 11-entry restore check is too fast for Cancel to land.
- iOS: copied text stays on the clipboard while the app is away, until it
  returns (then the lock clears it).
- Android: a font-scale change relocks the app.
- Undo lasts 5 s, not the handover's 8 s, until F8.
- Not checked anywhere yet: iPhone SE-size layout, iPad.

## How to report

Per item write one line:

`<item> | <device and model> | <OS version> | PASS or FAIL | note`

For each FAIL add a screenshot or a screen recording (the privacy cover blanks
system screenshots on some screens; use a screen recording then), the steps,
and what you expected. For 1.8 add the prompt count per action.
