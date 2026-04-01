/**
 * Demo Generation Orchestrator
 * Two paths:
 *   A) Has website → Scrape → Generate improved version
 *   B) No website  → Research competitors → Generate from scratch
 * Both converge at: Inject widgets → Deploy → Notify
 */

import { validateUrl } from './validator.js';
import { scrapeWebsite } from './scraper.js';
import { generateWebsite, generateSiteAnalysis, generateWebsiteFromScratch, generateCompetitorAnalysis } from './ai-generator.js';
import { findAndScrapeCompetitors } from './competitor-research.js';
import { injectWidgets, verifyWidgets } from './injector.js';
import { deployDemo } from './deployer-postgres.js';
import { updateContact, upsertContactWithDemo } from './ghl.js';
import { sendDemoSMS } from './sms.js';
import { sendDemoEmail } from './email.js';
import { addLog } from '../db-hybrid.js';

/**
 * Process demo generation — branches based on hasWebsite flag
 * @param {object} leadData - Lead submission data
 * @returns {Promise<{success: boolean, demoUrl?: string, analysis?: object, errors?: array}>}
 */
export async function processEnhancedDemo(leadData) {
  const startTime = Date.now();
  const errors = [];
  const hasWebsite = leadData.hasWebsite !== false && !!leadData.websiteUrl;
  const flowType = hasWebsite ? 'website-improvement' : 'no-website';

  const jobId = leadData.jobId;
  const log = async (step, msg) => {
    if (jobId) { try { await addLog(jobId, step, msg); } catch {} }
  };

  console.log(`[orchestrator] Starting demo (${flowType}) for: ${leadData.websiteUrl || `${leadData.businessType} in ${leadData.location}`}`);

  try {
    let generatedHtml;
    let siteAnalysis = null;

    if (hasWebsite) {
      // ============================
      // PATH A: Has Website
      // ============================

      // Step 1: Validate URL
      console.log('[orchestrator] Step 1/6: Validating URL...');
      await log('step_1_validate', `Validating URL: ${leadData.websiteUrl}`);
      const validation = await validateUrl(leadData.websiteUrl);
      if (!validation.valid) throw new Error(`URL validation failed: ${validation.error}`);
      console.log('✅ URL validated');
      await log('step_1_validate', '✅ URL is reachable');

      // Step 2: Scrape their website
      console.log('[orchestrator] Step 2/6: Scraping website...');
      await log('step_2_scrape', 'Scraping website with Puppeteer...');
      const scrapeResult = await Promise.race([
        scrapeWebsite(leadData.websiteUrl),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Scraping timeout after 45 seconds')), 45000))
      ]);
      if (!scrapeResult.success) throw new Error(`Website scraping failed: ${scrapeResult.error}`);

      const scrapeInfo = `${scrapeResult.data.headings?.length || 0} headings, ${scrapeResult.data.images?.length || 0} images, ${scrapeResult.data.sections?.length || 0} sections, screenshot: ${scrapeResult.data.screenshot ? 'yes' : 'no'}`;
      console.log(`✅ Website scraped: ${scrapeInfo}`);
      await log('step_2_scrape', `✅ Scraped: ${scrapeInfo}`);

      // Step 3: Generate improved website + analysis
      console.log('[orchestrator] Step 3/6: Generating enhanced website...');
      await log('step_3_generate', 'Generating enhanced website with Claude Sonnet 4 (+ site analysis in parallel)...');
      const analysisPromise = generateSiteAnalysis(scrapeResult.data, leadData.websiteUrl);
      const generationResult = await generateWebsite(scrapeResult.data, leadData.websiteUrl, scrapeResult.data.screenshot);
      if (!generationResult.success) throw new Error(`Website generation failed: ${generationResult.error}`);

      console.log(`✅ Enhanced website generated: ${generationResult.files.html.length} chars`);
      await log('step_3_generate', `✅ Generated: ${generationResult.files.html.length} chars of HTML`);
      generatedHtml = generationResult.files.html;

      // Resolve analysis
      try {
        const analysisResult = await analysisPromise;
        if (analysisResult.success) siteAnalysis = analysisResult.analysis;
      } catch (e) {
        console.log(`⚠️ Site analysis failed: ${e.message}`);
      }

    } else {
      // ============================
      // PATH B: No Website
      // ============================

      const businessDesc = `${leadData.businessType} in ${leadData.location}`;

      // Step 1: Validate inputs
      console.log('[orchestrator] Step 1/6: Validating business info...');
      await log('step_1_validate', `No-website flow: ${businessDesc}`);
      if (!leadData.businessType) throw new Error('Business type is required for no-website flow');
      if (!leadData.location) throw new Error('Location is required for no-website flow');
      await log('step_1_validate', `✅ Business info valid: ${businessDesc}`);

      // Step 2: Research competitors
      console.log(`[orchestrator] Step 2/6: Researching competitors for ${businessDesc}...`);
      await log('step_2_research', `Searching Google for competitors: "${businessDesc}"...`);
      const research = await findAndScrapeCompetitors(leadData.businessType, leadData.location);
      const compCount = research.competitors.length;
      console.log(`✅ Competitor research: ${compCount} competitors found and scraped`);
      await log('step_2_research', `✅ Found and scraped ${compCount} competitor websites`);

      // Step 3: Generate website from scratch
      console.log('[orchestrator] Step 3/6: Generating new website from scratch...');
      await log('step_3_generate', `Generating new website for ${businessDesc} with Claude Sonnet 4...`);

      const businessInfo = {
        businessType: leadData.businessType,
        businessName: leadData.companyName || leadData.name,
        location: leadData.location,
        idealCustomers: leadData.idealCustomers,
        servicesOffered: leadData.servicesOffered
      };

      // Use best competitor's screenshot as visual reference
      const bestScreenshot = research.competitors.find(c => c.screenshot)?.screenshot || null;

      // Generate website + competitor analysis in parallel
      const analysisPromise = generateCompetitorAnalysis(businessInfo, research.competitors);
      const generationResult = await generateWebsiteFromScratch(businessInfo, research.competitors, bestScreenshot);
      if (!generationResult.success) throw new Error(`Website generation failed: ${generationResult.error}`);

      console.log(`✅ New website generated: ${generationResult.files.html.length} chars`);
      await log('step_3_generate', `✅ Generated: ${generationResult.files.html.length} chars of HTML`);
      generatedHtml = generationResult.files.html;

      // Resolve competitor analysis
      try {
        const analysisResult = await analysisPromise;
        if (analysisResult.success) siteAnalysis = analysisResult.analysis;
      } catch (e) {
        console.log(`⚠️ Competitor analysis failed: ${e.message}`);
      }
    }

    // ============================
    // SHARED: Inject → Deploy → Notify
    // ============================

    // Step 4: Inject AI Widgets
    console.log('[orchestrator] Step 4/6: Injecting widgets...');
    await log('step_4_inject', 'Injecting AI chat + voice widget scripts...');
    let enhancedHtml;
    try {
      enhancedHtml = injectWidgets(generatedHtml);
      if (verifyWidgets(enhancedHtml)) {
        console.log('✅ AI widgets injected and verified');
        await log('step_4_inject', '✅ Widgets injected and verified');
      } else {
        errors.push('Widget verification failed');
        await log('step_4_inject', '⚠️ Widget verification failed');
      }
    } catch (injectionError) {
      errors.push(`Widget injection warning: ${injectionError.message}`);
      enhancedHtml = generatedHtml;
      await log('step_4_inject', `⚠️ Widget injection failed: ${injectionError.message}`);
    }

    // Step 5: Deploy
    await log('step_5_deploy', 'Deploying demo + downloading images...');
    const slug = generateCompanySlug(leadData.companyName || leadData.name || leadData.businessType || 'demo');
    const deployResult = await deployDemo(slug, {
      html: enhancedHtml,
      css: '',
      js: ''
    });
    if (!deployResult.success) throw new Error(`Demo deployment failed: ${deployResult.error}`);
    console.log(`✅ Demo deployed: ${deployResult.demoUrl}`);
    await log('step_5_deploy', `✅ Demo deployed: ${deployResult.demoUrl}`);

    // Log analysis results
    if (siteAnalysis) {
      const analysisType = hasWebsite ? 'Site analysis' : 'Competitor analysis';
      console.log(`✅ ${analysisType}: ${siteAnalysis.issues?.length || siteAnalysis.competitorInsights?.length || 0} insights`);
    }

    // Step 6: Notify (skip if no email)
    const skipNotifications = !leadData.email;
    if (skipNotifications) {
      console.log('[orchestrator] Skipping CRM/SMS/Email (no email — quick demo mode)');
      await log('step_6_notify', 'Skipped notifications (quick demo mode — no email)');
    } else {
      await log('step_6_notify', 'Sending CRM update, SMS, and email...');
      try {
        const crmResult = await upsertContactWithDemo({
          name: leadData.name,
          email: leadData.email,
          phone: leadData.phone,
          demoUrl: deployResult.demoUrl
        });
        if (crmResult?.id) {
          console.log(`✅ CRM updated: Contact ID ${crmResult.id}`);

          // SMS — pass flow type so template can adapt
          try {
            const smsResult = await sendDemoSMS(crmResult.id, deployResult.demoUrl, leadData.name, siteAnalysis, flowType);
            if (smsResult.sent) console.log(`✅ SMS sent: ${smsResult.message}`);
            else errors.push('SMS delivery failed');
          } catch (e) { errors.push('SMS delivery error'); }

          // Email — pass flow type so template can adapt
          try {
            const emailResult = await sendDemoEmail(crmResult.id, deployResult.demoUrl, leadData.name, leadData.email, siteAnalysis, flowType);
            if (emailResult.sent) console.log(`✅ Email sent: ${emailResult.message}`);
            else errors.push('Email delivery failed');
          } catch (e) { errors.push('Email delivery error'); }
        }
      } catch (crmError) {
        console.error('[orchestrator] CRM error:', crmError);
        errors.push('CRM update failed');
      }
    }

    const generationTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`[orchestrator] ✅ Demo completed in ${generationTime}s (${flowType})`);
    await log('completed', `✅ Demo completed in ${generationTime}s — ${deployResult.demoUrl}`);

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

function generateCompanySlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}
