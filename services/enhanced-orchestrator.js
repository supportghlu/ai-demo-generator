/**
 * Demo Generation Orchestrator
 * Simplified workflow: Scrape → Generate → Inject → Deploy
 */

import { validateUrl } from './validator.js';
import { scrapeWebsite } from './scraper.js';
import { generateWebsite } from './ai-generator.js';
import { injectWidgets } from './injector.js';
import { deployDemo } from './deployer.js';
import { updateContact, upsertContactWithDemo } from './ghl.js';

/**
 * Process demo generation - simplified workflow
 * @param {object} leadData - Lead submission data
 * @returns {Promise<{success: boolean, demoUrl?: string, analysis?: object, errors?: array}>}
 */
export async function processEnhancedDemo(leadData) {
  const startTime = Date.now();
  const errors = [];
  
  console.log(`[orchestrator] Starting demo for: ${leadData.websiteUrl}`);
  
  try {
    // Step 1: Validate website URL
    console.log('[orchestrator] Step 1/4: Validating URL...');
    const validation = await validateUrl(leadData.websiteUrl);
    if (!validation.valid) {
      throw new Error(`URL validation failed: ${validation.error}`);
    }
    console.log('✅ URL validated');

    // Step 2: Scrape original website
    console.log('[orchestrator] Step 2/4: Scraping website...');
    const scrapeResult = await scrapeWebsite(leadData.websiteUrl);
    if (!scrapeResult.success) {
      throw new Error(`Website scraping failed: ${scrapeResult.error}`);
    }
    console.log(`✅ Website scraped: ${scrapeResult.data.sections?.length || 0} sections found`);

    // Step 3: Generate enhanced website
    console.log('[orchestrator] Step 3/4: Generating enhanced website...');
    const generationResult = await generateWebsite(scrapeResult.data, leadData.websiteUrl);
    if (!generationResult.success) {
      throw new Error(`Website generation failed: ${generationResult.error}`);
    }
    console.log(`✅ Enhanced website generated`);

    // Step 4: Inject AI Widgets & Deploy
    console.log('[orchestrator] Step 4/4: Injecting widgets and deploying...');
    
    // Inject widgets
    let enhancedHtml;
    try {
      enhancedHtml = injectWidgets(generationResult.files.html);
      console.log('✅ AI widgets injected');
    } catch (injectionError) {
      errors.push(`Widget injection warning: ${injectionError.message}`);
      enhancedHtml = generationResult.files.html;
      console.log('⚠️ Proceeding without AI widgets');
    }

    // Deploy demo
    const slug = generateCompanySlug(leadData.companyName || leadData.name || 'demo');
    const deployResult = await deployDemo(slug, {
      html: enhancedHtml,
      css: generationResult.files.css || '',
      js: generationResult.files.js || ''
    });

    if (!deployResult.success) {
      throw new Error(`Demo deployment failed: ${deployResult.error}`);
    }
    console.log(`✅ Demo deployed: ${deployResult.demoUrl}`);

    // Update CRM
    try {
      const crmResult = await upsertContactWithDemo(
        leadData.name,
        leadData.email,
        leadData.phone,
        leadData.websiteUrl,
        deployResult.demoUrl
      );
      if (crmResult?.id) {
        console.log(`✅ CRM updated: Contact ID ${crmResult.id}`);
      }
    } catch (crmError) {
      console.error('[orchestrator] CRM error:', crmError);
      errors.push('CRM update failed');
    }

    // Return success
    const generationTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`[orchestrator] ✅ Demo completed in ${generationTime}s`);

    return {
      success: true,
      demoUrl: deployResult.demoUrl,
      analysis: { generationTime },
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (err) {
    console.error(`[orchestrator] Demo failed:`, err);
    const generationTime = Math.round((Date.now() - startTime) / 1000);
    
    return {
      success: false,
      error: err.message,
      analysis: { generationTime },
      errors: [...errors, err.message]
    };
  }
}

/**
 * Generate company slug from name
 */
function generateCompanySlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}