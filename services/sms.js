/**
 * SMS Service — sends demo notifications via GHL SMS API
 */

/**
 * Send SMS via GHL API
 */
export async function sendDemoSMS(contactId, demoUrl, name, analysis = null) {
  console.log(`[sms] Sending demo SMS to contact ${contactId}`);

  try {
    const smsContent = generateSMSContent(name, demoUrl, analysis);
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

function generateSMSContent(name, demoUrl, analysis) {
  const firstName = name?.split(' ')[0] || 'there';

  if (analysis?.issues?.length) {
    const issueCount = analysis.issues.length;
    // Pick the most impactful issue (first one)
    const topIssue = analysis.issues[0].replace(/^No\s+/i, 'no ').replace(/\.$/, '');
    return `Hi ${firstName}, we analysed your website and found ${issueCount} areas to improve — including ${topIssue}. We've built a free enhanced demo with AI chat & voice assistants included. Take a look: ${demoUrl} — GHLU Team`;
  }

  return `Hi ${firstName}! Your AI website demo is ready — complete with AI chat & voice assistants. Check it out: ${demoUrl} — GHLU Team`;
}
