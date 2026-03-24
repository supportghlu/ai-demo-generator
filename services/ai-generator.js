/**
 * AI Website Generator — uses AI to generate an enhanced website from scraped data
 *
 * Single-file approach: one AI call generates a complete HTML file with embedded CSS and JS.
 * Supports Anthropic Claude (primary) and OpenAI (fallback).
 */

/**
 * Generate website files from scraped data
 * @param {object} scrapedData - Output from scraper.js
 * @param {string} originalUrl - The original website URL
 * @returns {Promise<{success: boolean, files?: object, error?: string}>}
 */
export async function generateWebsite(scrapedData, originalUrl) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    return { success: false, error: 'No AI API key configured (need ANTHROPIC_API_KEY or OPENAI_API_KEY)' };
  }

  const provider = anthropicKey ? 'Anthropic' : 'OpenAI';
  console.log(`[ai-gen] Generating enhanced version of ${originalUrl} via ${provider} (single-file)...`);

  try {
    const siteInfo = buildSiteDescription(scrapedData, originalUrl);
    
    // Single-pass: Generate complete HTML file with embedded CSS
    console.log('[ai-gen] Generating complete enhanced HTML file...');
    const prompt = buildSingleFilePrompt(siteInfo, originalUrl);
    
    let html = anthropicKey 
      ? await callAnthropic(anthropicKey, SINGLE_FILE_SYSTEM, prompt)
      : await callOpenAI(openaiKey, SINGLE_FILE_SYSTEM, prompt);
    
    html = extractCodeBlock(html, 'html') || html;
    if (!html || html.length < 1000) {
      return { success: false, error: 'Failed to generate complete HTML file' };
    }
    
    console.log(`[ai-gen] Complete HTML file generated: ${html.length} chars`);

    // Return single HTML file (no separate CSS/JS needed)
    const files = { 
      html: html,
      css: '', // Empty since CSS is embedded
      js: ''   // Empty since JS is embedded
    };

    return { success: true, files };
  } catch (err) {
    console.error(`[ai-gen] Generation failed:`, err);
    return { success: false, error: `AI generation failed: ${err.message}` };
  }
}

// --- API Callers with retry ---

async function callAnthropic(apiKey, systemPrompt, userPrompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: (() => {
          const requestBody = {
            model: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
          };
          console.log('[ai-gen] Request size:', JSON.stringify(requestBody).length, 'chars');
          console.log('[ai-gen] User prompt preview:', userPrompt.slice(0, 500));
          return JSON.stringify(requestBody);
        })()
      });

      if (response.status === 529 || response.status === 500) {
        if (attempt < retries) {
          console.log(`[ai-gen] Anthropic ${response.status}, retrying in ${(attempt + 1) * 5}s...`);
          await sleep((attempt + 1) * 5000);
          continue;
        }
      }

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errText}`);
      }

      const result = await response.json();
      return result.content?.[0]?.text || '';
    } catch (err) {
      if (attempt < retries && (err.message.includes('529') || err.message.includes('500'))) {
        await sleep((attempt + 1) * 5000);
        continue;
      }
      throw err;
    }
  }
}

async function callOpenAI(apiKey, systemPrompt, userPrompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 16000
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- System Prompts ---

const SINGLE_FILE_SYSTEM = `You are an expert web designer and conversion strategist. Your job is to analyze a business, understand its industry, audience, and offerings, then build a custom-designed premium website tailored specifically to that business.

APPROACH:
1. First, study the website details provided — understand what industry they're in, who their customers are, what they sell/offer, and what makes them unique.
2. Based on that analysis, decide the best page structure, layout style, color treatment, typography, and conversion strategy for THIS specific business. A law firm should look completely different from a bakery. A SaaS product page should feel nothing like a local plumber's site.
3. Design a site that feels custom-built for them — not a generic template.

BRAND ACCURACY (CRITICAL):
- Preserve the exact business name, services, and offerings — never invent or add services they don't offer
- Use their brand colors as the foundation, elevated into a more premium palette
- Use the actual images provided from the scraped site — no placeholder or stock image URLs
- Match the original tone of voice but make the copy more compelling
- Preserve any contact details (phone, email, address) exactly as they appear

DESIGN DECISIONS YOU MUST MAKE (based on the business type):
- Page structure and section order — choose what sections make sense for this business
- Layout style — editorial, card-based, full-width immersive, split-screen, etc.
- Typography pairing from Google Fonts that fits their brand personality
- Color treatment — how to elevate their existing palette
- What kind of social proof works best (reviews, case studies, client logos, stats, etc.)
- What conversion strategy fits (booking, contact form CTA, phone call, free consultation, etc.)
- What objections their specific customers likely have and how to address them

QUALITY STANDARDS:
- Must look like a $15,000 custom website, not a template
- Premium design: depth, shadows, spacing, typography hierarchy, subtle animations
- Mobile-first responsive design
- Smooth interactions and hover effects
- Every design choice should serve the business's specific goals

TECHNICAL:
- Single complete HTML file with embedded <style> and <script> tags
- Semantic HTML5, CSS Grid/Flexbox, CSS custom properties
- Ensure a proper </body> tag exists for widget injection

OUTPUT: Complete HTML file only. No explanations, no markdown fences.`;

// --- Prompt Builders ---

function buildSiteDescription(data, url) {
  let desc = `Website: ${url}\nTitle: ${data.title || 'Unknown'}\n`;
  if (data.metaDescription) desc += `Description: ${data.metaDescription}\n`;
  if (data.fonts?.length) desc += `Fonts: ${data.fonts.join(', ')}\n`;
  if (data.colors?.length) {
    console.log('[ai-gen] Raw colors:', JSON.stringify(data.colors.slice(0, 20)));
    const cleanColors = data.colors
      .map(c => (c || '').trim())
      .filter(c => /^#[0-9a-fA-F]{3,8}$/.test(c) || /^rgb/.test(c) || /^hsl/.test(c))
      .slice(0, 15);
    console.log('[ai-gen] Clean colors:', JSON.stringify(cleanColors));
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
    console.log('[ai-gen] Images in prompt:', data.images?.slice(0, 12).map(i => i.src?.substring(0, 80)));
    desc += 'Images (use these URLs):\n';
    for (const img of data.images.slice(0, 12)) {
      if (!img.src ||
          img.src.startsWith('data:') ||
          img.src.startsWith('blob:') ||
          img.src.includes('facebook.com/tr') ||  // tracking pixels
          img.src.includes('google-analytics') ||
          !img.src.match(/\.(png|jpg|jpeg|gif|webp|svg|avif)/i)) continue; // must look like an image
      // Strip any characters outside printable ASCII
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
        .replace(/[^\x20-\x7E\n]/g, '') // keep only printable ASCII + newlines
        .substring(0, 150);
      desc += `  ${i + 1}. ${cleanText}\n`;
    }
  }

  return desc;
}

function buildSingleFilePrompt(siteInfo, originalUrl) {
  return `Analyze this business and build a premium, custom-designed website tailored to their industry and audience:

ORIGINAL WEBSITE: ${originalUrl}

WEBSITE DETAILS:
${siteInfo}

YOUR TASK:
1. Identify the industry, target audience, and core offerings from the details above
2. Decide the best page structure, layout style, and conversion strategy for THIS specific type of business
3. Build a premium website that feels custom-made — not a generic template

RULES:
- Do NOT invent services, products, or offerings not listed above
- Preserve all contact details (phone, email, address) exactly as they appear
- Use the actual image URLs provided — no placeholders
- Keep the same business name and branding identity

OUTPUT: Single complete HTML file with embedded CSS and JavaScript. No markdown fences. No explanations.`;
}



// --- Helpers ---

function extractCodeBlock(content, language) {
  const regex = new RegExp('```' + language + '\\s*\\n([\\s\\S]*?)```');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}
