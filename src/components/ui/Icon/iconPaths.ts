/**
 * Outline glyphs on a 24 pt grid, drawn with a 1.75 stroke, round caps and
 * round joins. The design's set is copied exactly from the
 * design source (`Main.dc.html`, `renderVals().i`); the few extra glyphs the
 * app needs (marked below) are drawn on the same grid in the same style.
 */
export const iconPaths = {
  mark: 'M7 3h7l5 5v4M19 16v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M14 3v5h5M10.5 14.5a1.5 1.5 0 1 1 3 0v1.5h-3zM9.5 16h5v3.5h-5z',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4',
  faceid:
    'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 16c1.7 1.3 4.3 1.3 6 0',
  search: 'M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14zM20 20l-4-4',
  scan: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10',
  plus: 'M12 5v14M5 12h14',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
  library: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 5v4M10 15v4',
  share: 'M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3',
  chevR: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  shield: 'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6zM9 12l2 2 4-4',
  archive: 'M3 5h18v4H3zM5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4',
  key: 'M15 4a5 5 0 1 1-4.6 7L4 17.4V20h2.6v-2h2v-2h2l1.4-1.4A5 5 0 0 1 15 4zM16 8h.01',
  check: 'M5 12l5 5L20 7',
  checkCircle: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM8 12l3 3 5-6',
  alert: 'M12 3l9.5 17h-19zM12 10v4M12 17h.01',
  info: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 11v5M12 8h.01',
  x: 'M6 6l12 12M18 6L6 18',
  backspace: 'M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7zM12 9l6 6M18 9l-6 6',
  sort: 'M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  calendar:
    'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 10h16M8 3v4M16 3v4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  idcard:
    'M3 6h18v12H3zM8 9.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3zM5.5 15.5c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8M13 10h5M13 14h4',
  medical: 'M9 4h6v5h5v6h-5v5H9v-5H4V9h5z',
  finance: 'M3 7h18v10H3zM12 10a2 2 0 1 1 0 4a2 2 0 0 1 0-4zM6 10v.01M18 14v.01',
  legal: 'M12 4v16M8 20h8M5 8h14M5 8l-2.5 6a2.5 2.5 0 0 0 5 0zM19 8l-2.5 6a2.5 2.5 0 0 0 5 0z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3',
  folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  camera:
    'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 10a3.5 3.5 0 1 1 0 7a3.5 3.5 0 0 1 0-7z',
  eye: 'M3 12c.5-1.5 4-6 9-6s8.5 4.5 9 6c-.5 1.5-4 6-9 6s-8.5-4.5-9-6zM12 9a3 3 0 1 1 0 6a3 3 0 0 1 0-6z',
  eyeOff:
    'M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9 6-.3.9-1.2 2.4-2.6 3.7M6.6 7.6C4.6 8.9 3.4 10.8 3 12c.5 1.5 4 6 9 6 1.5 0 2.8-.4 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  clock: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18zM12 7v5l3 2',
  refresh: 'M20 11a8 8 0 0 0-14.7-4M4 4v4h4M4 13a8 8 0 0 0 14.7 4M20 20v-4h-4',
  pages:
    'M8 3h9a2 2 0 0 1 2 2v12M5 7h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
  tag: 'M3 12V4h8l9 9-8 8zM7.5 7.5h.01',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  exportI: 'M12 3v12M8 11l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  restore: 'M12 21V9M8 13l4-4 4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2',
  image: 'M4 4h16v16H4zM4 16l5-5 4 4 2-2 5 5M15 8.5a1.5 1.5 0 1 1 0 .01',

  // Not in the design's set; drawn on the same grid for the app's extra uses.
  /** The lock with its shackle swung open. */
  unlock:
    'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 7.75-1.4',
  fingerprint:
    'M5 10a7 7 0 0 1 13.5-2.6M19 12c0 3-.5 5.5-1.5 7.5M8.5 19.5c.9-2 1.5-4.5 1.5-7.5a2 2 0 0 1 4 0c0 3.5-.6 6.5-1.8 9M5.5 16.5c.9-1.4 1.5-2.9 1.5-4.5a5 5 0 0 1 10 0c0 1.6-.1 3.1-.4 4.5',
  /** Photo library: two stacked frames. */
  photos:
    'M8 3h12a1 1 0 0 1 1 1v12M4 7h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM3 17l4-4 3 3 2-2 5 5',
  text: 'M4 6h16M4 10h12M4 14h16M4 18h10',
  sparkles:
    'M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  umbrella: 'M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9zM12 12v6a2 2 0 0 0 4 0',
  tray: 'M3 13h5l1 3h6l1-3h5M6 5h12l3 8v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6z',
} as const;

export type IconPath = keyof typeof iconPaths;
