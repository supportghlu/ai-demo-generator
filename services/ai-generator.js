/**
 * AI Website Generator — uses AI to generate a cloned website from scraped data
 * 
 * Two-pass approach to work within token limits:
 * Pass 1: Generate HTML structure with inline references
 * Pass 2: Generate CSS styling
 * JS is minimal and generated inline
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
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'claude-3-haiku-20240307',
          max_tokens: 4096,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
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

const SINGLE_FILE_SYSTEM = `You are a conversion-focused web designer creating a DRAMATICALLY IMPROVED version of a business website optimized for brand awareness and conversion.

MISSION: Create a complete, professional HTML file (with embedded CSS) that looks significantly better than the original while maintaining their brand essence and driving conversions.

BRAND STRATEGY:
- Use their existing brand colors as the foundation but in sophisticated combinations
- Maintain their brand personality while elevating the professionalism
- Create trust and credibility through premium design elements
- Structure everything to guide visitors toward booking/contact actions

CONVERSION OPTIMIZATION REQUIREMENTS:
- Strong hero section with benefit-driven headline and dual CTAs
- Trust signals immediately visible (reviews, guarantees, credentials)
- Clear value propositions that explain WHY customers should choose them
- Social proof throughout (testimonials, ratings, customer count)
- Multiple conversion touchpoints (hero, pricing, final CTA)
- Professional service/product showcase with benefits focus
- FAQ section to overcome objections
- Mobile-first responsive design

TECHNICAL REQUIREMENTS:
- Single HTML file with embedded <style> and <script> tags
- Use Google Fonts for professional typography
- Modern CSS with gradients, shadows, and smooth animations
- Fully responsive across all devices
- Professional color scheme based on their brand
- Card-based layouts with hover effects
- Smooth scrolling and interactive elements

OUTPUT: Complete HTML file only. No explanations, no separate CSS files.`;

// --- Prompt Builders ---

function buildSiteDescription(data, url) {
  let desc = `Website: ${url}\nTitle: ${data.title || 'Unknown'}\n`;
  if (data.metaDescription) desc += `Description: ${data.metaDescription}\n`;
  if (data.fonts?.length) desc += `Fonts: ${data.fonts.join(', ')}\n`;
  if (data.colors?.length) desc += `Colors: ${data.colors.slice(0, 15).join(', ')}\n`;
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
      desc += `  ${img.src}${img.alt ? ` (${img.alt})` : ''}\n`;
    }
    desc += '\n';
  }

  if (data.sections?.length) {
    desc += 'Content sections:\n';
    for (let i = 0; i < Math.min(data.sections.length, 10); i++) {
      desc += `  ${i + 1}. ${data.sections[i].textPreview.substring(0, 150)}\n`;
    }
  }

  return desc;
}

function buildSingleFilePrompt(siteInfo, originalUrl) {
  return `Create a DRAMATICALLY IMPROVED version of this website optimized for brand awareness and conversion:

ORIGINAL WEBSITE: ${originalUrl}

WEBSITE DETAILS:
${siteInfo}

INSTRUCTIONS:
Make this a more improved version of their site that is professional and clearly displays their service/product in a more sophisticated way, built for conversion and brand awareness.

- Keep their brand colors but use them in premium, sophisticated combinations
- Transform their content into benefit-focused, conversion-optimized copy
- Add professional design elements: gradients, shadows, modern typography
- Include trust signals, social proof, and multiple conversion touchpoints
- Make it look like a $15,000 custom website vs their current basic site
- Ensure mobile-first responsive design
- Add smooth animations and professional interactions

OUTPUT: Single complete HTML file with embedded CSS and JavaScript. No separate files.`;
}



// --- Helpers ---

function extractCodeBlock(content, language) {
  const regex = new RegExp('```' + language + '\\s*\\n([\\s\\S]*?)```');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}
