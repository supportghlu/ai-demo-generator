/**
 * AI Website Generator — uses AI to generate an enhanced website from scraped data
 *
 * Single-file approach: one AI call generates a complete HTML file with embedded CSS and JS.
 * Supports Anthropic Claude (primary) with vision, and OpenAI (fallback).
 * Optional refinement pass for higher quality output.
 */

/**
 * Generate website files from scraped data
 * @param {object} scrapedData - Output from scraper.js
 * @param {string} originalUrl - The original website URL
 * @param {string|null} screenshot - Base64 JPEG screenshot from Puppeteer (optional)
 * @returns {Promise<{success: boolean, files?: object, error?: string}>}
 */
export async function generateWebsite(scrapedData, originalUrl, screenshot = null) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    return { success: false, error: 'No AI API key configured (need ANTHROPIC_API_KEY or OPENAI_API_KEY)' };
  }

  // Provider selection: Anthropic primary, OpenAI fallback
  const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-20250514';
  const configuredModel = process.env.AI_MODEL || '';
  const isGPTModel = configuredModel.toLowerCase().includes('gpt');
  const isClaudeModel = configuredModel.toLowerCase().includes('claude');

  let useOpenAI, model;

  if (isGPTModel && openaiKey) {
    // User explicitly configured a GPT model
    useOpenAI = true;
    model = configuredModel;
  } else if (anthropicKey) {
    // Default: Anthropic Claude — only use AI_MODEL if it's a valid Claude model ID
    useOpenAI = false;
    model = (isClaudeModel && configuredModel.includes('-202')) ? configuredModel : DEFAULT_CLAUDE_MODEL;
    if (configuredModel && model !== configuredModel) {
      console.log(`[ai-gen] AI_MODEL "${configuredModel}" looks invalid, using ${model}`);
    }
  } else if (openaiKey) {
    // Fallback: OpenAI
    useOpenAI = true;
    model = configuredModel || 'gpt-4o';
  } else {
    return { success: false, error: 'No compatible AI API key available' };
  }

  const provider = useOpenAI ? 'OpenAI' : 'Anthropic';
  console.log(`[ai-gen] Provider: ${provider}, Model: ${model}, Screenshot: ${screenshot ? 'yes' : 'no'}`);
  console.log(`[ai-gen] Generating enhanced version of ${originalUrl}...`);

  try {
    const siteInfo = buildSiteDescription(scrapedData, originalUrl);
    const prompt = buildSingleFilePrompt(siteInfo, originalUrl, !!screenshot);

    // First pass: generate complete HTML
    console.log('[ai-gen] Pass 1: Generating complete enhanced HTML...');
    let html = useOpenAI
      ? await callOpenAI(openaiKey, SINGLE_FILE_SYSTEM, prompt, model)
      : await callAnthropic(anthropicKey, getSystemPrompt(!!screenshot), prompt, model, screenshot);

    html = extractCodeBlock(html, 'html') || html;
    if (!html || html.length < 1000) {
      return { success: false, error: 'Failed to generate complete HTML file' };
    }
    console.log(`[ai-gen] Pass 1 complete: ${html.length} chars`);

    // Refinement pass (optional)
    if (process.env.ENABLE_REFINEMENT !== 'false' && !useOpenAI) {
      try {
        console.log('[ai-gen] Pass 2: Refining generated HTML...');
        const refinementPrompt = buildRefinementPrompt(html, siteInfo);
        const refined = await callAnthropic(
          anthropicKey, REFINEMENT_SYSTEM, refinementPrompt, model, screenshot
        );
        const refinedHtml = extractCodeBlock(refined, 'html') || refined;
        if (refinedHtml && refinedHtml.length > html.length * 0.5) {
          html = refinedHtml;
          console.log(`[ai-gen] Pass 2 complete: ${html.length} chars`);
        } else {
          console.log('[ai-gen] Pass 2 output too short, keeping pass 1 result');
        }
      } catch (refineErr) {
        console.warn(`[ai-gen] Refinement failed (using pass 1): ${refineErr.message}`);
      }
    }

    console.log(`[ai-gen] Final HTML: ${html.length} chars`);
    return { success: true, files: { html, css: '', js: '' } };
  } catch (err) {
    console.error(`[ai-gen] Generation failed:`, err);

    // If Anthropic failed and we have an OpenAI key, try fallback
    if (!useOpenAI && openaiKey) {
      console.log('[ai-gen] Attempting OpenAI fallback...');
      try {
        const siteInfo = buildSiteDescription(scrapedData, originalUrl);
        const prompt = buildSingleFilePrompt(siteInfo, originalUrl, false);
        let html = await callOpenAI(openaiKey, SINGLE_FILE_SYSTEM, prompt, 'gpt-4o');
        html = extractCodeBlock(html, 'html') || html;
        if (html && html.length >= 1000) {
          console.log(`[ai-gen] OpenAI fallback succeeded: ${html.length} chars`);
          return { success: true, files: { html, css: '', js: '' } };
        }
      } catch (fallbackErr) {
        console.error(`[ai-gen] OpenAI fallback also failed:`, fallbackErr);
      }
    }

    return { success: false, error: `AI generation failed: ${err.message}` };
  }
}

// --- API Callers ---

async function callAnthropic(apiKey, systemPrompt, userPrompt, modelName, screenshot = null, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Build message content — multimodal if screenshot provided
      let content;
      if (screenshot) {
        content = [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: screenshot } },
          { type: 'text', text: userPrompt }
        ];
      } else {
        content = userPrompt;
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: modelName,
          max_tokens: 16384,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: 'user', content }]
        })
      });

      if (response.status === 529 || response.status === 500 || response.status === 429) {
        if (attempt < retries) {
          const delay = response.status === 429 ? (attempt + 1) * 10000 : (attempt + 1) * 5000;
          console.log(`[ai-gen] Anthropic ${response.status}, retrying in ${delay / 1000}s...`);
          await sleep(delay);
          continue;
        }
      }

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[ai-gen] Anthropic ${response.status} response:`, errText.substring(0, 500));
        throw new Error(`Anthropic API error: ${response.status} ${errText.substring(0, 300)}`);
      }

      const result = await response.json();
      return result.content?.[0]?.text || '';
    } catch (err) {
      if (attempt < retries && (err.message.includes('529') || err.message.includes('500') || err.message.includes('429'))) {
        await sleep((attempt + 1) * 5000);
        continue;
      }
      throw err;
    }
  }
}

async function callOpenAI(apiKey, systemPrompt, userPrompt, modelName = 'gpt-4o') {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
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
    throw new Error(`OpenAI API error: ${response.status} ${errText.substring(0, 200)}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// --- System Prompts ---

function getSystemPrompt(hasScreenshot) {
  let prompt = SINGLE_FILE_SYSTEM;
  if (hasScreenshot) {
    prompt += `\n\nVISUAL REFERENCE:
You are provided with a screenshot of the original website. Study it carefully to match:
- The overall visual style, layout proportions, and color balance
- Section ordering and content hierarchy
- Typography scale and spacing
- The general aesthetic and brand feel
Use the screenshot as your primary design reference.`;
  }
  return prompt;
}

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
- The generated HTML must be substantial and complete — at least 8000 characters
- Include at least 5 distinct, well-designed page sections

TECHNICAL:
- Single complete HTML file with embedded <style> and <script> tags
- Semantic HTML5, CSS Grid/Flexbox, CSS custom properties
- Google Fonts loaded via <link> tag in the <head>
- Smooth scroll behavior, scroll-triggered animations via IntersectionObserver
- MUST end with proper </body></html> tags (required for widget injection)

OUTPUT: Complete HTML file only. No explanations, no markdown fences.`;

const REFINEMENT_SYSTEM = `You are a senior web designer reviewing and improving a generated website. You will receive the generated HTML code and details about the original website.

Your job is to improve the HTML by:
1. Ensuring the layout and visual hierarchy match what a premium site in this industry should look like
2. Filling in any sections that feel incomplete or placeholder-like
3. Improving responsive design (check media queries for mobile/tablet)
4. Enhancing visual polish — shadows, gradients, spacing, micro-animations
5. Ensuring all content from the original site is accurately represented
6. Making sure the HTML ends with proper </body></html> tags
7. Verifying all image URLs from the original site are used (not placeholders)

Do NOT remove any sections. Only improve and enhance. The output must be a COMPLETE HTML file — do not output partial snippets.

OUTPUT: Complete improved HTML file only. No explanations, no markdown fences.`;

// --- Prompt Builders ---

function buildSiteDescription(data, url) {
  let desc = `Website: ${url}\nTitle: ${data.title || 'Unknown'}\n`;
  if (data.metaDescription) desc += `Description: ${data.metaDescription}\n`;

  // Fonts — combine extracted and computed
  const allFonts = new Set([...(data.fonts || []), ...(data.computedFonts || [])]);
  if (allFonts.size) desc += `Fonts: ${[...allFonts].join(', ')}\n`;

  // Colors — combine extracted and computed
  if (data.colors?.length || data.computedColors?.length) {
    const rawColors = data.colors || [];
    const cleanColors = rawColors
      .map(c => (c || '').trim())
      .filter(c => /^#[0-9a-fA-F]{3,8}$/.test(c) || /^rgb/.test(c) || /^hsl/.test(c))
      .slice(0, 25);
    const computedColors = (data.computedColors || []).slice(0, 10);
    const bgColors = (data.computedBgColors || []).slice(0, 10);
    const allColors = [...new Set([...cleanColors, ...computedColors, ...bgColors])];
    if (allColors.length) desc += `Colors: ${allColors.join(', ')}\n`;
  }

  // Computed styles summary
  if (data.computedStyles) {
    desc += '\nComputed Styles (from rendered page):\n';
    for (const [element, styles] of Object.entries(data.computedStyles)) {
      if (styles) {
        desc += `  ${element}: font=${styles.fontFamily?.split(',')[0]?.trim()}, color=${styles.color}, bg=${styles.backgroundColor}\n`;
      }
    }
  }

  if (data.navigation?.length) desc += `\nNavigation: ${data.navigation.map(n => n.text).join(' | ')}\n`;

  // CTA buttons
  if (data.ctaButtons?.length) {
    desc += `\nCall-to-Action buttons: ${data.ctaButtons.join(' | ')}\n`;
  }

  desc += '\n';

  // Headings (increased limit)
  if (data.headings?.length) {
    desc += 'Headings:\n';
    for (const h of data.headings.slice(0, 40)) {
      desc += `  ${h.level}: ${h.text}\n`;
    }
    desc += '\n';
  }

  // Images (increased limit)
  if (data.images?.length) {
    desc += 'Images (use these URLs):\n';
    for (const img of data.images.slice(0, 30)) {
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

  // Content sections (increased limits)
  if (data.sections?.length) {
    desc += 'Content sections:\n';
    for (let i = 0; i < Math.min(data.sections.length, 25); i++) {
      const cleanText = (data.sections[i].textPreview || '')
        .replace(/[^\x20-\x7E\n]/g, '')
        .substring(0, 500);
      desc += `  ${i + 1}. ${cleanText}\n`;
    }
    desc += '\n';
  }

  // Footer content
  if (data.footerContent) {
    desc += `Footer content:\n  ${data.footerContent.replace(/[^\x20-\x7E\n]/g, '').substring(0, 500)}\n`;
  }

  return desc;
}

function buildSingleFilePrompt(siteInfo, originalUrl, hasScreenshot) {
  let prompt = `Analyze this business and build a premium, custom-designed website tailored to their industry and audience:

ORIGINAL WEBSITE: ${originalUrl}

WEBSITE DETAILS:
${siteInfo}

YOUR TASK:
1. Identify the industry, target audience, and core offerings from the details above
2. Decide the best page structure, layout style, and conversion strategy for THIS specific type of business
3. Build a premium website that feels custom-made — not a generic template`;

  if (hasScreenshot) {
    prompt += `\n4. Use the provided screenshot as your primary visual reference for layout, style, and color treatment`;
  }

  prompt += `

RULES:
- Do NOT invent services, products, or offerings not listed above
- Preserve all contact details (phone, email, address) exactly as they appear
- Use the actual image URLs provided — no placeholders
- Keep the same business name and branding identity
- The HTML must be substantial and complete (at least 8000 characters)
- MUST end with </body></html>

OUTPUT: Single complete HTML file with embedded CSS and JavaScript. No markdown fences. No explanations.`;

  return prompt;
}

function buildRefinementPrompt(generatedHtml, siteInfo) {
  return `Here is a generated website HTML that needs improvement. Review it against the original site details and enhance the quality.

ORIGINAL SITE DETAILS:
${siteInfo}

GENERATED HTML TO IMPROVE:
\`\`\`html
${generatedHtml}
\`\`\`

Improve this HTML by:
1. Ensuring all content sections are fully fleshed out with compelling copy
2. Improving visual design (better spacing, shadows, gradients, animations)
3. Making responsive design more robust (mobile breakpoints)
4. Ensuring all original site images are used
5. Adding any missing sections that a premium version of this site should have
6. Ensuring it ends with </body></html>

OUTPUT: The complete improved HTML file. No explanations, no markdown fences.`;
}

// --- Helpers ---

function extractCodeBlock(content, language) {
  const regex = new RegExp('```' + language + '\\s*\\n([\\s\\S]*?)```');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}
