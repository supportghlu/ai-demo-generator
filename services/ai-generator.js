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
  console.log(`[ai-gen] Generating clone of ${originalUrl} via ${provider} (two-pass)...`);

  try {
    const siteInfo = buildSiteDescription(scrapedData, originalUrl);
    
    // Pass 1: Generate HTML
    console.log('[ai-gen] Pass 1: Generating HTML...');
    const htmlPrompt = buildHtmlPrompt(siteInfo);
    let html = anthropicKey 
      ? await callAnthropic(anthropicKey, HTML_SYSTEM, htmlPrompt)
      : await callOpenAI(openaiKey, HTML_SYSTEM, htmlPrompt);
    
    html = extractCodeBlock(html, 'html') || html;
    if (!html || html.length < 100) {
      return { success: false, error: 'Failed to generate HTML' };
    }
    console.log(`[ai-gen] HTML generated: ${html.length} chars`);

    // Pass 2: Generate CSS
    console.log('[ai-gen] Pass 2: Generating CSS...');
    const cssPrompt = buildCssPrompt(siteInfo, html);
    let css = anthropicKey
      ? await callAnthropic(anthropicKey, CSS_SYSTEM, cssPrompt)
      : await callOpenAI(openaiKey, CSS_SYSTEM, cssPrompt);
    
    css = extractCodeBlock(css, 'css') || css;
    console.log(`[ai-gen] CSS generated: ${css.length} chars`);

    // Minimal JS for interactivity
    const js = generateBasicJs(scrapedData);

    // Ensure HTML links to external files
    if (!html.includes('style.css')) {
      html = html.replace('</head>', '  <link rel="stylesheet" href="style.css">\n</head>');
    }
    if (!html.includes('script.js')) {
      html = html.replace('</body>', '  <script src="script.js"></script>\n</body>');
    }

    const files = { html, css, js };
    console.log(`[ai-gen] Complete: HTML(${files.html.length}), CSS(${files.css.length}), JS(${files.js.length})`);

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

const HTML_SYSTEM = `You are a premium web designer creating a DRAMATICALLY IMPROVED version of a website. Transform basic websites into modern, professional experiences that convert.

MISSION: Create a website that looks 10x better than the original while keeping the core business message.

Requirements:
- Modern HTML5 with premium structure and layout
- Hero section with powerful value proposition and CTA
- Feature/benefit sections with compelling copy
- Social proof elements (testimonials, trust badges)
- Professional service/product showcases
- Contact section with clear call-to-action
- Use provided image URLs directly but in premium layouts
- Link to Google Fonts for modern typography
- Reference style.css and script.js
- Add classes for advanced styling (.hero, .features, .cta-button, etc.)

Transform Strategy:
- Turn basic content into benefit-focused headlines
- Add trust signals and credibility elements
- Create visual hierarchy that guides to conversion
- Structure for animations and premium effects
- Modern card-based layouts for services/products

Output ONLY a single html code block. No explanations.`;

const CSS_SYSTEM = `You are a premium web designer creating STUNNING, professional CSS that makes websites look expensive and modern.

MISSION: Create CSS that transforms basic websites into premium experiences with modern design trends.

Requirements:
- Premium visual design with modern gradients, shadows, and effects
- Advanced CSS Grid and Flexbox for sophisticated layouts
- Smooth animations and hover effects
- Professional typography with perfect spacing
- Modern color schemes with premium feel
- Hero sections with compelling backgrounds
- Card-based designs with depth and shadows
- Responsive design that looks amazing on all devices
- Sticky navigation with transparency effects
- Button styles that demand attention
- Form styling that looks professional

Modern Design Elements:
- Gradient backgrounds and overlays
- Subtle animations (fade-in, slide-up)
- Professional shadows and depth
- Modern border-radius and spacing
- Premium color palettes
- Typography that establishes credibility
- Visual hierarchy that guides the eye

Make it look like a $10,000 custom website, not a basic template.

Output ONLY a single css code block. No explanations.`;

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

function buildHtmlPrompt(siteInfo) {
  return `Clone this website's HTML structure:\n\n${siteInfo}\n\nGenerate the complete index.html. Include ALL sections and content. Link to style.css and script.js.`;
}

function buildCssPrompt(siteInfo, html) {
  // Send the actual HTML so CSS targets the right elements
  const htmlTrimmed = html.length > 3000 ? html.substring(0, 3000) + '\n<!-- truncated -->' : html;
  
  return `Generate the complete CSS stylesheet for this HTML:\n\n\`\`\`html\n${htmlTrimmed}\n\`\`\`\n\nSite info:\n${siteInfo}\n\nIMPORTANT: Style the EXACT elements and tags in the HTML above. The HTML uses plain tags without many classes, so target elements by tag name and structure (e.g., header nav ul, main > section, etc.). Make it look professional, modern, and fully responsive. Match the brand colors and fonts.`;
}

function generateBasicJs(data) {
  let js = '// Website interactivity\n\n';
  
  // Mobile menu toggle
  js += `// Mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
  const menuToggle = document.querySelector('.menu-toggle, .mobile-toggle, .hamburger');
  const nav = document.querySelector('nav ul, .nav-menu, .mobile-menu');
  
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('active');
      menuToggle.classList.toggle('active');
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // Sticky nav
  const header = document.querySelector('header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    });
  }
});
`;

  return js;
}

// --- Helpers ---

function extractCodeBlock(content, language) {
  const regex = new RegExp('```' + language + '\\s*\\n([\\s\\S]*?)```');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}
