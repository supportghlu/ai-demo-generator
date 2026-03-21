/**
 * Conversion Optimization Service
 * Takes industry analysis and creates optimized website design recommendations
 */

/**
 * Generate optimized website design based on industry analysis
 * @param {object} scrapedData - Original website data
 * @param {object} industryAnalysis - Output from industry-analyzer.js
 * @param {string} originalUrl - Original website URL
 * @returns {Promise<{success: boolean, optimization?: object, error?: string}>}
 */
export async function optimizeForConversion(scrapedData, industryAnalysis, originalUrl) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    return { success: false, error: 'No AI API key configured for optimization' };
  }

  const provider = anthropicKey ? 'Anthropic' : 'OpenAI';
  console.log(`[conversion-optimizer] Optimizing for ${industryAnalysis.industry}...`);

  try {
    const optimizationPrompt = buildOptimizationPrompt(scrapedData, industryAnalysis, originalUrl);
    
    let optimizationResponse = anthropicKey 
      ? await callAnthropic(anthropicKey, OPTIMIZATION_SYSTEM, optimizationPrompt)
      : await callOpenAI(openaiKey, OPTIMIZATION_SYSTEM, optimizationPrompt);

    const optimization = parseOptimizationResponse(optimizationResponse);
    
    if (!optimization.optimizedStructure) {
      return { success: false, error: 'Failed to generate optimization recommendations' };
    }

    console.log(`[conversion-optimizer] Optimization complete: ${optimization.improvements.length} improvements identified`);
    return { success: true, optimization };

  } catch (err) {
    console.error(`[conversion-optimizer] Optimization failed:`, err);
    return { success: false, error: `Conversion optimization failed: ${err.message}` };
  }
}

// --- Optimization System Prompt ---

const OPTIMIZATION_SYSTEM = `You are a conversion rate optimization expert specializing in industry-specific website improvements.

Given an industry analysis and original website data, create a detailed optimization plan that dramatically improves conversion rates.

Focus on:
1. Industry-specific conversion elements
2. Psychological triggers for the target audience  
3. Optimized page structure and flow
4. Enhanced copywriting and messaging
5. Strategic placement of trust signals
6. Mobile-first responsive design
7. Conversion-focused calls-to-action

Respond in this EXACT JSON format:
{
  "optimizedStructure": {
    "hero": {
      "headline": "conversion-optimized headline",
      "subheadline": "supporting subheadline", 
      "cta": "primary call-to-action text",
      "trustElement": "trust signal (testimonial quote, stat, etc)"
    },
    "sections": [
      {
        "type": "section type (problem, solution, benefits, social-proof, etc)",
        "headline": "section headline",
        "content": "optimized content description",
        "cta": "section call-to-action if applicable"
      }
    ],
    "footer": {
      "trustSignals": ["trust elements for footer"],
      "contactInfo": "optimized contact presentation"
    }
  },
  "improvements": [
    "specific conversion improvements made"
  ],
  "copywritingStrategy": {
    "tone": "optimized tone for target audience",
    "messagingFramework": "core messaging strategy",
    "keyBenefits": ["primary benefits to emphasize"]
  },
  "conversionElements": [
    "specific high-converting elements to include"
  ],
  "designPrinciples": [
    "design principles for maximum conversion"
  ],
  "industrySpecific": [
    "industry-specific optimization tactics"
  ]
}

Make this SIGNIFICANTLY better than the original. This should be a high-converting version.`;

// --- API Callers ---

async function callAnthropic(apiKey, systemPrompt, userPrompt) {
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
      temperature: 0.4,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${errText}`);
  }

  const result = await response.json();
  return result.content?.[0]?.text || '';
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
      temperature: 0.4,
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

// --- Prompt Builder ---

function buildOptimizationPrompt(scrapedData, industryAnalysis, originalUrl) {
  let prompt = `Create a conversion-optimized website design based on this analysis:\n\n`;
  
  // Original website context
  prompt += `ORIGINAL WEBSITE:\n`;
  prompt += `URL: ${originalUrl}\n`;
  prompt += `Title: ${scrapedData.title}\n`;
  if (scrapedData.metaDescription) prompt += `Description: ${scrapedData.metaDescription}\n`;
  
  // Industry analysis context
  prompt += `\nINDUSTRY ANALYSIS:\n`;
  prompt += `Industry: ${industryAnalysis.industry}\n`;
  prompt += `Business Type: ${industryAnalysis.businessType}\n`;
  prompt += `Target Audience: ${industryAnalysis.targetAudience}\n`;
  prompt += `Current Score: ${industryAnalysis.optimizationScore}/10\n`;
  
  if (industryAnalysis.criticalIssues?.length) {
    prompt += `\nCritical Issues:\n`;
    industryAnalysis.criticalIssues.forEach(issue => {
      prompt += `• ${issue}\n`;
    });
  }
  
  if (industryAnalysis.optimizationOpportunities?.length) {
    prompt += `\nOptimization Opportunities:\n`;
    industryAnalysis.optimizationOpportunities.forEach(opp => {
      prompt += `• ${opp}\n`;
    });
  }
  
  if (industryAnalysis.industryBestPractices?.length) {
    prompt += `\nIndustry Best Practices:\n`;
    industryAnalysis.industryBestPractices.forEach(practice => {
      prompt += `• ${practice}\n`;
    });
  }

  // Original content for reference
  if (scrapedData.headings?.length) {
    prompt += `\nOriginal Key Headings:\n`;
    scrapedData.headings.slice(0, 10).forEach(h => {
      prompt += `  ${h.level}: ${h.text}\n`;
    });
  }

  if (scrapedData.sections?.length) {
    prompt += `\nOriginal Content Sections:\n`;
    scrapedData.sections.slice(0, 6).forEach((section, i) => {
      prompt += `  ${i + 1}. ${section.textPreview.substring(0, 150)}\n`;
    });
  }

  prompt += `\nCreate a dramatically improved, conversion-optimized version in the specified JSON format. `;
  prompt += `This should be industry-specific and significantly better than the original.`;
  
  return prompt;
}

// --- Response Parser ---

function parseOptimizationResponse(response) {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Try parsing the whole response
    return JSON.parse(response);
  } catch (err) {
    console.error('[conversion-optimizer] Failed to parse optimization response:', err);
    
    // Fallback optimization structure
    return {
      optimizedStructure: {
        hero: {
          headline: 'Transform Your Business Today',
          subheadline: 'Get proven results with our industry-leading solutions',
          cta: 'Get Started Now',
          trustElement: 'Join thousands of satisfied customers'
        },
        sections: [
          {
            type: 'problem',
            headline: 'The Challenge',
            content: 'Identify the main problem your audience faces',
            cta: null
          },
          {
            type: 'solution', 
            headline: 'Our Solution',
            content: 'How we solve that problem better than anyone else',
            cta: 'Learn More'
          },
          {
            type: 'social-proof',
            headline: 'Proven Results',
            content: 'Customer success stories and testimonials',
            cta: 'See All Results'
          }
        ],
        footer: {
          trustSignals: ['Money-back guarantee', '24/7 support'],
          contactInfo: 'Multiple ways to get in touch'
        }
      },
      improvements: ['Fallback optimization - manual review needed'],
      copywritingStrategy: {
        tone: 'Professional and trustworthy',
        messagingFramework: 'Problem-solution-proof',
        keyBenefits: ['Quality', 'Results', 'Support']
      },
      conversionElements: ['Strong headlines', 'Clear CTAs', 'Social proof'],
      designPrinciples: ['Clean layout', 'Mobile responsive', 'Fast loading'],
      industrySpecific: ['Generic optimization - needs customization']
    };
  }
}