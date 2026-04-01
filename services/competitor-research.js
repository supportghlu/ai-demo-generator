/**
 * Competitor Research Service
 * Searches Google for competitors in a given industry + location,
 * then scrapes the top results for content and screenshots.
 */

import { scrapeWebsite } from './scraper.js';

// Directories and non-business sites to filter out
const EXCLUDED_DOMAINS = [
  'yelp.com', 'yell.com', 'google.com', 'facebook.com', 'instagram.com',
  'twitter.com', 'x.com', 'linkedin.com', 'trustpilot.com', 'tripadvisor.com',
  'checkatrade.com', 'bark.com', 'amazon.com', 'ebay.com', 'wikipedia.org',
  'youtube.com', 'tiktok.com', 'pinterest.com', 'reddit.com',
  'nextdoor.com', 'freeindex.co.uk', 'thomson-local.com', 'cylex-uk.co.uk',
  'hotfrog.co.uk', 'scoot.co.uk', 'mybuilder.com', 'ratedpeople.com'
];

/**
 * Find and scrape competitor websites
 * @param {string} businessType - e.g. "plumber", "nail salon"
 * @param {string} location - e.g. "Manchester", "Denver, CO"
 * @returns {Promise<{competitors: Array, searchQuery: string}>}
 */
export async function findAndScrapeCompetitors(businessType, location) {
  const searchQuery = `best ${businessType} in ${location}`;
  console.log(`[competitor-research] Searching: "${searchQuery}"`);

  try {
    // Find competitor URLs via Google
    const urls = await searchGoogle(searchQuery);
    console.log(`[competitor-research] Found ${urls.length} candidate URLs`);

    if (urls.length === 0) {
      console.log('[competitor-research] No competitor URLs found, proceeding without competitor data');
      return { competitors: [], searchQuery };
    }

    // Scrape top 2-3 competitors
    const maxCompetitors = Math.min(urls.length, 3);
    const competitors = [];

    for (let i = 0; i < maxCompetitors; i++) {
      const url = urls[i];
      console.log(`[competitor-research] Scraping competitor ${i + 1}/${maxCompetitors}: ${url}`);

      try {
        const result = await scrapeWebsite(url);
        if (result.success) {
          competitors.push({
            url,
            title: result.data.title || url,
            scrapedData: result.data,
            screenshot: result.data.screenshot || null
          });
          console.log(`[competitor-research] ✅ Scraped: ${result.data.title || url} (${result.data.headings?.length || 0} headings, ${result.data.images?.length || 0} images)`);
        } else {
          console.log(`[competitor-research] ⚠️ Failed to scrape ${url}: ${result.error}`);
        }
      } catch (err) {
        console.log(`[competitor-research] ⚠️ Error scraping ${url}: ${err.message}`);
      }
    }

    console.log(`[competitor-research] Completed: ${competitors.length} competitors scraped`);
    return { competitors, searchQuery };
  } catch (err) {
    console.error(`[competitor-research] Search failed: ${err.message}`);
    return { competitors: [], searchQuery };
  }
}

/**
 * Search Google and extract organic result URLs
 */
async function searchGoogle(query) {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=en`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.error(`[competitor-research] Google returned ${response.status}`);
      return [];
    }

    const html = await response.text();
    return extractUrlsFromGoogle(html);
  } catch (err) {
    console.error(`[competitor-research] Google search error: ${err.message}`);
    return [];
  }
}

/**
 * Extract organic URLs from Google search results HTML
 */
function extractUrlsFromGoogle(html) {
  const urls = [];

  // Match URLs in Google result links — various patterns
  const patterns = [
    /href="\/url\?q=(https?:\/\/[^&"]+)/g,
    /data-href="(https?:\/\/[^"]+)"/g,
    /<a[^>]+href="(https?:\/\/(?!www\.google)[^"]+)"[^>]*>/g
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = decodeURIComponent(match[1]).split('&')[0];
      if (isValidCompetitorUrl(url) && !urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls.slice(0, 10); // Return top 10 candidates
}

/**
 * Check if a URL is likely a real business website (not a directory)
 */
function isValidCompetitorUrl(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return !EXCLUDED_DOMAINS.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}
