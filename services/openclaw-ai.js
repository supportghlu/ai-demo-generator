/**
 * OpenClaw AI Integration — uses OpenClaw's exec tool to call Claude Sonnet
 * This bypasses direct Anthropic API and uses OpenClaw's model routing
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/**
 * Generate website using OpenClaw's Claude integration
 * @param {object} scrapedData - Output from scraper.js
 * @param {string} originalUrl - The original website URL
 * @returns {Promise<{success: boolean, files?: object, error?: string}>}
 */
export async function generateWebsiteViaOpenClaw(scrapedData, originalUrl) {
  console.log(`[openclaw-ai] Generating enhanced version of ${originalUrl} via OpenClaw...`);
  
  try {
    const siteInfo = buildSiteDescription(scrapedData, originalUrl);
    
    // Create temporary files for the prompt
    const tempDir = '/tmp/ai-demo-gen';
    await fs.mkdir(tempDir, { recursive: true });
    
    const promptFile = path.join(tempDir, 'prompt.md');
    const outputFile = path.join(tempDir, 'output.html');
    
    // Write the prompt to a file
    const prompt = buildWebsitePrompt(siteInfo, originalUrl);
    await fs.writeFile(promptFile, prompt);
    
    console.log('[openclaw-ai] Calling OpenClaw with Claude Sonnet...');
    
    // Use OpenClaw to generate the website
    const success = await callOpenClaw(promptFile, outputFile);
    
    if (!success) {
      return { success: false, error: 'OpenClaw generation failed' };
    }
    
    // Read the generated HTML
    const html = await fs.readFile(outputFile, 'utf-8');
    
    if (!html || html.length < 1000) {
      return { success: false, error: 'Generated HTML too short or empty' };
    }
    
    console.log(`[openclaw-ai] Generated HTML: ${html.length} chars`);
    
    // Clean up temp files
    await fs.unlink(promptFile).catch(() => {});
    await fs.unlink(outputFile).catch(() => {});
    
    const files = { 
      html: html,
      css: '', // Empty since CSS is embedded
      js: ''   // Empty since JS is embedded
    };

    return { success: true, files };
  } catch (err) {
    console.error(`[openclaw-ai] Generation failed:`, err);
    return { success: false, error: `OpenClaw generation failed: ${err.message}` };
  }
}

async function callOpenClaw(promptFile, outputFile) {
  try {
    // Read the prompt first
    const prompt = await fs.readFile(promptFile, 'utf-8');
    
    return new Promise((resolve) => {
      // Check if claude CLI is available
      const child = spawn('claude', ['--model', 'sonnet', '--print'], {
        stdio: 'pipe'
      });

      let output = '';
      let error = '';

      // Send prompt to Claude
      child.stdin.write(prompt);
      child.stdin.end();

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
        console.error(`[openclaw-err] ${data.toString().trim()}`);
      });

      child.on('close', async (code) => {
        if (code === 0 && output.trim()) {
          try {
            // Write the output to the file
            await fs.writeFile(outputFile, output.trim());
            console.log(`[openclaw-ai] OpenClaw generation completed successfully`);
            resolve(true);
          } catch (writeErr) {
            console.error(`[openclaw-ai] Error writing output file: ${writeErr.message}`);
            resolve(false);
          }
        } else {
          console.error(`[openclaw-ai] OpenClaw generation failed with code ${code}`);
          console.error(`[openclaw-ai] Error: ${error}`);
          console.error(`[openclaw-ai] Output: ${output.substring(0, 200)}`);
          resolve(false);
        }
      });

      child.on('error', (err) => {
        console.error(`[openclaw-ai] Failed to start claude process: ${err.message}`);
        resolve(false);
      });

      // Timeout after 120 seconds
      setTimeout(() => {
        child.kill();
        console.error(`[openclaw-ai] OpenClaw generation timed out`);
        resolve(false);
      }, 120000);
    });
  } catch (err) {
    console.error(`[openclaw-ai] Error reading prompt file: ${err.message}`);
    return false;
  }
}

function buildSiteDescription(data, url) {
  let desc = `Website: ${url}\nTitle: ${data.title || 'Unknown'}\n`;
  if (data.metaDescription) desc += `Description: ${data.metaDescription}\n`;
  if (data.fonts?.length) desc += `Fonts: ${data.fonts.join(', ')}\n`;
  if (data.colors?.length) {
    const cleanColors = data.colors
      .map(c => (c || '').trim())
      .filter(c => /^#[0-9a-fA-F]{3,8}$/.test(c) || /^rgb/.test(c) || /^hsl/.test(c))
      .slice(0, 15);
    if (cleanColors.length) desc += `Colors: ${cleanColors.join(', ')}\n`;
  }
  if (data.navigation?.length) desc += `Navigation: ${data.navigation.map(n => n.text).join(' | ')}\n`;
  desc += '\n';

  if (data.headings?.length) {
    desc += 'Headings:\n';
    for (const h of data.headings.slice(0, 20)) {
      desc += `  ${h.level}: ${h.text}\n`;
    }
    desc += '\n';
  }

  if (data.images?.length) {
    desc += 'Images (use these URLs):\n';
    for (const img of data.images.slice(0, 12)) {
      if (!img.src || 
          img.src.startsWith('data:') ||
          img.src.startsWith('blob:') ||
          img.src.includes('facebook.com/tr') ||
          img.src.includes('google-analytics') ||
          !img.src.match(/\.(png|jpg|jpeg|gif|webp|svg|avif)/i)) continue;
      
      const cleanSrc = img.src.replace(/[^\x20-\x7E]/g, '').trim();
      if (!cleanSrc) continue;
      desc += `  ${cleanSrc}${img.alt ? ` (${img.alt.substring(0, 60)})` : ''}\n`;
    }
    desc += '\n';
  }

  if (data.sections?.length) {
    desc += 'Content sections:\n';
    for (let i = 0; i < Math.min(data.sections.length, 10); i++) {
      const cleanText = (data.sections[i].textPreview || '')
        .replace(/[^\x20-\x7E\n]/g, '')
        .substring(0, 150);
      desc += `  ${i + 1}. ${cleanText}\n`;
    }
  }

  return desc;
}

function buildWebsitePrompt(siteInfo, originalUrl) {
  return `You are an expert web designer and conversion strategist. Analyze this business and build a premium, custom-designed website tailored to their industry and audience.

ORIGINAL WEBSITE: ${originalUrl}

WEBSITE DETAILS:
${siteInfo}

YOUR TASK:
1. Identify the industry, target audience, and core offerings from the details above
2. Decide the best page structure, layout style, and conversion strategy for THIS specific type of business  
3. Build a premium website that feels custom-made — not a generic template

DESIGN REQUIREMENTS:
- Must look like a $15,000 custom website, not a template
- Premium design: depth, shadows, spacing, typography hierarchy, subtle animations
- Mobile-first responsive design using CSS Grid/Flexbox
- Smooth interactions and hover effects
- Every design choice should serve the business's specific goals
- Use Google Fonts for professional typography

BRAND ACCURACY (CRITICAL):
- Preserve the exact business name, services, and offerings — never invent or add services they don't offer
- Use their brand colors as the foundation, elevated into a more premium palette
- Use the actual images provided from the scraped site — no placeholder or stock image URLs
- Match the original tone of voice but make the copy more compelling
- Preserve any contact details (phone, email, address) exactly as they appear

TECHNICAL REQUIREMENTS:
- Single complete HTML file with embedded <style> and <script> tags
- Semantic HTML5 structure
- CSS custom properties for consistent theming
- Ensure a proper </body> tag exists for widget injection
- Modern, conversion-focused design

RULES:
- Do NOT invent services, products, or offerings not listed above
- Preserve all contact details (phone, email, address) exactly as they appear  
- Use the actual image URLs provided — no placeholders
- Keep the same business name and branding identity

OUTPUT: Complete HTML file only. No explanations, no markdown fences, no additional text.`;
}