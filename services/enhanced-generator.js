/**
 * Enhanced AI Website Generator
 * Generates conversion-optimized websites based on industry analysis and optimization plan
 */

/**
 * Generate enhanced website from optimization plan
 * @param {object} scrapedData - Original website data
 * @param {object} industryAnalysis - Industry analysis results
 * @param {object} optimization - Conversion optimization plan
 * @param {string} originalUrl - Original website URL
 * @returns {Promise<{success: boolean, files?: object, error?: string}>}
 */
export async function generateEnhancedWebsite(scrapedData, industryAnalysis, optimization, originalUrl) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    return { success: false, error: 'No AI API key configured for enhanced generation' };
  }

  const provider = anthropicKey ? 'Anthropic' : 'OpenAI';
  console.log(`[enhanced-generator] Building optimized ${industryAnalysis.industry} website...`);

  try {
    // Pass 1: Generate optimized HTML
    console.log('[enhanced-generator] Pass 1: Generating enhanced HTML structure...');
    const htmlPrompt = buildEnhancedHtmlPrompt(scrapedData, industryAnalysis, optimization, originalUrl);
    let html = anthropicKey 
      ? await callAnthropic(anthropicKey, ENHANCED_HTML_SYSTEM, htmlPrompt)
      : await callOpenAI(openaiKey, ENHANCED_HTML_SYSTEM, htmlPrompt);
    
    html = extractCodeBlock(html, 'html') || html;
    if (!html || html.length < 200) {
      return { success: false, error: 'Failed to generate enhanced HTML' };
    }
    console.log(`[enhanced-generator] Enhanced HTML generated: ${html.length} chars`);

    // Pass 2: Generate conversion-optimized CSS
    console.log('[enhanced-generator] Pass 2: Generating conversion-focused CSS...');
    const cssPrompt = buildEnhancedCssPrompt(industryAnalysis, optimization, html);
    let css = anthropicKey
      ? await callAnthropic(anthropicKey, ENHANCED_CSS_SYSTEM, cssPrompt)
      : await callOpenAI(openaiKey, ENHANCED_CSS_SYSTEM, cssPrompt);
    
    css = extractCodeBlock(css, 'css') || css;
    console.log(`[enhanced-generator] Enhanced CSS generated: ${css.length} chars`);

    // Pass 3: Generate enhanced interactivity
    console.log('[enhanced-generator] Pass 3: Generating enhanced JavaScript...');
    const js = generateEnhancedJs(industryAnalysis, optimization);

    // Ensure proper file linking
    if (!html.includes('style.css')) {
      html = html.replace('</head>', '  <link rel="stylesheet" href="style.css">\n</head>');
    }
    if (!html.includes('script.js')) {
      html = html.replace('</body>', '  <script src="script.js"></script>\n</body>');
    }

    const files = { html, css, js };
    console.log(`[enhanced-generator] Complete Enhanced Site: HTML(${files.html.length}), CSS(${files.css.length}), JS(${files.js.length})`);

    return { success: true, files };
  } catch (err) {
    console.error(`[enhanced-generator] Enhanced generation failed:`, err);
    return { success: false, error: `Enhanced generation failed: ${err.message}` };
  }
}

// --- Enhanced System Prompts ---

const ENHANCED_HTML_SYSTEM = `You are an expert conversion-focused web developer. Generate HTML for a high-converting, industry-optimized website.

CRITICAL REQUIREMENTS:
- Follow the provided optimization structure EXACTLY
- Use conversion-focused headlines and copy
- Include industry-specific trust elements
- Implement mobile-first responsive design
- Add proper semantic HTML5 structure
- Include conversion tracking elements
- Use the original website's images when provided

Output ONLY a single html code block. No explanations.`;

const ENHANCED_CSS_SYSTEM = `You are a conversion rate optimization CSS expert. Generate CSS that maximizes conversions.

FOCUS AREAS:
- High-contrast, action-oriented CTAs
- Trust-building visual hierarchy
- Mobile-first responsive design
- Industry-appropriate color psychology
- Smooth animations and micro-interactions
- Accessibility and fast loading
- Professional, conversion-focused aesthetic

Output ONLY a single css code block. No explanations.`;

// --- API Callers with Enhanced Error Handling ---

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
          temperature: 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (response.status === 529 || response.status === 500) {
        if (attempt < retries) {
          console.log(`[enhanced-generator] Anthropic ${response.status}, retrying in ${(attempt + 1) * 5}s...`);
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
      max_tokens: 4096
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

// --- Enhanced Prompt Builders ---

function buildEnhancedHtmlPrompt(scrapedData, industryAnalysis, optimization, originalUrl) {
  let prompt = `Build a conversion-optimized website using this optimization plan:\n\n`;
  
  // Key context
  prompt += `ORIGINAL: ${originalUrl}\n`;
  prompt += `INDUSTRY: ${industryAnalysis.industry} | TARGET: ${industryAnalysis.targetAudience}\n`;
  prompt += `OPTIMIZATION SCORE: ${industryAnalysis.optimizationScore}/10 → Target: 9+/10\n\n`;
  
  // Optimized structure to follow
  prompt += `OPTIMIZED STRUCTURE TO IMPLEMENT:\n\n`;
  
  // Hero section
  const hero = optimization.optimizedStructure.hero;
  prompt += `HERO SECTION:\n`;
  prompt += `• Headline: "${hero.headline}"\n`;
  prompt += `• Subheadline: "${hero.subheadline}"\n`;
  prompt += `• Primary CTA: "${hero.cta}"\n`;
  prompt += `• Trust Element: "${hero.trustElement}"\n\n`;
  
  // Main sections
  if (optimization.optimizedStructure.sections?.length) {
    prompt += `MAIN SECTIONS:\n`;
    optimization.optimizedStructure.sections.forEach((section, i) => {
      prompt += `${i + 1}. ${section.type.toUpperCase()}\n`;
      prompt += `   Headline: "${section.headline}"\n`;
      prompt += `   Content: ${section.content}\n`;
      if (section.cta) prompt += `   CTA: "${section.cta}"\n`;
      prompt += `\n`;
    });
  }
  
  // Footer
  const footer = optimization.optimizedStructure.footer;
  if (footer) {
    prompt += `FOOTER:\n`;
    if (footer.trustSignals) prompt += `• Trust Signals: ${footer.trustSignals.join(', ')}\n`;
    if (footer.contactInfo) prompt += `• Contact: ${footer.contactInfo}\n\n`;
  }
  
  // Use original images
  if (scrapedData.images?.length) {
    prompt += `IMAGES TO USE (original URLs):\n`;
    scrapedData.images.slice(0, 8).forEach(img => {
      prompt += `• ${img.src}${img.alt ? ` (${img.alt})` : ''}\n`;
    });
    prompt += `\n`;
  }
  
  // Conversion elements to include
  if (optimization.conversionElements?.length) {
    prompt += `MUST INCLUDE CONVERSION ELEMENTS:\n`;
    optimization.conversionElements.forEach(element => {
      prompt += `• ${element}\n`;
    });
    prompt += `\n`;
  }

  // Industry-specific requirements
  if (optimization.industrySpecific?.length) {
    prompt += `INDUSTRY-SPECIFIC REQUIREMENTS:\n`;
    optimization.industrySpecific.forEach(req => {
      prompt += `• ${req}\n`;
    });
    prompt += `\n`;
  }
  
  prompt += `Generate the complete HTML that implements this optimization plan. This should be SIGNIFICANTLY more conversion-focused than a basic clone.`;
  
  return prompt;
}

function buildEnhancedCssPrompt(industryAnalysis, optimization, html) {
  const htmlTrimmed = html.length > 2500 ? html.substring(0, 2500) + '\n<!-- truncated -->' : html;
  
  let prompt = `Generate conversion-optimized CSS for this enhanced website:\n\n`;
  
  prompt += `\`\`\`html\n${htmlTrimmed}\n\`\`\`\n\n`;
  
  prompt += `INDUSTRY: ${industryAnalysis.industry}\n`;
  prompt += `TARGET AUDIENCE: ${industryAnalysis.targetAudience}\n\n`;
  
  // Copywriting strategy
  if (optimization.copywritingStrategy) {
    const strategy = optimization.copywritingStrategy;
    prompt += `BRAND STRATEGY:\n`;
    prompt += `• Tone: ${strategy.tone}\n`;
    prompt += `• Messaging: ${strategy.messagingFramework}\n`;
    if (strategy.keyBenefits) prompt += `• Key Benefits: ${strategy.keyBenefits.join(', ')}\n`;
    prompt += `\n`;
  }
  
  // Design principles
  if (optimization.designPrinciples?.length) {
    prompt += `DESIGN PRINCIPLES:\n`;
    optimization.designPrinciples.forEach(principle => {
      prompt += `• ${principle}\n`;
    });
    prompt += `\n`;
  }
  
  // Specific improvements
  if (optimization.improvements?.length) {
    prompt += `KEY IMPROVEMENTS TO IMPLEMENT:\n`;
    optimization.improvements.forEach(improvement => {
      prompt += `• ${improvement}\n`;
    });
    prompt += `\n`;
  }
  
  prompt += `Create CSS that maximizes conversions for this ${industryAnalysis.industry} business. Focus on trust, professionalism, and clear calls-to-action.`;
  
  return prompt;
}

// --- Enhanced JavaScript Generator ---

function generateEnhancedJs(industryAnalysis, optimization) {
  let js = `// Enhanced conversion-focused interactivity
// Industry: ${industryAnalysis.industry}

document.addEventListener('DOMContentLoaded', () => {
  console.log('Enhanced demo site loaded for: ${industryAnalysis.industry}');
  
  // Enhanced mobile menu
  const menuToggle = document.querySelector('.menu-toggle, .mobile-toggle, .hamburger');
  const nav = document.querySelector('nav ul, .nav-menu, .mobile-menu');
  
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      nav.classList.toggle('active');
      menuToggle.classList.toggle('active');
      document.body.classList.toggle('menu-open');
    });
  }

  // Conversion-focused scroll effects
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
      }
    });
  }, observerOptions);
  
  // Animate sections as they come into view
  document.querySelectorAll('section, .hero, .cta-section').forEach(el => {
    observer.observe(el);
  });

  // Enhanced CTA tracking and effects
  document.querySelectorAll('.cta, .btn-primary, .call-to-action').forEach(cta => {
    cta.addEventListener('click', (e) => {
      // Add conversion tracking here
      console.log('CTA clicked:', cta.textContent.trim());
      
      // Visual feedback
      cta.classList.add('clicked');
      setTimeout(() => cta.classList.remove('clicked'), 200);
    });
    
    // Hover effects for trust-building
    cta.addEventListener('mouseenter', () => {
      cta.classList.add('hover-enhanced');
    });
    
    cta.addEventListener('mouseleave', () => {
      cta.classList.remove('hover-enhanced');
    });
  });

  // Trust signal animations
  document.querySelectorAll('.trust-signal, .testimonial, .stats').forEach(element => {
    observer.observe(element);
  });

  // Smooth scrolling for all anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Sticky navigation with enhanced styling
  const header = document.querySelector('header');
  if (header) {
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;
      
      // Add scrolled class for styling
      header.classList.toggle('scrolled', currentScrollY > 50);
      
      // Hide/show header on scroll (optional)
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        header.classList.add('header-hidden');
      } else {
        header.classList.remove('header-hidden');
      }
      
      lastScrollY = currentScrollY;
    });
  }

  // Form enhancement (if forms exist)
  document.querySelectorAll('form').forEach(form => {
    const inputs = form.querySelectorAll('input, textarea');
    
    inputs.forEach(input => {
      // Enhanced focus states
      input.addEventListener('focus', () => {
        input.parentElement.classList.add('field-focused');
      });
      
      input.addEventListener('blur', () => {
        input.parentElement.classList.remove('field-focused');
        if (input.value) {
          input.parentElement.classList.add('field-filled');
        } else {
          input.parentElement.classList.remove('field-filled');
        }
      });
    });
    
    // Form submission tracking
    form.addEventListener('submit', (e) => {
      console.log('Form submission attempted');
      // Add conversion tracking here
    });
  });
  
  // Industry-specific enhancements
  ${generateIndustrySpecificJs(industryAnalysis.industry)}
});

// Add CSS animations for enhanced effects
const style = document.createElement('style');
style.textContent = \`
  .animate-in {
    animation: fadeInUp 0.6s ease-out forwards;
  }
  
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .cta.clicked {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }
  
  .hover-enhanced {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
  }
  
  .header-hidden {
    transform: translateY(-100%);
    transition: transform 0.3s ease;
  }
  
  .field-focused {
    transform: scale(1.02);
    transition: transform 0.2s ease;
  }
\`;
document.head.appendChild(style);
`;

  return js;
}

function generateIndustrySpecificJs(industry) {
  const industryEnhancements = {
    'Legal Services': `
    // Legal-specific trust enhancements
    document.querySelectorAll('.credential, .award, .license').forEach(el => {
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.05)';
      });
    });`,
    
    'Real Estate': `
    // Real estate property showcase
    document.querySelectorAll('.property, .listing').forEach(el => {
      el.addEventListener('click', () => {
        console.log('Property interest tracked');
      });
    });`,
    
    'Healthcare': `
    // Healthcare trust and accessibility
    document.querySelectorAll('.service, .treatment').forEach(el => {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
    });`,
    
    default: `
    // General business enhancements
    console.log('Industry-specific enhancements loaded for: ${industry}');`
  };
  
  return industryEnhancements[industry] || industryEnhancements.default;
}

// --- Helper Functions ---

function extractCodeBlock(content, language) {
  const regex = new RegExp('```' + language + '\\s*\\n([\\s\\S]*?)```');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}