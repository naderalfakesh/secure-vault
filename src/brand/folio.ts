/**
 * The SecureVault mark, the sealed folio: a sheet of paper closed with a brass
 * seal. One drawing feeds the app icons and splash images
 * (`scripts/brand/make-icons.mjs`, which Node runs straight from this file)
 * and the mark the app draws itself, so the splash handoff matches the native
 * splash pixel for pixel. Everything is SVG markup on a 1024 canvas.
 *
 * Plain functions and string literals only: Node strips the types, so this
 * file must not import anything.
 */

export type FolioScheme = 'light' | 'dark';

type Tile = { top: string; bottom: string; glow: number };

// The app's own palette (src/theme/colors.ts): indigo for trust, brass for the seal.
const tiles: Record<FolioScheme, Tile> = {
  light: { top: '#4361E6', bottom: '#18206A', glow: 0.16 },
  dark: { top: '#1C2346', bottom: '#090C18', glow: 0.06 },
};

/** The seal's brass, shared with the onboarding illustrations. */
export const brass = { light: '#F3C463', dark: '#B07A1E', ink: '#5A3A06', shine: '#FFF2CF' };

/** The seal in grayscale, for the tinted iOS icon. */
const steel = { light: '#D6D6D6', dark: '#8C8C8C', ink: '#2E2E2E', shine: '#F5F5F5' };

/** The passport-cover indigo of the illustrations, the icon tile's middle tone. */
export const booklet = '#2B3FA8';

type Paper = { paper: string; back: string; fold: string; lines: [string, string] };

const papers: Record<FolioScheme | 'tinted', Paper> = {
  light: { paper: '#FBFAF6', back: '#B9C5F5', fold: '#D9DCE8', lines: ['#C4CADB', '#DDE1EC'] },
  dark: { paper: '#E7E9F2', back: '#5B6CC0', fold: '#C3C7D8', lines: ['#AEB5CC', '#C8CDDD'] },
  tinted: { paper: '#F2F2F2', back: '#7A7A7A', fold: '#C8C8C8', lines: ['#A8A8A8', '#C4C4C4'] },
};

const sheet = { x: 296, y: 232, w: 400, h: 520, fold: 112, r: 44 };
const seal = { cx: 650, cy: 694, r: 132 };

/** The front sheet with its folded corner. */
function sheetPath(): string {
  const { x, y, w, h, fold, r } = sheet;
  return [
    `M${x + r} ${y}`,
    `H${x + w - fold}`,
    `L${x + w} ${y + fold}`,
    `V${y + h - r}`,
    `Q${x + w} ${y + h} ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `Q${x} ${y + h} ${x} ${y + h - r}`,
    `V${y + r}`,
    `Q${x} ${y} ${x + r} ${y}`,
    'Z',
  ].join(' ');
}

function keyhole(fill: string): string {
  const { cx, cy } = seal;
  return (
    `<circle cx="${cx}" cy="${cy - 26}" r="32" fill="${fill}"/>` +
    `<path d="M${cx - 18} ${cy - 4} H${cx + 18} L${cx + 30} ${cy + 64} Q${cx + 32} ${cy + 74} ${cx + 22} ${cy + 74} H${cx - 22} Q${cx - 32} ${cy + 74} ${cx - 30} ${cy + 64} Z" fill="${fill}"/>`
  );
}

/**
 * The folio itself. `shadow` adds soft drop shadows; the app's own mark and
 * the splash images leave them out, as react-native-svg draws no filters.
 */
function folio(tone: Paper, shadow: boolean, metal: typeof brass = brass): string {
  const { x, y } = sheet;
  const drop = shadow ? ' filter="url(#drop)"' : '';
  const filter = shadow
    ? '<filter id="drop" x="-30%" y="-30%" width="160%" height="160%">' +
      '<feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#0A0F2E" flood-opacity="0.35"/>' +
      '</filter>'
    : '';
  return (
    '<defs>' +
    '<linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">' +
    `<stop offset="0" stop-color="${metal.light}"/><stop offset="1" stop-color="${metal.dark}"/>` +
    '</linearGradient>' +
    filter +
    '</defs>' +
    `<g${drop}><path d="${sheetPath()}" fill="${tone.back}" transform="rotate(-9 ${x + 200} ${y + 260}) translate(-34 -6)"/></g>` +
    `<g${drop}><path d="${sheetPath()}" fill="${tone.paper}"/></g>` +
    `<path d="M${x + 288} ${y} V${y + 72} Q${x + 288} ${y + 112} ${x + 328} ${y + 112} H${x + 400} Z" fill="${tone.fold}"/>` +
    `<rect x="${x + 52}" y="${y + 150}" width="190" height="28" rx="14" fill="${tone.lines[0]}"/>` +
    `<rect x="${x + 52}" y="${y + 214}" width="296" height="28" rx="14" fill="${tone.lines[1]}"/>` +
    `<rect x="${x + 52}" y="${y + 278}" width="150" height="28" rx="14" fill="${tone.lines[1]}"/>` +
    `<g${drop}><circle cx="${seal.cx}" cy="${seal.cy}" r="${seal.r}" fill="url(#brass)"/></g>` +
    `<circle cx="${seal.cx}" cy="${seal.cy}" r="${seal.r - 26}" fill="none" stroke="${metal.dark}" stroke-width="10" opacity="0.55"/>` +
    `<path d="M${seal.cx - 92} ${seal.cy - 62} A ${seal.r - 20} ${seal.r - 20} 0 0 1 ${seal.cx + 40} ${seal.cy - 108}" fill="none" stroke="${metal.shine}" stroke-width="12" stroke-linecap="round" opacity="0.7"/>` +
    keyhole(metal.ink)
  );
}

/** The indigo (or night) background, square or with the mark's round corners. */
function tile({ top, bottom, glow }: Tile, rounded: boolean): string {
  const corner = rounded ? ' rx="230"' : '';
  return (
    '<defs>' +
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>` +
    '<radialGradient id="glow" cx="0.3" cy="0.12" r="0.75">' +
    `<stop offset="0" stop-color="#FFFFFF" stop-opacity="${glow}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>` +
    '</radialGradient>' +
    '</defs>' +
    `<rect width="1024" height="1024"${corner} fill="url(#bg)"/>` +
    `<rect width="1024" height="1024"${corner} fill="url(#glow)"/>`
  );
}

/** Scales a drawing about the centre, for safe zones and padding. */
export function scaled(body: string, scale: number): string {
  const offset = (1024 * (1 - scale)) / 2;
  return `<g transform="translate(${offset} ${offset}) scale(${scale})">${body}</g>`;
}

export function svg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;
}

/** iOS icons: opaque squares, the system rounds the corners. */
export function iconBody(variant: FolioScheme | 'tinted'): string {
  if (variant === 'tinted') {
    // Grayscale on black; iOS colours it with the user's tint.
    return `<rect width="1024" height="1024" fill="black"/>${folio(papers.tinted, false, steel)}`;
  }
  return tile(tiles[variant], false) + folio(papers[variant], true);
}

/** Android's adaptive icon layers. */
export const adaptive = {
  foreground: (): string => folio(papers.light, true),
  background: (): string => tile(tiles.light, false),
  /** One shape for the themed icon: the sheet, with the seal set apart by a gap. */
  monochrome: (): string =>
    '<defs><mask id="cut">' +
    '<rect width="1024" height="1024" fill="black"/>' +
    `<path d="${sheetPath()}" fill="white"/>` +
    `<path d="M${sheet.x + 288} ${sheet.y - 2} V${sheet.y + 72} Q${sheet.x + 288} ${sheet.y + 112} ${sheet.x + 328} ${sheet.y + 112} H${sheet.x + 404}" fill="none" stroke="black" stroke-width="22"/>` +
    `<circle cx="${seal.cx}" cy="${seal.cy}" r="${seal.r + 22}" fill="black"/>` +
    `<circle cx="${seal.cx}" cy="${seal.cy}" r="${seal.r}" fill="white"/>` +
    keyhole('black') +
    '</mask></defs>' +
    '<rect width="1024" height="1024" fill="white" mask="url(#cut)"/>',
};

/** The mark: the rounded tile filling the canvas, without shadows. */
export function markBody(scheme: FolioScheme): string {
  return tile(tiles[scheme], true) + folio(papers[scheme], false);
}

/** The mark as a complete SVG document, for react-native-svg's `SvgXml`. */
export function markSvg(scheme: FolioScheme): string {
  return svg(markBody(scheme));
}
