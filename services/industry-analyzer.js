/**
 * Industry Analysis Service
 * Analyzes websites to identify industry, target audience, and optimization opportunities
 */

/**
 * Analyze website industry and optimization opportunities
 * @param {object} scrapedData - Output from scraper.js
 * @param {string} originalUrl - The original website URL
 * @returns {Promise<{success: boolean, analysis?: object, error?: string}>}
 */
export async function analyzeIndustry(scrapedData, originalUrl) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!anthropicKey && !openaiKey) {
    return { success: false, error: 'No AI API key configured for industry analysis' };
  }

  const provider = anthropicKey ? 'Anthropic' : 'OpenAI';
  console.log(`[industry-analyzer] Analyzing ${originalUrl} via ${provider}...`);

  try {
    const analysisPrompt = buildAnalysisPrompt(scrapedData, originalUrl);
    
    let analysisResponse = anthropicKey 
      ? await callAnthropic(anthropicKey, ANALYSIS_SYSTEM, analysisPrompt)
      : await callOpenAI(openaiKey, ANALYSIS_SYSTEM, analysisPrompt);

    // Parse structured response
    const analysis = parseAnalysisResponse(analysisResponse);
    
    if (!analysis.industry) {
      return { success: false, error: 'Failed to identify industry from analysis' };
    }

    console.log(`[industry-analyzer] Analysis complete: ${analysis.industry} | ${analysis.optimizationScore}/10`);
    return { success: true, analysis };

  } catch (err) {
    console.error(`[industry-analyzer] Analysis failed:`, err);
    return { success: false, error: `Industry analysis failed: ${err.message}` };
  }
}

// --- Analysis System Prompt ---

const ANALYSIS_SYSTEM = `You are an expert website conversion specialist and industry analyst. Analyze websites to identify:

1. INDUSTRY & BUSINESS TYPE
2. TARGET AUDIENCE  
3. CONVERSION OPTIMIZATION OPPORTUNITIES
4. DESIGN & UX IMPROVEMENTS
5. INDUSTRY-SPECIFIC BEST PRACTICES

Respond in this EXACT JSON format:
{
  "industry": "specific industry (e.g., 'Legal Services', 'E-commerce Fashion', 'SaaS B2B')",
  "subIndustry": "specific niche if applicable",
  "businessType": "business model (B2B, B2C, Service, Product, etc)",
  "targetAudience": "primary target audience description",
  "optimizationScore": "current website score 1-10",
  "criticalIssues": [
    "list of major conversion problems"
  ],
  "optimizationOpportunities": [
    "specific improvements for this industry"
  ],
  "industryBestPractices": [
    "what high-converting sites in this industry do"
  ],
  "recommendedStructure": {
    "hero": "hero section recommendations",
    "socialProof": "social proof strategy for this industry", 
    "cta": "call-to-action best practices",
    "layout": "optimal page structure"
  },
  "conversionElements": [
    "specific elements that drive conversions in this industry"
  ]
}

Be specific to the industry. Generic advice is not helpful.`;

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
      temperature: 0.3,
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

// --- Prompt Builder ---

function buildAnalysisPrompt(scrapedData, originalUrl) {
  let prompt = `Analyze this website for industry and conversion optimization:\n\n`;
  prompt += `URL: ${originalUrl}\n`;
  prompt += `Title: ${scrapedData.title || 'Unknown'}\n`;
  
  if (scrapedData.metaDescription) {
    prompt += `Description: ${scrapedData.metaDescription}\n`;
  }
  
  if (scrapedData.navigation?.length) {
    prompt += `Navigation: ${scrapedData.navigation.map(n => n.text).slice(0, 8).join(' | ')}\n`;
  }

  if (scrapedData.headings?.length) {
    prompt += `\nKey Headings:\n`;
    scrapedData.headings.slice(0, 15).forEach(h => {
      prompt += `  ${h.level}: ${h.text}\n`;
    });
  }

  if (scrapedData.sections?.length) {
    prompt += `\nContent Sections:\n`;
    scrapedData.sections.slice(0, 8).forEach((section, i) => {
      prompt += `  ${i + 1}. ${section.textPreview.substring(0, 200)}\n`;
    });
  }

  if (scrapedData.forms?.length) {
    prompt += `\nForms: ${scrapedData.forms.length} contact/lead forms found\n`;
  }

  prompt += `\nProvide detailed industry analysis and optimization recommendations in the specified JSON format.`;
  
  return prompt;
}

// --- Response Parser ---

function parseAnalysisResponse(response) {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    // Fallback: try parsing the whole response
    return JSON.parse(response);
  } catch (err) {
    console.error('[industry-analyzer] Failed to parse analysis response:', err);
    
    // Fallback: extract basic industry info manually
    return {
      industry: extractIndustryFallback(response),
      optimizationScore: 5,
      criticalIssues: ['Analysis parsing failed - manual review needed'],
      optimizationOpportunities: ['Full analysis could not be parsed'],
      businessType: 'Unknown',
      targetAudience: 'Analysis failed to parse'
    };
  }
}

function extractIndustryFallback(response) {
  const industryKeywords = {
    'legal': ['law', 'legal', 'attorney', 'lawyer', 'court'],
    'healthcare': ['health', 'medical', 'doctor', 'clinic', 'wellness'],
    'real estate': ['real estate', 'property', 'homes', 'realtor'],
    'ecommerce': ['shop', 'buy', 'product', 'cart', 'store'],
    'saas': ['software', 'saas', 'platform', 'subscription'],
    'consulting': ['consulting', 'consultant', 'advisory', 'strategy'],
    'fitness': ['fitness', 'gym', 'workout', 'training', 'exercise'],
    'restaurant': ['restaurant', 'food', 'menu', 'dining', 'cafe']
  };
  
  const text = response.toLowerCase();
  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return industry.charAt(0).toUpperCase() + industry.slice(1);
    }
  }
  
  return 'General Business';
}