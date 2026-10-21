# Redesign steps 3 and 4: core screens

Branch `feat/redesign`, from 074a050 (step 1 tokens and primitives). Scope is
handover §9 steps 3 and 4: Lock and the privacy cover (J4), the Library merge
(J2), the viewer and details (J3), delete and undo (J7), Change PIN (J8), and
Settings without the Backup hub, plus the Auto-lock page. Step 1 review Lows
are folded in as their own commits.

## Gate status

| Gate                          | Status                                     | Effect here                                                                                                                       |
| ----------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| G6 (restore hardening)        | Not recorded in `docs/verification/`       | C2 says redesign merges wait for it. This work stays on the branch; do not merge.                                                 |
| SV-G1 (`unavailable` status)  | Not landed                                 | Launch derivation and `SessionProvider.tsx` untouched; no Vault unavailable screen.                                               |
| T3 (lockout copy)             | Satisfied (persisted lockout N5 is merged) | §7.3 lockout copy is in.                                                                                                          |
| T4 (protection page, intro 2) | Not landed                                 | "How your data is protected" stays an info row with no page.                                                                      |
| T8 ("Create a backup first")  | Not landed                                 | The Delete everything sheet has no such link.                                                                                     |
| G11 (one restore entry)       | Kept at every commit                       | Settings still has exactly one "Restore from backup" row in the same place, with its sheet; tested in `settings-screen.test.tsx`. |

## What is done

- **J4 Lock** (`app/lock.tsx`, copy in `src/features/auth/lockCopy.ts`): mark,
  "SecureVault is locked", biometric or PIN subtitle, "Enter your PIN" while
  typing, wrong-PIN alert with icon, lockout "Try again in m:ss" with the
  §7.3 body, a muted mark, the keypad at 32% (once, no stacked dim), and
  "Use Face ID or passcode" kept enabled. "Use device passcode" / "Use screen
  lock" sits below the keypad. The biometric prompt still fires once on
  appear. During a PIN check the keypad ignores presses without dimming.
- **Privacy cover**: `SecurityOverlay` already used the solid `PrivacyCover`;
  the setting is now called "Privacy cover" in Settings. Tests cover it on
  `inactive` and with the setting off.
- **J2 Library** (`app/(tabs)/index.tsx`, logic in
  `src/features/documents/library.ts`): Home and Documents are one tab;
  `app/(tabs)/documents.tsx` and `CategoryChips` are gone. Tabs are Library ·
  Scan · Settings on the step 1 `TabBar` (solid fallback). Sections: search,
  "N documents, encrypted on this device", Expiring soon rail (90 days),
  Recent (5 by `updated_at`), Collections (zero-count hidden). List mode
  covers search, a collection tile, and "See all": collection chips, the count
  line ("3 results in Legal"), a sort button, rows with a page-text match
  highlighted, and the no-matches state with "Search all collections". The
  Sort and filter sheet offers the four sorts, collections, and "Only with an
  expiry date", applied live, with Reset and "Show N documents".
  Multi-select (Select or long-press) has Select all, "N selected", Done, and
  a bar with Move to… and Delete N only; the tab bar hides meanwhile. The
  fail-closed index error and `VAULT_EMPTIED` handling stay. Collections are
  the 7 fixed categories plus free tags; no schema change.
- **J3 Viewer** (`app/documents/[id].tsx`, `src/features/viewer/PageStage.tsx`):
  the stage is `viewerStage` in both themes with glass Back, Share a copy and
  More, title and "Page n of N", tap to hide the chrome, the page strip as
  tabs, and a Details pill. Details sheet: title, collection and brass expiry
  chips, Edit, "Found on this device" (masked number with Show, re-masked when
  the app leaves), tags, Copy text, Share a copy…, Delete, and the footer
  line. No text: the info callout and Read again. Edit is inline in the sheet
  with the "Give the document a title." field error. Missing and unreadable
  states use the binding copy and "Go to Library". The share function, its
  lock gate and `DocumentImage` (memory-only cache) are unchanged.
- **J7 Delete** (`src/features/documents/useDeleteWithUndo.ts`): no confirm,
  "“title” deleted" or "N documents deleted" with Undo and the countdown
  ring, "“title” is back" after Undo, and "Couldn't delete “title”. It's
  still in your vault." when it fails. From the viewer and from multi-select.
- **J8 Change PIN**: Cancel and "Step n of 3", the three titles, "Your
  documents aren't touched…", the same-PIN and mismatch copy, toast "PIN
  changed". During a running lockout the current-PIN step shows the lock
  screen's countdown and disables the keypad.
- **Settings**: Security (Auto-lock ›, Privacy cover, Confirm before sharing,
  Change PIN, Lock now), the unchanged Backup rows, Appearance, Suggestions
  ("Text patterns read on this device. No on-device model is used yet."),
  About (protection info row, Source code, version from the app config),
  Danger zone. Delete everything opens a sheet first; its button opens the
  existing native destructive alert. "Test authentication" was already gone
  on this branch; no security jargon is left.
- **Auto-lock page** (`app/settings/auto-lock.tsx`): radio list, the footer,
  and the brass note for Never. It is declared inside the unlocked
  `Stack.Protected` group in `app/_layout.tsx`; no guard or route structure
  changed. A test opens it by URL while locked and lands on the lock screen.

## Step 1 review Lows (separate commits)

Keypad dimming, 44 pt targets for the segmented control and search clear
button, switch rows as one accessible switch (only the switch itself toggles
on touch; the handover does not ask for row-tap toggling), the splash staying
up until the stored appearance is applied, the plan's StrongBox and blur
claims, and tests for the privacy cover and the lock keypad.

## Deviation from handover §3.1 (owner decision)

Light-mode `accent`/`warning` is `#8F5E07` (was `#9A6608`) and light-mode
`success` is `#14774A` (was `#17804F`), so chip text clears AA on
`accentMuted` (4.92:1) and `successMuted` (4.81:1). This was the owner's
decision. Dark mode is unchanged. Both new colours also pass on `surface`,
`background` and `surfaceMuted`, and white glyphs on their tiles pass too;
`theme.test.ts` checks it.

## Deferred, and why

- **Face ID switch** in Settings and the biometrics-unavailable rows: there is
  no setting to turn biometric unlock off, and adding one changes security
  behaviour and settings data. Needs F13 too.
- **Wrong current PIN counting towards the lockout** (J8): it needs a change
  in `SessionProvider.changePin`, which is security behaviour. The current PIN
  is still checked once, with the change, so step 1 adds no PIN oracle. The
  copy says "Wrong PIN. Nothing was changed." instead of the attempts count,
  which would not be true.
- **F8 deferred delete**: delete still uses the service's undo window, which
  keeps decrypted copies in the cache for 8 s (swept on lock). The toast runs
  for the existing 5 s `UNDO_TOAST_MS`, not 8 s. Finalising on background or
  export start, and "nothing decrypted kept", need F8. Row swipe to delete is
  not built.
- **J5 share flow** (warning sheet, preparing sheet, interrupted banner): step
  8, after F7. Share still goes straight to the existing gated share.
- **Backup hub (J6)**, the "Data" group and its single Backup row: after G6, in
  the same commit that moves the restore entry.
- **Protection page**: T4. **Create a backup first**: T8. **Vault
  unavailable**: SV-G1.
- **FTS5 `snippet()` (F11)**: matches are found in the loaded page text in JS,
  so title and tag matches get no snippet. **Page counts** in row meta need a
  list query change; rows show "Collection · PDF · date".
- **Zoom chip** in the viewer, the Library highlight after Undo, the large
  title collapsing on scroll, and Liquid Glass (F16) for the tab bar and
  sheets.
- **String table and RTL pass (F17)**: copy is still inline. Titles and file
  names are isolated with FSI/PDI; layouts use start/end.
- "Import from Files or Photos" opens the same Add sheet as Scan, until J1.

## Checks

- `npm run validate`: exit 0 (prettier, expo lint, tsc, jest 60 suites / 393
  tests, expo-doctor 20/20).
- iOS and Android native runs: **not run**; the native milestone QA is next.
- Physical devices: not run.
