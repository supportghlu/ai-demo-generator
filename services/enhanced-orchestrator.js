/**
 * Demo Generation Orchestrator
 * Simplified workflow: Scrape → Generate → Inject → Deploy
 */

import { validateUrl } from './validator.js';
import { scrapeWebsite } from './scraper.js';
import { generateWebsite, generateSiteAnalysis } from './ai-generator.js';
import { injectWidgets, verifyWidgets } from './injector.js';
import { deployDemo } from './deployer-postgres.js';
import { updateContact, upsertContactWithDemo } from './ghl.js';
import { sendDemoSMS } from './sms.js';
import { sendDemoEmail } from './email.js';
import { addLog } from '../db-hybrid.js';

/**
 * Process demo generation - simplified workflow
 * @param {object} leadData - Lead submission data
 * @returns {Promise<{success: boolean, demoUrl?: string, analysis?: object, errors?: array}>}
 */
export async function processEnhancedDemo(leadData) {
  const startTime = Date.now();
  const errors = [];
  
  const jobId = leadData.jobId;
  const log = async (step, msg) => {
    if (jobId) { try { await addLog(jobId, step, msg); } catch {} }
  };

  console.log(`[orchestrator] Starting demo for: ${leadData.websiteUrl}`);

  try {
    // Step 1: Validate website URL
    console.log('[orchestrator] Step 1/6: Validating URL...');
    await log('step_1_validate', `Validating URL: ${leadData.websiteUrl}`);
    const validation = await validateUrl(leadData.websiteUrl);
    if (!validation.valid) {
      throw new Error(`URL validation failed: ${validation.error}`);
    }
    console.log('✅ URL validated');
    await log('step_1_validate', '✅ URL is reachable');

    // Step 2: Scrape original website with timeout
    console.log('[orchestrator] Step 2/6: Scraping website...');
    await log('step_2_scrape', 'Scraping website with Puppeteer...');
    const scrapePromise = scrapeWebsite(leadData.websiteUrl);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Scraping timeout after 45 seconds')), 45000)
    );
    
    const scrapeResult = await Promise.race([scrapePromise, timeoutPromise]);
    if (!scrapeResult.success) {
      throw new Error(`Website scraping failed: ${scrapeResult.error}`);
    }
    const scrapeInfo = `${scrapeResult.data.headings?.length || 0} headings, ${scrapeResult.data.images?.length || 0} images, ${scrapeResult.data.sections?.length || 0} sections, screenshot: ${scrapeResult.data.screenshot ? 'yes' : 'no'}`;
    console.log(`✅ Website scraped: ${scrapeInfo}`);
    await log('step_2_scrape', `✅ Scraped: ${scrapeInfo}`);

    // Step 3: Generate enhanced website + analysis (in parallel)
    console.log('[orchestrator] Step 3/6: Generating enhanced website + analysis...');
    await log('step_3_generate', 'Generating enhanced website with Claude Sonnet 4 (+ site analysis in parallel)...');
    const analysisPromise = generateSiteAnalysis(scrapeResult.data, leadData.websiteUrl);
    const generationResult = await generateWebsite(scrapeResult.data, leadData.websiteUrl, scrapeResult.data.screenshot);
    if (!generationResult.success) {
      throw new Error(`Website generation failed: ${generationResult.error}`);
    }
    console.log(`✅ Enhanced website generated: ${generationResult.files.html.length} chars`);
    await log('step_3_generate', `✅ Generated: ${generationResult.files.html.length} chars of HTML`);

    // Step 4: Inject AI Widgets
    console.log('[orchestrator] Step 4/6: Injecting widgets...');
    await log('step_4_inject', 'Injecting AI chat + voice widget scripts...');
    
    // Inject widgets
    let enhancedHtml;
    try {
      enhancedHtml = injectWidgets(generationResult.files.html);
      if (verifyWidgets(enhancedHtml)) {
        console.log('✅ AI widgets injected and verified');
        await log('step_4_inject', '✅ Widgets injected and verified');
      } else {
        console.error('❌ Widget injection produced output but widgets not found in HTML');
        errors.push('Widget verification failed — scripts may not be present');
        await log('step_4_inject', '⚠️ Widget verification failed');
      }
    } catch (injectionError) {
      errors.push(`Widget injection warning: ${injectionError.message}`);
      enhancedHtml = generationResult.files.html;
      console.log('⚠️ Proceeding without AI widgets');
      await log('step_4_inject', `⚠️ Widget injection failed: ${injectionError.message}`);
    }
    console.log(`[orchestrator] HTML length before deploy: ${enhancedHtml.length}, has </body>: ${enhancedHtml.includes('</body>')}, has widget script: ${enhancedHtml.includes('leadconnectorhq')}`);

    // Step 5: Deploy demo
    await log('step_5_deploy', 'Deploying demo + downloading images...');
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
    await log('step_5_deploy', `✅ Demo deployed: ${deployResult.demoUrl}`);

    // Resolve site analysis
    let siteAnalysis = null;
    try {
      const analysisResult = await analysisPromise;
      if (analysisResult.success) {
        siteAnalysis = analysisResult.analysis;
        console.log(`✅ Site analysis: ${siteAnalysis.issues?.length} issues, ${siteAnalysis.improvements?.length} improvements`);
      } else {
        console.log(`⚠️ Site analysis failed: ${analysisResult.error}`);
      }
    } catch (analysisErr) {
      console.log(`⚠️ Site analysis error: ${analysisErr.message}`);
    }

    // Update CRM + send notifications (skip if no email — e.g. quick demo from dashboard)
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

          // Send SMS notification
          try {
            const smsResult = await sendDemoSMS(crmResult.id, deployResult.demoUrl, leadData.name, siteAnalysis);
            if (smsResult.sent) {
              console.log(`✅ SMS sent: ${smsResult.message}`);
            } else {
              console.log(`⚠️ SMS failed: ${smsResult.message}`);
              errors.push('SMS delivery failed');
            }
          } catch (smsError) {
            console.error('[orchestrator] SMS error:', smsError);
            errors.push('SMS delivery error');
          }

          // Send Email notification
          try {
            const emailResult = await sendDemoEmail(crmResult.id, deployResult.demoUrl, leadData.name, leadData.email, siteAnalysis);
            if (emailResult.sent) {
              console.log(`✅ Email sent: ${emailResult.message}`);
            } else {
              console.log(`⚠️ Email failed: ${emailResult.message}`);
              errors.push('Email delivery failed');
            }
          } catch (emailError) {
            console.error('[orchestrator] Email error:', emailError);
            errors.push('Email delivery error');
          }
        }
      } catch (crmError) {
        console.error('[orchestrator] CRM error:', crmError);
        errors.push('CRM update failed');
      }
    }

    // Return success
    const generationTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`[orchestrator] ✅ Demo completed in ${generationTime}s`);
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