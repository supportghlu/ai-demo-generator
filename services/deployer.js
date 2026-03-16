/**
 * Demo Site Deployer — deploys generated websites as static sites
 * 
 * Strategy: Push generated files to a GitHub repo, then deploy via Render.
 * Each demo gets its own directory in a shared "demos" repo.
 * 
 * Alternative: We serve demos directly from our Express server.
 * This is simpler and avoids creating a Render service per demo.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEMOS_DIR = join(__dirname, '..', 'demos');

/**
 * Deploy a demo website
 * @param {string} slug - URL-safe company name
 * @param {object} files - {html, css, js} content strings
 * @returns {Promise<{success: boolean, demoUrl?: string, error?: string}>}
 */
export async function deployDemo(slug, files) {
  console.log(`[deployer] Deploying demo for: ${slug}`);

  try {
    // Ensure demos directory exists
    if (!existsSync(DEMOS_DIR)) {
      mkdirSync(DEMOS_DIR, { recursive: true });
    }

    // Create demo directory
    const demoDir = join(DEMOS_DIR, slug);
    if (!existsSync(demoDir)) {
      mkdirSync(demoDir, { recursive: true });
    }

    // Write files
    writeFileSync(join(demoDir, 'index.html'), files.html, 'utf-8');
    if (files.css) writeFileSync(join(demoDir, 'style.css'), files.css, 'utf-8');
    if (files.js) writeFileSync(join(demoDir, 'script.js'), files.js, 'utf-8');

    console.log(`[deployer] Files written to ${demoDir}`);

    // The demo URL is served by our Express app
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
 * Generate a URL-safe slug from a company name or URL
 * @param {string} input - Company name or website URL
 * @returns {string}
 */
export function generateSlug(input) {
  // If it's a URL, extract the domain
  try {
    const url = new URL(input);
    input = url.hostname.replace('www.', '');
  } catch {
    // Not a URL, use as-is
  }

  return input
    .toLowerCase()
    .replace(/\.[^.]+$/, '') // Remove TLD
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Trim hyphens
    .substring(0, 50); // Max length
}

/**
 * Check if a demo exists
 * @param {string} slug
 * @returns {boolean}
 */
export function demoExists(slug) {
  return existsSync(join(DEMOS_DIR, slug, 'index.html'));
}

/**
 * Get demo file path
 * @param {string} slug
 * @returns {string}
 */
export function getDemoDir(slug) {
  return join(DEMOS_DIR, slug);
}
