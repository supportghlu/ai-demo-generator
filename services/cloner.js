/**
 * Website Cloner — AI-powered website cloning pipeline
 * 
 * Flow:
 * 1. Scrape the target website (content, structure, images, fonts, colors)
 * 2. Feed scraped data to OpenAI to generate clean HTML/CSS/JS
 * 3. Inject GHL AI widgets into the generated HTML
 * 4. Deploy as a static demo site
 * 5. Return the demo URL
 */

import { scrapeWebsite } from './scraper.js';
import { generateWebsite } from './ai-generator.js';
import { injectWidgets, verifyWidgets } from './injector.js';
import { deployDemo, generateSlug } from './deployer.js';
import { addLog } from '../db.js';

/**
 * Clone a website using AI
 * @param {string} jobId - The job ID for tracking
 * @param {string} websiteUrl - The URL to clone
 * @param {string} [companyName] - Optional company name for the slug
 * @returns {Promise<{success: boolean, pending?: boolean, demoUrl?: string, message: string}>}
 */
export async function cloneWebsite(jobId, websiteUrl, companyName) {
  console.log(`[cloner] Job ${jobId}: Clone requested for ${websiteUrl}`);

  // Check for OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log(`[cloner] Job ${jobId}: OPENAI_API_KEY not configured`);
    return {
      success: false,
      pending: true,
      message: 'OPENAI_API_KEY not configured — cannot generate website clone'
    };
  }

  try {
    // Step 1: Scrape the website
    addLog(jobId, 'scraping', `Scraping website content from ${websiteUrl}...`);
    const scrapeResult = await scrapeWebsite(websiteUrl);
    
    if (!scrapeResult.success) {
      addLog(jobId, 'scrape_failed', `Scrape failed: ${scrapeResult.error}`);
      return { success: false, message: `Website scrape failed: ${scrapeResult.error}` };
    }

    const scrapedData = scrapeResult.data;
    addLog(jobId, 'scraped', `Scraped: ${scrapedData.headings?.length || 0} headings, ${scrapedData.images?.length || 0} images, ${scrapedData.sections?.length || 0} sections`);

    // Step 2: Generate website clone via AI
    addLog(jobId, 'generating', 'Generating website clone via AI...');
    const genResult = await generateWebsite(scrapedData, websiteUrl);

    if (!genResult.success) {
      addLog(jobId, 'generation_failed', `AI generation failed: ${genResult.error}`);
      return { success: false, message: `AI generation failed: ${genResult.error}` };
    }

    addLog(jobId, 'generated', `Generated: HTML(${genResult.files.html.length}), CSS(${genResult.files.css.length}), JS(${genResult.files.js.length})`);

    // Step 3: Inject AI widgets
    addLog(jobId, 'injecting', 'Injecting GHL AI widgets...');
    const injectedHtml = injectWidgets(genResult.files.html);
    
    if (!verifyWidgets(injectedHtml)) {
      addLog(jobId, 'injection_warning', 'Widget verification failed — widgets may not have been injected correctly');
    } else {
      addLog(jobId, 'injected', 'AI chat and voice widgets injected successfully');
    }

    // Step 4: Deploy demo site
    addLog(jobId, 'deploying', 'Deploying demo site...');
    const slug = generateSlug(companyName || websiteUrl);
    const deployResult = await deployDemo(slug, {
      html: injectedHtml,
      css: genResult.files.css,
      js: genResult.files.js
    });

    if (!deployResult.success) {
      addLog(jobId, 'deploy_failed', `Deploy failed: ${deployResult.error}`);
      return { success: false, message: `Deploy failed: ${deployResult.error}` };
    }

    addLog(jobId, 'deployed', `Demo live at: ${deployResult.demoUrl}`);

    return {
      success: true,
      demoUrl: deployResult.demoUrl,
      message: `Demo generated and deployed at ${deployResult.demoUrl}`
    };

  } catch (err) {
    console.error(`[cloner] Job ${jobId} failed:`, err);
    addLog(jobId, 'error', `Unexpected error: ${err.message}`);
    return { success: false, message: `Cloning failed: ${err.message}` };
  }
}
