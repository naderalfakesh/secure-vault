#!/usr/bin/env node
/**
 * Renders every app icon and splash image from the sealed folio drawing in
 * `src/brand/folio.ts` (Node strips its types). Run `npm run assets:icons`
 * after changing the drawing; the PNGs in `assets/` are committed.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

import { adaptive, iconBody, markBody, scaled, svg } from '../../src/brand/folio.ts';

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets');

/** The splash image draws the mark at this share of its width (app.json `imageWidth`). */
const SPLASH_MARK_SHARE = 0.92;

function render(name, body, size = 1024) {
  const png = new Resvg(svg(body), {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  })
    .render()
    .asPng();
  writeFileSync(join(assets, name), png);
  process.stdout.write(`${name} ${size}px\n`);
}

render('icon.png', iconBody('light'));
render('icon-dark.png', iconBody('dark'));
render('icon-tinted.png', iconBody('tinted'));

// Android adaptive icon: the art sits in the 66 dp safe zone of 108 dp.
render('adaptive-icon.png', scaled(adaptive.foreground(), 0.8));
render('adaptive-icon-background.png', adaptive.background());
render('adaptive-icon-monochrome.png', scaled(adaptive.monochrome(), 0.8));

// Splash: app.json draws the image 150 wide, so the mark is 138. Android 12+
// crops its 288 dp splash canvas to a 192 dp circle, and a 138 dp tile with
// these corners fits inside it.
render('splash-icon.png', scaled(markBody('light'), SPLASH_MARK_SHARE), 864);
render('splash-icon-dark.png', scaled(markBody('dark'), SPLASH_MARK_SHARE), 864);

render('favicon.png', markBody('light'), 48);
