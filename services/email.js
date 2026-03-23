/**
 * Personalized Email Service — sends demo email via GHL direct API
 * 
 * Creates personalized emails based on website analysis and sends via GHL.
 * Uses industry analysis to create relevant, specific messaging.
 */

import { findContactByEmail, createContact } from './ghl.js';

/**
 * Trigger personalized demo email to prospect using direct GHL API
 */
export async function triggerDemoEmail(email, demoUrl, name, analysisData = null, websiteUrl = null) {
  console.log(`[email] Triggering personalized demo email to ${email}`);
  
  try {
    // Get contact ID first
    const contact = await findOrCreateContact(email, name);
    if (!contact?.id) {
      throw new Error('Could not find or create contact in GHL');
    }

    // Generate personalized email content
    const emailContent = await generatePersonalizedEmail(name, demoUrl, analysisData, websiteUrl);
    
    // Send via GHL Conversations API
    const result = await sendGHLEmail(contact.id, emailContent);
    
    console.log(`✅ Personalized email sent to ${email} via GHL`);
    return { 
      sent: true, 
      method: 'ghl-direct', 
      message: 'Personalized email sent via GHL API',
      contactId: contact.id 
    };
    
  } catch (error) {
    console.error(`❌ Email failed: ${error.message}`);
    
    // Fallback to logging
    console.log(`[email] Fallback: Demo URL ${demoUrl} for ${name} (${email})`);
    return { 
      sent: false, 
      method: 'logged', 
      message: `Email failed - ${error.message}`, 
      demoUrl 
    };
  }
}

// --- Helper Functions ---

async function findOrCreateContact(email, name) {
  let contact = await findContactByEmail(email);
  
  if (!contact) {
    const result = await createContact({ 
      name, 
      email, 
      source: 'AI Website Demo' 
    });
    contact = result.contact;
  }
  
  return contact;
}

async function sendGHLEmail(contactId, emailContent) {
  const BASE_URL = 'https://services.leadconnectorhq.com';
  const apiKey = process.env.GHL_API_KEY;
  
  if (!apiKey) throw new Error('GHL_API_KEY not configured');

  const response = await fetch(`${BASE_URL}/conversations/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    },
    body: JSON.stringify({
      type: 'Email',
      contactId,
      subject: emailContent.subject,
      html: emailContent.html
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL Email API failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function generatePersonalizedEmail(name, demoUrl, analysisData, websiteUrl) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  
  if (!anthropicKey || !analysisData) {
    // Fallback to generic template if no AI or analysis data
    return generateGenericEmail(name, demoUrl, websiteUrl);
  }

  try {
    const prompt = buildPersonalizationPrompt(name, demoUrl, analysisData, websiteUrl);
    const emailContent = await callAnthropicForEmail(anthropicKey, prompt);
    return parseEmailResponse(emailContent);
    
  } catch (error) {
    console.warn(`[email] Personalization failed, using generic: ${error.message}`);
    return generateGenericEmail(name, demoUrl, websiteUrl);
  }
}

function generateGenericEmail(name, demoUrl, websiteUrl) {
  const firstName = name?.split(' ')[0] || 'there';
  const domain = websiteUrl ? new URL(websiteUrl).hostname : 'your website';
  
  return {
    subject: `Your AI Website Demo Is Ready`,
    html: `
      <p>Hi ${firstName},</p>
      
      <p>We've built a live demo showing how AI would work directly on ${domain}.</p>
      
      <p><strong><a href="${demoUrl}">View Your AI Demo Here</a></strong></p>
      
      <p>Try asking the AI questions as if you were a customer visiting your site. This shows how your website could:</p>
      <ul>
        <li>Automatically answer customer questions</li>
        <li>Capture leads 24/7</li>
        <li>Convert more visitors into customers</li>
      </ul>
      
      <p>The demo is live and ready to test. Let me know what you think!</p>
      
      <p>Best regards,<br>
      The GHLU Team</p>
    `
  };
}

function buildPersonalizationPrompt(name, demoUrl, analysisData, websiteUrl) {
  return `Create a personalized email for ${name} about their AI website demo.

WEBSITE ANALYSIS DATA:
- Industry: ${analysisData.industry}
- Business Type: ${analysisData.businessType}
- Target Audience: ${analysisData.targetAudience}
- Website URL: ${websiteUrl}
- Optimization Score: ${analysisData.optimizationScore}/10
- Key Issues: ${analysisData.criticalIssues?.join(', ')}
- Opportunities: ${analysisData.optimizationOpportunities?.slice(0, 3).join(', ')}

DEMO URL: ${demoUrl}

Create an email that:
1. References their specific industry/business
2. Mentions 1-2 specific opportunities from the analysis
3. Explains how AI would help their target audience
4. Uses their name naturally
5. Includes a clear call-to-action to test the demo

Keep it professional but conversational. 2-3 paragraphs max.

Return in this JSON format:
{
  "subject": "subject line with their industry context",
  "html": "HTML email content with <p> tags and <a href> for demo link"
}`;
}

async function callAnthropicForEmail(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'claude-3-haiku-20240307',
      max_tokens: 1000,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const result = await response.json();
  return result.content[0].text;
}

function parseEmailResponse(response) {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.warn('[email] Failed to parse AI response, extracting manually');
    
    // Fallback parsing
    const subjectMatch = response.match(/subject['":\s]*([^"'\n]+)/i);
    const htmlMatch = response.match(/html['":\s]*["']([^"']+)["']/i);
    
    return {
      subject: subjectMatch?.[1] || 'Your AI Website Demo Is Ready',
      html: htmlMatch?.[1] || response
    };
  }
}
