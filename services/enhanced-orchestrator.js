/**
 * Enhanced Demo Generation Orchestrator
 * Coordinates the full enhanced workflow with industry analysis and optimization
 */

import { validateUrl } from './validator.js';
import { scrapeWebsite } from './scraper.js';
import { analyzeIndustry } from './industry-analyzer.js';
import { optimizeForConversion } from './conversion-optimizer.js';
import { generateEnhancedWebsite } from './enhanced-generator.js';
import { injectWidgets } from './injector.js';
import { deployDemo } from './deployer.js';
import { updateContact, upsertContactWithDemo } from './ghl.js';
import { triggerDemoEmail } from './email.js';

/**
 * Process enhanced demo generation with full optimization pipeline
 * @param {object} leadData - Lead submission data
 * @returns {Promise<{success: boolean, demoUrl?: string, analysis?: object, errors?: array}>}
 */
export async function processEnhancedDemo(leadData) {
  const startTime = Date.now();
  const errors = [];
  let analysis = {};
  
  console.log(`[enhanced-orchestrator] Starting enhanced demo for: ${leadData.websiteUrl}`);
  
  try {
    // Step 1: Validate website URL
    console.log('[enhanced-orchestrator] Step 1/8: Validating URL...');
    const validation = await validateUrl(leadData.websiteUrl);
    if (!validation.valid) {
      throw new Error(`URL validation failed: ${validation.error}`);
    }
    console.log('✅ URL validated');

    // Step 2: Scrape original website
    console.log('[enhanced-orchestrator] Step 2/8: Scraping website...');
    const scrapeResult = await scrapeWebsite(leadData.websiteUrl);
    if (!scrapeResult.success) {
      throw new Error(`Website scraping failed: ${scrapeResult.error}`);
    }
    console.log(`✅ Website scraped: ${scrapeResult.data.sections?.length || 0} sections found`);

    // Step 3: Industry Analysis
    console.log('[enhanced-orchestrator] Step 3/8: Analyzing industry...');
    const industryResult = await analyzeIndustry(scrapeResult.data, leadData.websiteUrl);
    if (!industryResult.success) {
      errors.push(`Industry analysis warning: ${industryResult.error}`);
      // Continue with fallback analysis
      analysis.industry = 'General Business';
      analysis.optimizationScore = 5;
    } else {
      analysis = industryResult.analysis;
      console.log(`✅ Industry identified: ${analysis.industry} (Score: ${analysis.optimizationScore}/10)`);
    }

    // Step 4: Conversion Optimization
    console.log('[enhanced-orchestrator] Step 4/8: Creating optimization plan...');
    const optimizationResult = await optimizeForConversion(scrapeResult.data, analysis, leadData.websiteUrl);
    if (!optimizationResult.success) {
      errors.push(`Optimization planning warning: ${optimizationResult.error}`);
      // Continue with fallback optimization
      var optimization = createFallbackOptimization(analysis);
    } else {
      var optimization = optimizationResult.optimization;
      console.log(`✅ Optimization plan created: ${optimization.improvements?.length || 0} improvements`);
    }

    // Step 5: Generate Enhanced Website
    console.log('[enhanced-orchestrator] Step 5/8: Generating enhanced website...');
    const generationResult = await generateEnhancedWebsite(
      scrapeResult.data, 
      analysis, 
      optimization, 
      leadData.websiteUrl
    );
    if (!generationResult.success) {
      throw new Error(`Enhanced website generation failed: ${generationResult.error}`);
    }
    console.log(`✅ Enhanced website generated: ${Object.keys(generationResult.files).join(', ')}`);

    // Step 6: Inject AI Widgets
    console.log('[enhanced-orchestrator] Step 6/8: Injecting AI widgets...');
    try {
      var enhancedHtml = injectWidgets(generationResult.files.html);
      console.log('✅ AI widgets injected');
    } catch (injectionError) {
      errors.push(`AI widget injection warning: ${injectionError.message}`);
      // Continue with original HTML
      var enhancedHtml = generationResult.files.html;
      console.error('⚠️ Widget injection failed:', injectionError.message);
    }

    // Step 7: Deploy Demo
    console.log('[enhanced-orchestrator] Step 7/8: Deploying demo...');
    const slug = (leadData.companyName || leadData.name || 'demo').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const deployResult = await deployDemo(slug, {
      ...generationResult.files,
      html: enhancedHtml
    });
    
    if (!deployResult.success) {
      throw new Error(`Demo deployment failed: ${deployResult.error}`);
    }
    console.log(`✅ Demo deployed: ${deployResult.demoUrl}`);

    // Step 8: Update CRM and Send Email
    console.log('[enhanced-orchestrator] Step 8/8: Updating CRM and sending email...');
    
    // Update CRM with demo URL and analysis data
    try {
      const crmResult = await upsertContactWithDemo({
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone,
        demoUrl: deployResult.demoUrl
      });
      console.log('✅ CRM updated with demo URL');
    } catch (crmError) {
      errors.push(`CRM update warning: ${crmError.message}`);
      console.error('⚠️ CRM update failed:', crmError.message);
    }

    // Send enhanced demo email
    try {
      const emailResult = await triggerDemoEmail(
        leadData.email, 
        deployResult.demoUrl, 
        leadData.name
      );
      console.log('✅ Email triggered:', emailResult.message);
    } catch (emailError) {
      errors.push(`Email delivery warning: ${emailError.message}`);
      console.error('⚠️ Email trigger failed:', emailError.message);
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.log(`🎉 Enhanced demo complete in ${totalTime}s: ${deployResult.demoUrl}`);

    return {
      success: true,
      demoUrl: deployResult.demoUrl,
      analysis: {
        industry: analysis.industry,
        optimizationScore: analysis.optimizationScore,
        improvements: optimization.improvements?.length || 0,
        generationTime: totalTime
      },
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    console.error(`[enhanced-orchestrator] Enhanced demo failed after ${totalTime}s:`, error);
    
    return {
      success: false,
      error: error.message,
      analysis: analysis.industry ? {
        industry: analysis.industry,
        optimizationScore: analysis.optimizationScore,
        generationTime: totalTime
      } : undefined,
      errors: errors
    };
  }
}

/**
 * Fallback optimization when AI analysis fails
 */
function createFallbackOptimization(analysis) {
  return {
    optimizedStructure: {
      hero: {
        headline: `Transform Your ${analysis.industry || 'Business'} Today`,
        subheadline: 'Get proven results with our industry-leading solutions designed for your success',
        cta: 'Get Started Now',
        trustElement: 'Join thousands of satisfied customers who trust our solutions'
      },
      sections: [
        {
          type: 'problem',
          headline: 'The Challenge You Face',
          content: `Businesses in ${analysis.industry || 'your industry'} struggle with outdated systems and manual processes that limit growth`,
          cta: null
        },
        {
          type: 'solution',
          headline: 'Our Proven Solution',
          content: 'We provide cutting-edge solutions specifically designed for your industry needs',
          cta: 'Learn More'
        },
        {
          type: 'benefits',
          headline: 'Why Choose Us',
          content: 'Proven track record, industry expertise, and dedicated support for your success',
          cta: 'See Results'
        },
        {
          type: 'social-proof',
          headline: 'Success Stories',
          content: 'Real customers achieving real results with our solutions',
          cta: 'Read More'
        },
        {
          type: 'cta-final',
          headline: 'Ready to Get Started?',
          content: 'Join the growing number of successful businesses using our platform',
          cta: 'Start Your Free Trial'
        }
      ],
      footer: {
        trustSignals: ['Money-back guarantee', '24/7 customer support', 'Secure & reliable'],
        contactInfo: 'Multiple ways to reach our expert team'
      }
    },
    improvements: [
      'Enhanced conversion-focused headlines',
      'Industry-specific messaging',
      'Strategic trust signal placement',
      'Optimized call-to-action positioning',
      'Mobile-first responsive design'
    ],
    copywritingStrategy: {
      tone: 'Professional and results-focused',
      messagingFramework: 'Problem-agitation-solution-proof',
      keyBenefits: ['Proven Results', 'Expert Support', 'Industry Focus']
    },
    conversionElements: [
      'Strong value proposition',
      'Social proof integration',
      'Multiple strategic CTAs',
      'Trust signal emphasis',
      'Mobile optimization'
    ],
    designPrinciples: [
      'Clean, professional layout',
      'High-contrast action buttons',
      'Intuitive navigation',
      'Fast loading optimization',
      'Accessibility compliance'
    ],
    industrySpecific: [
      `Tailored for ${analysis.industry || 'business'} needs`,
      'Industry-appropriate imagery',
      'Sector-specific trust signals',
      'Relevant case studies integration'
    ]
  };
}

/**
 * Get enhanced demo statistics
 */
export function getEnhancedStats() {
  // This would connect to your database to get real stats
  return {
    totalEnhancedDemos: 0,
    avgOptimizationScore: 0,
    avgGenerationTime: 0,
    topIndustries: [],
    conversionImprovements: []
  };
}