/**
 * SMS Service — sends demo notifications via GHL SMS API
 * 
 * Sends personalized SMS messages to prospects about their demo
 */

/**
 * Send SMS via GHL API
 */
export async function sendDemoSMS(contactId, demoUrl, name, analysisData = null) {
  console.log(`[sms] Sending demo SMS to contact ${contactId}`);
  
  try {
    const smsContent = generateSMSContent(name, demoUrl, analysisData);
    const result = await sendGHLSMS(contactId, smsContent);
    
    console.log(`✅ SMS sent to contact ${contactId}`);
    return { 
      sent: true, 
      method: 'ghl-sms', 
      message: 'SMS sent via GHL API',
      contactId 
    };
    
  } catch (error) {
    console.error(`❌ SMS failed: ${error.message}`);
    return { 
      sent: false, 
      method: 'failed', 
      message: `SMS failed - ${error.message}` 
    };
  }
}

async function sendGHLSMS(contactId, message) {
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
      type: 'SMS',
      contactId,
      message
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL SMS API failed (${response.status}): ${text}`);
  }

  return response.json();
}

function generateSMSContent(name, demoUrl, analysisData) {
  const firstName = name?.split(' ')[0] || 'there';
  
  if (analysisData?.industry) {
    return `Hi ${firstName}! Your ${analysisData.industry} AI demo is ready. See how AI can help your business: ${demoUrl} - GHLU Team`;
  }
  
  // Generic fallback
  return `Hi ${firstName}! Your AI website demo is ready. Check it out: ${demoUrl} - GHLU Team`;
}