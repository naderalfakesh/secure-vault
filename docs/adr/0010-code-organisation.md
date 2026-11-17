# ADR 0010: Code organisation

- Status: Accepted
- Date: 2026-11-18

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

### Features hold domain pieces shared by screens

`src/features/<feature>/` keeps domain logic (pure helpers, copy builders,
hooks) and widgets used by more than one screen. The same folder-per-component
rule applies to its components.

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

## Consequences

- Route files and tests keep their import paths; tests render the route's
  default export as before.
- Pure helpers move out of components, so they get unit tests of their own.
- More files, each with one job. The folder structure tells a reader where
  to look.
