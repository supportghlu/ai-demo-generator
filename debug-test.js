#!/usr/bin/env node

/**
 * Debug script to test each component of the demo generation pipeline
 */

import dotenv from 'dotenv';
import { validateUrl } from './services/validator.js';
import { scrapeWebsite } from './services/scraper.js';
import { generateWebsite } from './services/ai-generator.js';

dotenv.config();

async function debugPipeline() {
  const testUrl = 'https://example.com';
  console.log('🔍 Starting debug pipeline for:', testUrl);
  
  try {
    // Step 1: Validate URL
    console.log('\n--- Step 1: URL Validation ---');
    const validation = await validateUrl(testUrl);
    console.log('Validation result:', validation);
    
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.error}`);
    }
    
    // Step 2: Scrape website with timeout
    console.log('\n--- Step 2: Website Scraping ---');
    const scrapePromise = scrapeWebsite(testUrl);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Scraping timeout after 15 seconds')), 15000)
    );
    
    const scrapeResult = await Promise.race([scrapePromise, timeoutPromise]);
    console.log('Scrape success:', scrapeResult.success);
    
    if (!scrapeResult.success) {
      throw new Error(`Scraping failed: ${scrapeResult.error}`);
    }
    
    console.log('Scraped data keys:', Object.keys(scrapeResult.data));
    console.log('Sections found:', scrapeResult.data.sections?.length || 0);
    
    // Step 3: Generate website
    console.log('\n--- Step 3: Website Generation ---');
    console.log('API Keys available:');
    console.log('- ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? 'Present' : 'Missing');
    console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
    
    const genResult = await generateWebsite(scrapeResult.data, testUrl);
    console.log('Generation success:', genResult.success);
    
    if (genResult.success) {
      console.log('Generated HTML length:', genResult.files.html.length);
      console.log('✅ Pipeline test completed successfully!');
    } else {
      console.log('❌ Generation failed:', genResult.error);
    }
    
  } catch (error) {
    console.error('❌ Pipeline failed at:', error.message);
    console.error('Error details:', error);
  }
}

debugPipeline().catch(console.error);