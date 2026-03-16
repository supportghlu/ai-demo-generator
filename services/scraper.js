/**
 * Website Scraper — extracts content, structure, styles, and images from a URL
 * 
 * Produces a structured description of the website that can be fed to an AI
 * model to generate a faithful clone.
 */

/**
 * Scrape a website and return structured content
 * @param {string} url - The URL to scrape
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export async function scrapeWebsite(url) {
  console.log(`[scraper] Scraping ${url}...`);

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

    // Extract key information from the HTML
    const data = {
      url: url,
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
      fullHtml: html.length > 200000 ? html.substring(0, 200000) : html, // Cap at 200KB
      htmlLength: html.length
    };

    console.log(`[scraper] Scraped ${url}: ${data.headings.length} headings, ${data.images.length} images, ${data.sections.length} sections`);

    return { success: true, data };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Scrape timed out (30s)' };
    }
    return { success: false, error: `Scrape failed: ${err.message}` };
  }
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractMeta(html, name) {
  const regex = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  // Try reversed order (content before name)
  const regex2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : '';
}

function extractFavicon(html, baseUrl) {
  const match = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon)["'][^>]+href=["']([^"']*)["']/i);
  if (match) {
    return resolveUrl(match[1], baseUrl);
  }
  return `${baseUrl.origin}/favicon.ico`;
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = stripTags(match[2]).trim();
    if (text) {
      headings.push({ level: match[1].toLowerCase(), text });
    }
  }
  return headings;
}

function extractNavigation(html) {
  const navItems = [];
  // Look for nav elements
  const navMatch = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/gi);
  if (navMatch) {
    for (const nav of navMatch) {
      const linkRegex = /<a[^>]+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(nav)) !== null) {
        const text = stripTags(linkMatch[2]).trim();
        if (text && text.length < 100) {
          navItems.push({ href: linkMatch[1], text });
        }
      }
    }
  }
  return navItems;
}

function extractSections(html) {
  const sections = [];
  // Extract main content sections
  const sectionRegex = /<(?:section|div)[^>]*(?:class=["']([^"']*)["'])?[^>]*>([\s\S]*?)<\/(?:section|div)>/gi;
  let match;
  let count = 0;
  while ((match = sectionRegex.exec(html)) !== null && count < 30) {
    const content = stripTags(match[2]).trim();
    if (content.length > 50 && content.length < 5000) {
      sections.push({
        className: match[1] || '',
        textPreview: content.substring(0, 500)
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
      images.push({
        src,
        alt: match[2] || ''
      });
    }
  }
  // Also check for background images in style attributes
  const bgRegex = /background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  let bgMatch;
  while ((bgMatch = bgRegex.exec(html)) !== null) {
    const src = resolveUrl(bgMatch[1], baseUrl);
    if (src) {
      images.push({ src, alt: 'background' });
    }
  }
  return images.slice(0, 50); // Cap at 50 images
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
  // Extract from inline styles and style blocks
  const colorRegex = /#(?:[0-9a-fA-F]{3,8})\b/g;
  let match;
  while ((match = colorRegex.exec(html)) !== null) {
    colors.add(match[0].toLowerCase());
  }
  // Extract rgb/rgba
  const rgbRegex = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g;
  while ((match = rgbRegex.exec(html)) !== null) {
    colors.add(match[0]);
  }
  return [...colors].slice(0, 30);
}

function extractFonts(html) {
  const fonts = new Set();
  // Extract from Google Fonts links
  const googleMatch = html.match(/fonts\.googleapis\.com\/css[^"']+family=([^"'&]+)/gi);
  if (googleMatch) {
    for (const m of googleMatch) {
      const familyMatch = m.match(/family=([^"'&]+)/i);
      if (familyMatch) {
        fonts.add(decodeURIComponent(familyMatch[1]).replace(/\+/g, ' '));
      }
    }
  }
  // Extract from font-family declarations
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
  while ((match = regex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
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
