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
    useOpenAI = true;
    model = configuredModel;
  } else if (anthropicKey) {
    useOpenAI = false;
    model = (isClaudeModel && configuredModel.includes('-202')) ? configuredModel : DEFAULT_CLAUDE_MODEL;
    if (configuredModel && model !== configuredModel) {
      console.log(`[ai-gen] AI_MODEL "${configuredModel}" looks invalid, using ${model}`);
    }
  } else if (openaiKey) {
    useOpenAI = true;
    model = configuredModel || 'gpt-4o';
  } else {
    return { success: false, error: 'No compatible AI API key available' };
  }

  const provider = useOpenAI ? 'OpenAI' : 'Anthropic';
  console.log(`[ai-gen] Provider: ${provider}, Model: ${model}, Screenshot: ${screenshot ? 'yes' : 'no'}`);
  console.log(`[ai-gen] Generating enhanced version of ${originalUrl}...`);

  const siteInfo = buildSiteDescription(scrapedData, originalUrl);
  const prompt = buildSingleFilePrompt(siteInfo, originalUrl, !!screenshot);

  // Try Anthropic
  if (!useOpenAI) {
    try {
      console.log(`[ai-gen] Pass 1: Generating with ${model}...`);
      let html = await callAnthropic(anthropicKey, getSystemPrompt(!!screenshot), prompt, model, screenshot);
      html = extractCodeBlock(html, 'html') || html;
      if (!html || html.length < 1000) {
        console.log(`[ai-gen] ${model} output too short (${html?.length || 0} chars)`);
        throw new Error('Output too short');
      }
      console.log(`[ai-gen] Pass 1 complete: ${html.length} chars`);

      // Ensure proper closing tags for widget injection
      html = ensureClosingTags(html);

      // Refinement pass (optional)
      if (process.env.ENABLE_REFINEMENT !== 'false') {
        try {
          console.log('[ai-gen] Pass 2: Refining generated HTML...');
          const refinementPrompt = buildRefinementPrompt(html, siteInfo);
          const refined = await callAnthropic(
            anthropicKey, REFINEMENT_SYSTEM, refinementPrompt, model, screenshot
          );
          const refinedHtml = extractCodeBlock(refined, 'html') || refined;
          if (refinedHtml && refinedHtml.length > html.length * 0.5) {
            html = ensureClosingTags(refinedHtml);
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
      console.error(`[ai-gen] ${model} failed: ${err.message}`);
    }
    console.log('[ai-gen] Claude generation failed');
  }

  // OpenAI path (either primary or fallback)
  if (openaiKey) {
    try {
      const oaiModel = useOpenAI ? model : 'gpt-4o';
      console.log(`[ai-gen] ${useOpenAI ? 'Using' : 'Falling back to'} OpenAI ${oaiModel}...`);
      let html = await callOpenAI(openaiKey, SINGLE_FILE_SYSTEM, prompt, oaiModel);
      html = extractCodeBlock(html, 'html') || html;
      if (html && html.length >= 1000) {
        html = ensureClosingTags(html);
        console.log(`[ai-gen] OpenAI succeeded: ${html.length} chars`);
        return { success: true, files: { html, css: '', js: '' } };
      }
    } catch (fallbackErr) {
      console.error(`[ai-gen] OpenAI also failed:`, fallbackErr);
    }
  }

  return { success: false, error: 'All AI providers failed' };
}

// --- Ensure closing tags for widget injection ---

function ensureClosingTags(html) {
  if (!html.includes('</body>')) {
    console.log('[ai-gen] Missing </body> tag, appending closing tags');
    html += '\n</body>\n</html>';
  } else if (!html.includes('</html>')) {
    html += '\n</html>';
  }
  return html;
}

// --- API Callers ---

async function callAnthropic(apiKey, systemPrompt, userPrompt, modelName, screenshot = null, retries = 2) {
  // If vision request fails with 400, retry without screenshot
  const attempts = screenshot ? ['with_screenshot', 'without_screenshot'] : ['without_screenshot'];

  for (const mode of attempts) {
    const useScreenshot = mode === 'with_screenshot' && screenshot;
    try {
      const result = await _callAnthropicRaw(apiKey, systemPrompt, userPrompt, modelName, useScreenshot ? screenshot : null, retries);
      return result;
    } catch (err) {
      if (mode === 'with_screenshot' && err.message.includes('400')) {
        console.warn(`[ai-gen] Vision request failed (400), retrying without screenshot...`);
        continue;
      }
      throw err;
    }
  }
}

async function _callAnthropicRaw(apiKey, systemPrompt, userPrompt, modelName, screenshot, retries) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let content;
      if (screenshot) {
        content = [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: screenshot }
          },
          { type: 'text', text: userPrompt }
        ];
      } else {
        content = userPrompt;
      }

      const maxTokens = modelName.includes('claude-3-haiku') ? 4096
        : modelName.includes('claude-3-5') || modelName.includes('claude-3-opus') ? 4096
        : 16384; // claude-sonnet-4 supports up to 16384

      const requestBody = {
        model: modelName,
        max_tokens: maxTokens,
        temperature: 0.2,
        system: systemPrompt,
        messages: [{ role: 'user', content }]
      };

      console.log(`[ai-gen] Anthropic request: model=${modelName}, max_tokens=${requestBody.max_tokens}, ` +
        `content_type=${screenshot ? 'image+text' : 'text'}, ` +
        `system_length=${systemPrompt.length}, prompt_length=${userPrompt.length}` +
        (screenshot ? `, screenshot_b64_length=${screenshot.length}` : ''));

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
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
        console.error(`[ai-gen] Anthropic ${response.status} full response:`, errText.substring(0, 1000));
        throw new Error(`Anthropic API error: ${response.status} ${errText.substring(0, 300)}`);
      }

      const result = await response.json();
      const output = result.content?.[0]?.text || '';
      console.log(`[ai-gen] Anthropic response: ${output.length} chars, stop_reason=${result.stop_reason}`);
      return output;
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
Use the screenshot as your primary design reference. Replicate the layout closely.`;
  }
  return prompt;
}

const SINGLE_FILE_SYSTEM = `You are an expert web designer rebuilding an existing business website into a premium version. You are NOT creating a new site from scratch — you are enhancing an EXISTING site whose content has been scraped and provided to you.

CRITICAL RULES — READ THESE FIRST:
1. USE THE ACTUAL CONTENT PROVIDED. Every heading, paragraph, service description, and detail from the scraped content MUST appear in your output. Do not summarize, replace, or paraphrase — use the real text.
2. USE THE ACTUAL IMAGE URLs PROVIDED. Every image URL listed must be used in an <img> tag. NEVER use placeholder images, gradient backgrounds as image substitutes, or stock photo URLs. If 20 images are provided, use all 20.
3. USE THE ACTUAL CONTACT DETAILS. Address, phone, email, booking links — copy them exactly from the scraped content.
4. DO NOT INVENT CONTENT. Never add services, testimonials, team members, statistics, or any content not found in the scraped data. If the original site has 4 services, your output has 4 services — not 6.

WHAT YOU SHOULD DO:
- Reorganize the scraped content into a clean, premium layout
- Improve the visual design: better typography, spacing, shadows, animations
- Make the copy more compelling while keeping the same meaning and details
- Add proper responsive design (mobile breakpoints)
- Structure sections logically: hero, about, services, gallery, testimonials, contact, footer
- Use their brand colors elevated into a premium palette
- Add Google Fonts, smooth scrolling, hover effects, scroll-triggered animations

QUALITY STANDARDS:
- Must look like a premium custom website
- Every section must have real content — NO empty sections, NO "coming soon", NO placeholder text
- All images must render (use the actual URLs from the scraped data)
- The gallery/portfolio section must use real images from the scraped data
- Contact section must include the real address, phone, and/or email from the scraped data
- Navigation must link to actual sections via anchor IDs

TECHNICAL REQUIREMENTS:
- Single complete HTML file with embedded <style> and <script> tags
- Semantic HTML5, CSS Grid/Flexbox, CSS custom properties
- Google Fonts loaded via <link> in <head>
- IntersectionObserver for scroll animations
- Mobile-responsive with at least 2 breakpoints (768px, 480px)
- MUST include proper </body></html> closing tags at the very end

OUTPUT: Complete HTML file only. No explanations, no markdown fences, no commentary.`;

const REFINEMENT_SYSTEM = `You are a senior web designer doing a final quality review on a generated website. You have the original site details and must ensure accuracy.

CHECK AND FIX:
1. IMAGES — Are all the provided image URLs actually used in <img> tags? Replace any gradient placeholders or missing images with the real URLs from the site details.
2. CONTENT — Does every section have real, specific content from the original site? Replace any generic/placeholder text with the actual scraped content.
3. CONTACT INFO — Is the real address, phone, email visible? Add it if missing.
4. SERVICES — Do the services match exactly what the original site offers? Remove any invented ones, add any missing ones.
5. CLOSING TAGS — Does the HTML end with </body></html>?
6. RESPONSIVE — Are there media queries for mobile?
7. VISUAL POLISH — Add subtle improvements: better shadows, transitions, hover effects.

Do NOT remove any sections. Do NOT add invented content. Fix what's wrong, enhance what's there.

OUTPUT: Complete improved HTML file only. No explanations, no markdown fences.`;

// --- Prompt Builders ---

function buildSiteDescription(data, url) {
  let desc = `WEBSITE URL: ${url}\n`;
  desc += `BUSINESS NAME: ${data.title || 'Unknown'}\n`;
  if (data.metaDescription) desc += `DESCRIPTION: ${data.metaDescription}\n`;

  // Fonts
  const allFonts = new Set([...(data.fonts || []), ...(data.computedFonts || [])]);
  if (allFonts.size) desc += `FONTS: ${[...allFonts].join(', ')}\n`;

  // Colors
  if (data.colors?.length || data.computedColors?.length) {
    const rawColors = data.colors || [];
    const cleanColors = rawColors
      .map(c => (c || '').trim())
      .filter(c => /^#[0-9a-fA-F]{3,8}$/.test(c) || /^rgb/.test(c) || /^hsl/.test(c))
      .slice(0, 25);
    const computedColors = (data.computedColors || []).slice(0, 10);
    const bgColors = (data.computedBgColors || []).slice(0, 10);
    const allColors = [...new Set([...cleanColors, ...computedColors, ...bgColors])];
    if (allColors.length) desc += `BRAND COLORS: ${allColors.join(', ')}\n`;
  }

  // Computed styles
  if (data.computedStyles) {
    desc += '\nRENDERED STYLES:\n';
    for (const [element, styles] of Object.entries(data.computedStyles)) {
      if (styles) {
        desc += `  ${element}: font=${styles.fontFamily?.split(',')[0]?.trim()}, color=${styles.color}, bg=${styles.backgroundColor}\n`;
      }
    }
  }

  // Navigation
  if (data.navigation?.length) {
    desc += `\nNAVIGATION MENU: ${data.navigation.map(n => `${n.text}${n.href ? ` (${n.href})` : ''}`).join(' | ')}\n`;
  }

  // CTA buttons
  if (data.ctaButtons?.length) {
    desc += `CTA BUTTONS: ${data.ctaButtons.join(' | ')}\n`;
  }

  // Headings — ALL of them
  if (data.headings?.length) {
    desc += '\nALL HEADINGS FROM THE SITE (use these exact headings):\n';
    for (const h of data.headings.slice(0, 50)) {
      desc += `  ${h.level}: ${h.text}\n`;
    }
  }

  // Images — ALL of them with emphasis
  if (data.images?.length) {
    const validImages = data.images.filter(img => {
      if (!img.src) return false;
      if (img.src.startsWith('data:') || img.src.startsWith('blob:')) return false;
      if (img.src.includes('facebook.com/tr') || img.src.includes('google-analytics')) return false;
      if (!img.src.match(/\.(png|jpg|jpeg|gif|webp|svg|avif)/i)) return false;
      return true;
    }).map(img => ({
      src: img.src.replace(/[^\x20-\x7E]/g, '').trim(),
      alt: img.alt || ''
    })).filter(img => img.src);

    if (validImages.length) {
      desc += `\n*** IMAGES — YOU MUST USE ALL OF THESE (${validImages.length} total) ***\n`;
      desc += `Do NOT use placeholder images. Do NOT use gradient boxes. Use these EXACT URLs:\n`;
      for (let i = 0; i < validImages.length; i++) {
        desc += `  ${i + 1}. ${validImages[i].src}${validImages[i].alt ? ` (${validImages[i].alt.substring(0, 80)})` : ''}\n`;
      }
    }
  }

  // Content sections — FULL text, not truncated
  if (data.sections?.length) {
    desc += '\nPAGE CONTENT (use this real content — do not replace with generic text):\n';
    for (let i = 0; i < Math.min(data.sections.length, 25); i++) {
      const cleanText = (data.sections[i].textPreview || '')
        .replace(/[^\x20-\x7E\n]/g, '')
        .substring(0, 800);
      if (cleanText.trim()) {
        desc += `\n--- Section ${i + 1} ---\n${cleanText}\n`;
      }
    }
  }

  // Footer — often has contact details
  if (data.footerContent) {
    desc += `\nFOOTER CONTENT (contains contact details — include these in the site):\n`;
    desc += `${data.footerContent.replace(/[^\x20-\x7E\n]/g, '').substring(0, 800)}\n`;
  }

  // Links — useful for booking links etc.
  if (data.links?.length) {
    const externalLinks = data.links.filter(l =>
      l.href.startsWith('http') &&
      !l.href.includes(new URL(url).hostname) &&
      l.text.length > 1
    ).slice(0, 10);
    if (externalLinks.length) {
      desc += `\nEXTERNAL LINKS (booking systems, social media, etc.):\n`;
      for (const link of externalLinks) {
        desc += `  ${link.text}: ${link.href}\n`;
      }
    }
  }

  return desc;
}

function buildSingleFilePrompt(siteInfo, originalUrl, hasScreenshot) {
  let prompt = `Rebuild this business website as a premium version. Use ALL the real content, images, and details provided below.

SOURCE WEBSITE: ${originalUrl}

${siteInfo}

INSTRUCTIONS:
1. Use EVERY image URL listed above — place them in hero sections, galleries, service cards, and backgrounds. No placeholders.
2. Use the REAL headings and text content — rewrite for impact but keep the same information and details.
3. Include ALL contact details from the footer/content in a visible contact section.
4. Match the navigation structure from the original site.
5. If there are booking links or external links, include them as CTAs.`;

  if (hasScreenshot) {
    prompt += `\n6. The attached screenshot shows the original site layout — use it as visual reference for section order and style.`;
  }

  prompt += `

The HTML MUST end with </body></html> — this is required for chat widget injection after generation.

OUTPUT: Single complete HTML file with embedded CSS and JavaScript. No markdown, no explanations.`;

  return prompt;
}

function buildRefinementPrompt(generatedHtml, siteInfo) {
  return `Review and improve this generated website. Compare it against the original site data and fix any issues.

ORIGINAL SITE DATA:
${siteInfo}

GENERATED HTML TO REVIEW AND IMPROVE:
\`\`\`html
${generatedHtml}
\`\`\`

FIXES NEEDED:
1. Check every image — are the real URLs from the site data used? Replace any placeholders/gradients with actual image URLs.
2. Check all text — is it from the original site or is it generic filler? Use the real content.
3. Check contact details — are address, phone, email from the footer/content visible?
4. Check services — do they match exactly what the original site offers?
5. Check the HTML ends with </body></html>
6. Enhance visual polish: better spacing, shadows, gradients, micro-animations.

OUTPUT: The complete improved HTML file. No explanations, no markdown fences.`;
}

// --- Helpers ---

function extractCodeBlock(content, language) {
  const regex = new RegExp('```' + language + '\\s*\\n([\\s\\S]*?)```');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}
