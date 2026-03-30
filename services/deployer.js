/**
 * Demo Site Deployer — deploys generated websites as static sites
 *
 * Downloads external images locally to avoid hotlink protection issues,
 * then serves demos from the Express static file server.
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMOS_DIR = join(__dirname, '..', 'demos');

/**
 * Deploy a demo website — downloads images locally to avoid hotlinking issues
 * @param {string} slug - URL-safe company name
 * @param {object} files - {html, css, js} content strings
 * @returns {Promise<{success: boolean, demoUrl?: string, error?: string}>}
 */
export async function deployDemo(slug, files) {
  console.log(`[deployer] Deploying demo for: ${slug}`);

  try {
    if (!existsSync(DEMOS_DIR)) {
      mkdirSync(DEMOS_DIR, { recursive: true });
    }

    const demoDir = join(DEMOS_DIR, slug);
    if (!existsSync(demoDir)) {
      mkdirSync(demoDir, { recursive: true });
    }

    // Create images subdirectory
    const imagesDir = join(demoDir, 'images');
    if (!existsSync(imagesDir)) {
      mkdirSync(imagesDir, { recursive: true });
    }

    // Download external images and rewrite HTML references
    let html = files.html;
    html = await downloadAndRewriteImages(html, imagesDir);

    writeFileSync(join(demoDir, 'index.html'), html, 'utf-8');
    if (files.css) writeFileSync(join(demoDir, 'style.css'), files.css, 'utf-8');
    if (files.js) writeFileSync(join(demoDir, 'script.js'), files.js, 'utf-8');

    console.log(`[deployer] Files written to ${demoDir}`);

    const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const demoUrl = `${baseUrl}/demo/${slug}`;

    console.log(`[deployer] Demo deployed at: ${demoUrl}`);
    return { success: true, demoUrl };
  } catch (err) {
    console.error(`[deployer] Deploy failed:`, err);
    return { success: false, error: `Deploy failed: ${err.message}` };
  }
}

/**
 * Find all external image URLs in HTML, download them, and rewrite src to local paths
 */
async function downloadAndRewriteImages(html, imagesDir) {
  // Match src="https://..." in img tags — both extension-based and CDN-hosted images
  const imgRegex = /(?:src|srcset)=["'](https?:\/\/[^"'\s]+?)["']/gi;
  const allMatches = [...html.matchAll(imgRegex)];
  // Filter to likely images: has image extension OR is from known image CDN
  const matches = allMatches.filter(m => {
    const url = m[1];
    const hasExt = /\.(png|jpg|jpeg|gif|webp|svg|avif)/i.test(url);
    const isCDN = /googleusercontent\.com|cloudinary\.com|imgur\.com|unsplash\.com|wp-content\/uploads/i.test(url);
    // Exclude scripts, stylesheets, etc.
    const isNotImage = /\.(js|css|woff|woff2|ttf|eot|json|xml)(\?|$)/i.test(url);
    return (hasExt || isCDN) && !isNotImage;
  });

  if (matches.length === 0) {
    console.log('[deployer] No external images to download');
    return html;
  }

  // Deduplicate URLs
  const uniqueUrls = [...new Set(matches.map(m => m[1]))];
  console.log(`[deployer] Downloading ${uniqueUrls.length} external images...`);

  const urlMap = new Map(); // original URL -> local filename
  let downloaded = 0;
  let failed = 0;

  // Download images concurrently (max 5 at a time)
  const chunks = [];
  for (let i = 0; i < uniqueUrls.length; i += 5) {
    chunks.push(uniqueUrls.slice(i, i + 5));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (url) => {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'image/*,*/*',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(10000)
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length < 100) {
            throw new Error('Response too small');
          }

          // Generate a short, unique filename from the URL
          const hash = createHash('md5').update(url).digest('hex').substring(0, 10);
          const ext = getImageExtension(url, response.headers.get('content-type'));
          const filename = `${hash}${ext}`;

          writeFileSync(join(imagesDir, filename), buffer);
          urlMap.set(url, `images/${filename}`);
          downloaded++;
        } catch (err) {
          failed++;
          // Keep original URL as fallback
        }
      })
    );
  }

  console.log(`[deployer] Images: ${downloaded} downloaded, ${failed} failed (kept original URLs)`);

  // Rewrite HTML — replace external URLs with local paths
  let rewrittenHtml = html;
  for (const [originalUrl, localPath] of urlMap) {
    // Escape special regex characters in URL
    const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    rewrittenHtml = rewrittenHtml.replace(new RegExp(escaped, 'g'), localPath);
  }

  return rewrittenHtml;
}

/**
 * Determine file extension from URL or content-type
 */
function getImageExtension(url, contentType) {
  // Try URL first
  const urlExt = extname(new URL(url).pathname).split('?')[0].toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif'].includes(urlExt)) {
    return urlExt;
  }

  // Fall back to content-type
  const ctMap = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/avif': '.avif'
  };
  return ctMap[contentType] || '.jpg';
}

/**
 * Generate a URL-safe slug from a company name or URL
 */
export function generateSlug(input) {
  try {
    const url = new URL(input);
    input = url.hostname.replace('www.', '');
  } catch {
    // Not a URL, use as-is
  }

  return input
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}

/**
 * Check if a demo exists
 */
export function demoExists(slug) {
  return existsSync(join(DEMOS_DIR, slug, 'index.html'));
}

/**
 * Get demo file path
 */
export function getDemoDir(slug) {
  return join(DEMOS_DIR, slug);
}
