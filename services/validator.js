/**
 * URL Validator — checks that a prospect's website is reachable
 */

export async function validateUrl(url) {
  // Check URL format
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Check site is reachable
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'GHLU-DemoBot/1.0'
      },
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (response.status >= 400) {
      return { valid: false, error: `Site returned status ${response.status}` };
    }

    return { valid: true, error: null };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { valid: false, error: 'Site timed out (10s)' };
    }
    return { valid: false, error: `Site unreachable: ${err.message}` };
  }
}
