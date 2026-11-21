# ADR 0010: Code organisation

- Status: Accepted
- Date: 2026-11-18 (amended 2026-11-21: shared code, imports, tests, types)

## Context

The app grew phase by phase, and each screen grew inside its route file. The
Library route was 1,025 lines: state, effects, six local components and the
stylesheet in one file. `SessionProvider` and the two services held several
concerns each. The behaviour is tested and accessible, but a reader has to
scroll through everything to find anything, and the files do not show how
the pieces relate.

## Decision

### Routes are thin

A file under `app/` only binds a URL to a screen:

```ts
export { LibraryScreen as default } from '@/screens/library';
```

Layouts (`_layout.tsx`) keep their navigator setup, and nothing else.

### Screens live in `src/screens/<screen>/`

```
src/screens/library/
  index.ts                  public surface: the screen, nothing else
  LibraryScreen.tsx         composition: hooks in, components out
  LibraryScreen.styles.ts   the screen's own styles
  components/
    SortSheet/
      SortSheet.tsx
      SortSheet.styles.ts
      index.ts
  hooks/
    useLibrarySearch.ts     state and effects, one concern per hook
  constants.ts              tunables and fixed lists
  types.ts                  types shared inside the screen
  helpers.ts                pure functions, unit-testable without React
```

Only the parts a screen needs exist. A component used by one screen lives in
that screen's `components/`; once a second screen needs it, it moves to a
feature or to `src/components/ui`.

A screen may also keep a single-purpose module named for what it does
(`pickers.ts` for the system pickers, `detailsReducer.ts` for a reducer,
`navigation.ts`). `helpers.ts` is for pure functions only; anything that talks
to a native module or the router gets its own named file.

### Features hold domain pieces shared by screens

`src/features/<feature>/` keeps domain logic (pure helpers, copy builders,
hooks) and widgets used by more than one screen. The same folder-per-component
rule applies to its components, and hooks go in the feature's `hooks/`.

A feature may serve a single screen when it is a domain of its own with its
own vocabulary: `scan` (sources, pages, reading), `viewer` (zoom, paging,
sharing) and `backup` (the create and restore sheets). The screen then stays a
composition of the feature's pieces. A wrapper that only adapts a primitive to
one screen (`LibraryRow`, `LibraryCard`) belongs to that screen.

### Shared code has one home

- `src/utils` pure, app-wide helpers: `errorCode` (the only place that reads
  an error's `code`), `DAY_MS` and `wait`, formatting, the secure-store entry
  list.
- `src/hooks` hooks with no domain: `useMountedRef`, `useDelayed`,
  `useDeviceIntegrity`.
- `src/types` domain types and the field keys the app reads (`FIELD_KEYS`).
- Before writing a helper, look there. A second copy of a helper is a bug
  waiting for the two to drift.

### Imports

Packages first, then the `@/` (`src`) and `@modules/` (`modules`) aliases,
then relative paths, each group alphabetised; ESLint (`import/order`) enforces
it. Code outside a native module imports it by its entry point
(`@modules/expo-vault`), never by a file inside its `src/`. Code outside
`src/components` does not import `Text`, `Button`, `Switch`, the touchables or
`Alert` from `react-native` (`no-restricted-imports`); the one native alert,
the "Delete everything" confirmation, lives in
`src/features/session/eraseEverything.ts`.

### Components

- One component per file. A component with styles is a folder: `Name.tsx`,
  `Name.styles.ts`, `index.ts`, and `types.ts` or `constants.ts` when it has
  public types or tunables.
- Props types are named (`NameProps`) and exported from `index.ts` when
  other files use them.
- Styles are Unistyles `StyleSheet.create` in `*.styles.ts`, exported as
  `styles`. A `.tsx` file never calls `StyleSheet.create`.

### Size

A component file stays under 200 lines and any source file under 300.
Past that it is doing more than one thing: split out a hook, a component or
pure helpers. ESLint enforces the limits and the stylesheet rule.

### Services and providers

A service or provider is split by concern: types, constants, pure helpers
and the stateful class or hook that wires them. The public import paths
(`@/services/DocumentService`, `@/features/session/SessionProvider`) stay.

### Tests

- A unit test sits in the `__tests__/` folder beside the code it covers and
  is named after that file: `src/utils/__tests__/format.test.ts`.
- A flow test renders a route's default export inside the real providers and
  sits in `src/__tests__/`, named after the flow (`scan-flow.test.tsx`).
  These cross screens and features, so they belong to no single folder.
- Shared test helpers live in `src/testing/`; native-module doubles live
  beside their module as `*.mock.ts` and are wired in `jest.setup.js`.

### Types

`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`noImplicitReturns` and `noFallthroughCasesInSwitch` are on. App code has no
`any` and no non-null `!` (ESLint errors); an index into an array or record
is narrowed, not asserted.

## Consequences

- Route files and tests keep their import paths; tests render the route's
  default export as before.
- Pure helpers move out of components, so they get unit tests of their own.
- More files, each with one job. The folder structure tells a reader where
  to look.
