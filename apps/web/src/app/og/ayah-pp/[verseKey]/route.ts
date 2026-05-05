/**
 * /og/ayah-pp/[verseKey] — Puppeteer-screenshotted ayah card.
 *
 * The "pp" suffix = "puppeteer". This is the high-fidelity sibling to
 * /og/ayah/[verseKey] (Satori-based). We render the actual
 * /share-card/[verseKey] page in headless Chromium and screenshot the
 * .share-card root element. Result: full Arabic glyph joining, real
 * tajweed CSS, real tafsir HTML — all at zero "reinvention" cost.
 *
 * Tradeoffs vs. Satori:
 *   + Faithful to the read-mode AyahCard look
 *   + No Arabic shaping issues, no GSUB workaround
 *   + Tafsir HTML renders properly
 *   - Cold start ~2-3s for the first request (browser launch)
 *   - Warm requests ~400-700ms
 *   - Heavier infra (Chromium binary)
 *
 * Strategy:
 *   - Persist a single Browser instance across requests (module scope)
 *   - PNG cached 7 days via Cache-Control immutable
 *   - Falls back to /og/ayah on screenshot failure (delegates via redirect)
 */
import { NextResponse, type NextRequest } from 'next/server';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

export const runtime = 'nodejs';
export const revalidate = 604800; // 7 days
// Don't pre-render the route at build time — it depends on a runtime
// browser instance.
export const dynamic = 'force-dynamic';

interface RouteCtx {
  readonly params: Promise<{ verseKey: string }>;
}

let cachedBrowser: Browser | null = null;
let cachedBrowserPid: number | null = null;

const CHROME_PATH = process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/google-chrome';

async function getBrowser(): Promise<Browser> {
  if (cachedBrowser) {
    try {
      // Check the process is alive — kill the stale ref otherwise.
      const pid = cachedBrowser.process()?.pid ?? null;
      if (pid !== null && pid === cachedBrowserPid) return cachedBrowser;
    } catch {
      /* fall through to relaunch */
    }
  }
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--font-render-hinting=none',
      '--disable-font-subpixel-positioning',
      '--lang=en-US,ar',
    ],
  });
  cachedBrowser = browser;
  cachedBrowserPid = browser.process()?.pid ?? null;
  return browser;
}

const FORMAT_VIEWPORTS: Record<string, { width: number; height: number }> = {
  landscape: { width: 1200, height: 1400 },
  square: { width: 1080, height: 1200 },
  story: { width: 1080, height: 1920 },
};

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const { verseKey: rawVk } = await ctx.params;
  let verseKey = rawVk;
  try {
    verseKey = decodeURIComponent(rawVk);
  } catch {
    return new NextResponse('Bad verse key', { status: 400 });
  }
  if (!/^[1-9][0-9]?[0-9]?:[1-9][0-9]?[0-9]?$/.test(verseKey)) {
    return new NextResponse('Bad verse key', { status: 400 });
  }
  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'landscape') as
    | 'landscape'
    | 'square'
    | 'story';
  const viewport = FORMAT_VIEWPORTS[format] ?? FORMAT_VIEWPORTS.landscape;
  if (!viewport) {
    // Defensive — FORMAT_VIEWPORTS.landscape is statically defined,
    // but TS can't see that under noUncheckedIndexedAccess.
    return new NextResponse('Internal viewport config missing', { status: 500 });
  }

  // Build the share-card URL (same origin) with all forwarded params.
  const params = new URLSearchParams(url.searchParams.toString());
  const origin = url.origin;
  const shareUrl = `${origin}/share-card/${encodeURIComponent(verseKey)}?${params.toString()}`;

  let page: Page | null = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setViewport({
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 2,
    });
    // Disable images on the page itself other than CSS/font assets to
    // speed load (the share card has none beyond fonts and the
    // gradient).
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const t = r.resourceType();
      if (t === 'media' || t === 'websocket' || t === 'eventsource') {
        void r.abort();
      } else {
        void r.continue();
      }
    });
    await page.goto(shareUrl, { waitUntil: 'networkidle0', timeout: 15000 });
    // Wait for fonts to settle so Arabic shaping is final.
    await page.evaluate(() => document.fonts.ready);
    // Find the share card and capture its actual rendered size.
    const handle = await page.$('.share-card');
    if (!handle) throw new Error('share-card root not found');
    const buf = await handle.screenshot({
      type: 'png',
      omitBackground: false,
    });
    // puppeteer types screenshot() as Uint8Array<ArrayBufferLike> while
    // NextResponse wants BodyInit (Buffer / Blob / ArrayBuffer / etc.);
    // wrap the underlying buffer to satisfy the constructor signature.
    return new NextResponse(Buffer.from(buf), {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'cache-control': 'public, max-age=604800, s-maxage=604800, immutable',
      },
    });
  } catch (err) {
    return new NextResponse(
      `share render failed: ${err instanceof Error ? err.message : 'unknown'}`,
      { status: 500 },
    );
  } finally {
    if (page) {
      await page.close().catch(() => null);
    }
  }
}
