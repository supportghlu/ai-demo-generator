/**
 * Website Scraper — extracts content, structure, styles, and images from a URL
 *
 * Uses Puppeteer for JS-rendered content and screenshots.
 * Falls back to fetch + regex if Puppeteer fails.
 */

import puppeteer from 'puppeteer';

// Singleton browser instance for memory efficiency
let browser = null;

async function getBrowser() {
  if (browser && browser.connected) return browser;

  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--no-first-run'
    ]
  };

  // Use system Chromium if configured (e.g., on Railway)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  browser = await puppeteer.launch(launchOptions);
  return browser;
}

// Graceful shutdown
process.on('SIGTERM', async () => { if (browser) await browser.close().catch(() => {}); });
process.on('SIGINT', async () => { if (browser) await browser.close().catch(() => {}); });

/**
 * Scrape a website and return structured content
 * @param {string} url - The URL to scrape
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function scrapeWebsite(url) {
  console.log(`[scraper] Scraping ${url}...`);

  // Try Puppeteer first, fall back to fetch
  try {
    return await scrapeWithPuppeteer(url);
  } catch (err) {
    console.warn(`[scraper] Puppeteer failed (${err.message}), falling back to fetch...`);
    return await scrapeWithFetch(url);
  }
}

/**
 * Puppeteer-based scraping — renders JS, captures screenshot, extracts computed styles
 */
async function scrapeWithPuppeteer(url) {
  const browserInstance = await getBrowser();
  const page = await browserInstance.newPage();

  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

    // Get rendered HTML
    const html = await page.content();
    const baseUrl = new URL(url);

    // Capture viewport screenshot as base64 JPEG
    const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 80 });
    const screenshot = Buffer.from(screenshotBuffer).toString('base64');
    console.log(`[scraper] Screenshot captured: ${Math.round(screenshotBuffer.length / 1024)}KB`);

    // Extract computed styles and additional data from the rendered DOM
    const domData = await page.evaluate(() => {
      const getStyle = (el) => {
        if (!el) return null;
        const s = window.getComputedStyle(el);
        return {
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          color: s.color,
          backgroundColor: s.backgroundColor
        };
      };

      // Computed styles from key elements
      const body = document.body;
      const h1 = document.querySelector('h1');
      const nav = document.querySelector('nav');
      const primaryBtn = document.querySelector('button, .btn, [class*="button"], a[class*="btn"]');

      const computedStyles = {
        body: getStyle(body),
        h1: getStyle(h1),
        nav: getStyle(nav),
        primaryButton: getStyle(primaryBtn)
      };

      // Extract unique font families from all elements
      const fontFamilies = new Set();
      const colorValues = new Set();
      const bgColors = new Set();
      const allElements = document.querySelectorAll('h1, h2, h3, h4, p, a, button, nav, span, li');
      allElements.forEach(el => {
        const s = window.getComputedStyle(el);
        if (s.fontFamily) fontFamilies.add(s.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
        if (s.color && s.color !== 'rgb(0, 0, 0)') colorValues.add(s.color);
        if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'rgb(255, 255, 255)') {
          bgColors.add(s.backgroundColor);
        }
      });

      // Footer content
      const footer = document.querySelector('footer');
      const footerContent = footer ? footer.innerText.substring(0, 1000) : '';

      // CTA buttons
      const ctaButtons = [];
      document.querySelectorAll('button, a[class*="btn"], a[class*="cta"], a[class*="button"], [class*="cta"]').forEach(el => {
        const text = el.innerText?.trim();
        if (text && text.length > 1 && text.length < 80) ctaButtons.push(text);
      });

      return {
        computedStyles,
        fontFamilies: [...fontFamilies].slice(0, 10),
        colorValues: [...colorValues].slice(0, 20),
        bgColors: [...bgColors].slice(0, 10),
        footerContent,
        ctaButtons: [...new Set(ctaButtons)].slice(0, 15)
      };
    });

    // Extract structured data from the rendered HTML
    const data = {
      url,
      baseUrl: baseUrl.origin,
      title: extractTitle(html),
      metaDescription: extractMeta(html, 'description'),
      favicon: extractFavicon(html, baseUrl),
      headings: extractHeadings(html),
      navigation: extractNavigation(html),
      sections: extractSections(html),
      images: extractImages(html, baseUrl),
      links: extractLinks(html, baseUrl),
      colors: extractColors(html),
      fonts: extractFonts(html),
      scripts: extractExternalScripts(html),
      bodyClasses: extractBodyClasses(html),
      fullHtml: html.length > 200000 ? html.substring(0, 200000) : html,
      htmlLength: html.length,
      // New Puppeteer-enhanced fields
      screenshot,
      computedStyles: domData.computedStyles,
      computedFonts: domData.fontFamilies,
      computedColors: domData.colorValues,
      computedBgColors: domData.bgColors,
      footerContent: domData.footerContent,
      ctaButtons: domData.ctaButtons
    };

    console.log(`[scraper] Puppeteer scraped ${url}: ${data.headings.length} headings, ${data.images.length} images, ${data.sections.length} sections, screenshot: yes`);
    return { success: true, data };
  } finally {
    await page.close();
  }
}

/**
 * Fetch-based scraping — fallback when Puppeteer is unavailable
 */
async function scrapeWithFetch(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const html = await response.text();
    const baseUrl = new URL(url);

    const data = {
      url,
      baseUrl: baseUrl.origin,
      title: extractTitle(html),
      metaDescription: extractMeta(html, 'description'),
      favicon: extractFavicon(html, baseUrl),
      headings: extractHeadings(html),
      navigation: extractNavigation(html),
      sections: extractSections(html),
      images: extractImages(html, baseUrl),
      links: extractLinks(html, baseUrl),
      colors: extractColors(html),
      fonts: extractFonts(html),
      scripts: extractExternalScripts(html),
      bodyClasses: extractBodyClasses(html),
      fullHtml: html.length > 200000 ? html.substring(0, 200000) : html,
      htmlLength: html.length,
      // No Puppeteer data in fallback mode
      screenshot: null,
      computedStyles: null,
      computedFonts: [],
      computedColors: [],
      computedBgColors: [],
      footerContent: '',
      ctaButtons: []
    };

    console.log(`[scraper] Fetch scraped ${url}: ${data.headings.length} headings, ${data.images.length} images, ${data.sections.length} sections, screenshot: no`);
    return { success: true, data };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Scrape timed out (30s)' };
    }
    return { success: false, error: `Scrape failed: ${err.message}` };
  }
}

// --- HTML extraction helpers (used by both Puppeteer and fetch paths) ---

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractMeta(html, name) {
  const regex = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  const regex2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : '';
}

function extractFavicon(html, baseUrl) {
  const match = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']*)["']/i);
  if (match) return resolveUrl(match[1], baseUrl);
  return `${baseUrl.origin}/favicon.ico`;
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = stripTags(match[2]).trim();
    if (text) headings.push({ level: match[1].toLowerCase(), text });
  }
  return headings;
}

function extractNavigation(html) {
  const navItems = [];
  const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/gi);
  if (navMatch) {
    for (const nav of navMatch) {
      const linkRegex = /<a[^>]+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(nav)) !== null) {
        const text = stripTags(linkMatch[2]).trim();
        if (text && text.length < 100) navItems.push({ href: linkMatch[1], text });
      }
    }
  }
  return navItems;
}

function extractSections(html) {
  const sections = [];
  const sectionRegex = /<(?:section|div)[^>]*(?:class=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/(?:section|div)>/gi;
  let match;
  let count = 0;
  while ((match = sectionRegex.exec(html)) !== null && count < 30) {
    const content = stripTags(match[2]).trim();
    if (content.length > 50 && content.length < 5000) {
      sections.push({
        className: match[1] || '',
        textPreview: content.substring(0, 1000)
      });
      count++;
    }
  }
  return sections;
}

function extractImages(html, baseUrl) {
  const images = [];
  const regex = /<img[^>]+src=["']([^"']*)["'][^>]*(?:alt=["']([^"']*)["'])?/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const src = resolveUrl(match[1], baseUrl);
    if (src && !src.includes('data:image/svg') && !src.includes('tracking') && !src.includes('pixel')) {
      images.push({ src, alt: match[2] || '' });
    }
  }
  const bgRegex = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  let bgMatch;
  while ((bgMatch = bgRegex.exec(html)) !== null) {
    const src = resolveUrl(bgMatch[1], baseUrl);
    if (src) images.push({ src, alt: 'background' });
  }
  return images.slice(0, 50);
}

function extractLinks(html, baseUrl) {
  const links = [];
  const regex = /<a[^>]+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = stripTags(match[2]).trim();
    if (text && text.length < 100 && !match[1].startsWith('#') && !match[1].startsWith('javascript:')) {
      links.push({ href: match[1], text });
    }
  }
  return links.slice(0, 50);
}

function extractColors(html) {
  const colors = new Set();
  const colorRegex = /#(?:[0-9a-fA-F]{3,8})\b/g;
  let match;
  while ((match = colorRegex.exec(html)) !== null) colors.add(match[0].toLowerCase());
  const rgbRegex = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g;
  while ((match = rgbRegex.exec(html)) !== null) colors.add(match[0]);
  return [...colors].slice(0, 30);
}

function extractFonts(html) {
  const fonts = new Set();
  const googleMatch = html.match(/fonts\.googleapis\.com\/css[^"']+family=([^"'&]+)/gi);
  if (googleMatch) {
    for (const m of googleMatch) {
      const familyMatch = m.match(/family=([^"'&]+)/i);
      if (familyMatch) fonts.add(decodeURIComponent(familyMatch[1]).replace(/\+/g, ' '));
    }
  }
  const ffRegex = /font-family:\s*["']?([^;"']+)["']?/gi;
  let match;
  while ((match = ffRegex.exec(html)) !== null) {
    const font = match[1].split(',')[0].trim().replace(/["']/g, '');
    if (font && !['inherit', 'initial', 'unset', 'sans-serif', 'serif', 'monospace', 'cursive'].includes(font.toLowerCase())) {
      fonts.add(font);
    }
  }
  return [...fonts];
}

function extractExternalScripts(html) {
  const scripts = [];
  const regex = /<script[^>]+src=["']([^"']*)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) scripts.push(match[1]);
  return scripts;
}

function extractBodyClasses(html) {
  const match = html.match(/<body[^>]+class=["']([^"']*)["']/i);
  return match ? match[1] : '';
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveUrl(url, baseUrl) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `${baseUrl.origin}${url}`;
  return `${baseUrl.origin}/${url}`;
}
