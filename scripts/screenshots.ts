/**
 * Fresh README screenshots of the public pages.
 *
 *   npm i --no-save playwright && npx playwright install chromium
 *   SHOT_BASE_URL=https://your-site.vercel.app npm run docs:screenshots
 *
 * SHOT_BASE_URL defaults to http://localhost:3000 (run `npm run dev` against your real
 * Supabase project first). Writes WebP files into docs/images, or into SHOT_OUT.
 * Only pages anyone can open are captured, so no sign-in is needed and no account
 * details end up in a picture. Check each image before committing: they show whatever
 * the site shows at that moment.
 *
 * sharp ships with next, so only Playwright has to be installed (with --no-save it
 * leaves package.json and the lockfile alone).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

/** The few Playwright page methods used here (Playwright is installed on demand, so it has no types in the project). */
type Page = {
  screenshot(options?: { clip?: { x: number; y: number; width: number; height: number } }): Promise<Buffer>;
  waitForTimeout(ms: number): Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getByRole(role: string, options?: { name?: RegExp | string }): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  locator(selector: string): any;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
};

const BASE = (process.env.SHOT_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OUT = path.resolve(process.env.SHOT_OUT ?? path.join(__dirname, '..', 'docs', 'images'));
const DESKTOP = { width: 1280, height: 800 };

async function main() {
  // Imported by a variable name so the project type check does not need Playwright installed.
  const moduleName = 'playwright';
  const { chromium } = await import(moduleName).catch(() => {
    throw new Error('Playwright is not installed. Run: npm i --no-save playwright && npx playwright install chromium');
  });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  const save = async (name: string, png: Buffer) => {
    await sharp(png).webp({ quality: 82 }).toFile(path.join(OUT, `${name}.webp`));
    console.log(`  ${name}.webp`);
  };

  /** Opens a page in its own context (scheme and size), waits for it to settle, runs `shoot`. */
  const shot = async (
    label: string,
    url: string,
    opts: { scheme?: 'light' | 'dark'; size?: { width: number; height: number }; wait?: number; mobile?: boolean },
    shoot: (page: Page) => Promise<void>,
  ) => {
    console.log(label);
    const context = await browser.newContext({
      viewport: opts.size ?? DESKTOP,
      colorScheme: opts.scheme ?? 'light',
      deviceScaleFactor: opts.mobile ? 2 : 1,
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();
    try {
      await page.goto(BASE + url, { waitUntil: 'load', timeout: 120_000 });
      await page.waitForTimeout(opts.wait ?? 3000);
      await shoot(page);
    } catch (error) {
      console.warn(`  skipped: ${(error as Error).message.split('\n')[0]}`);
    } finally {
      await context.close();
    }
  };

  // The landing page counts up from 0 on a first visit; give it time to finish.
  await shot('landing (light)', '/', { wait: 7000 }, async (p) => save('landing-light', await p.screenshot()));
  await shot('landing (dark)', '/', { scheme: 'dark', wait: 7000 }, async (p) => save('landing-dark', await p.screenshot()));
  await shot('landing (phone)', '/', { size: { width: 360, height: 760 }, mobile: true, wait: 7000 }, async (p) =>
    save('landing-mobile', await p.screenshot()),
  );
  await shot('coverage', '/', { wait: 6000 }, async (p) => {
    const section = p.getByRole('heading', { name: /where the records are/i }).first();
    await section.scrollIntoViewIfNeeded();
    await p.waitForTimeout(1500);
    await save('landing-coverage', await p.screenshot({ clip: { x: 0, y: 0, width: 1280, height: 800 } }));
  });
  await shot('directory', '/projects', {}, async (p) => save('directory', await p.screenshot()));
  await shot('map and dashboard', '/projects/map', { wait: 6000 }, async (p) => {
    await save('dashboard', await p.screenshot());
    const map = p.locator('.leaflet-container').first();
    await map.scrollIntoViewIfNeeded();
    await p.waitForTimeout(4000); // tiles and markers
    await save('map-dpwh', await p.screenshot());
  });
  await shot('community', '/community', {}, async (p) => save('community', await p.screenshot()));
  await shot('ask bp', '/', { wait: 7000 }, async (p) => {
    await p.getByRole('button', { name: /ask bp/i }).first().click();
    await p.waitForTimeout(1500);
    await save('ask-bp', await p.screenshot());
  });

  await browser.close();
  console.log(`Done. Pictures are in ${OUT}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
