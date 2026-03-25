/**
 * Email Service — sends demo notifications via GHL Email API
 */

/**
 * Send Email via GHL API
 */
export async function sendDemoEmail(contactId, demoUrl, name, email) {
  console.log(`[email] Sending demo email to contact ${contactId} (${email})`);
  
  try {
    const emailContent = generateEmailContent(name, demoUrl);
    const result = await sendGHLEmail(contactId, emailContent.subject, emailContent.body);
    
    console.log(`✅ Email sent to contact ${contactId}`);
    return { 
      sent: true, 
      method: 'ghl-email', 
      message: 'Email sent via GHL API',
      contactId 
    };
    
  } catch (error) {
    console.error(`❌ Email failed: ${error.message}`);
    return { 
      sent: false, 
      method: 'failed', 
      message: `Email failed - ${error.message}` 
    };
  }
}

async function sendGHLEmail(contactId, subject, body) {
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
      subject,
      body
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL Email API failed (${response.status}): ${text}`);
  }

  return response.json();
}

function generateEmailContent(name, demoUrl) {
  const firstName = name?.split(' ')[0] || 'there';
  
  const subject = `Your AI Website Demo is Ready! 🚀`;
  
  const body = `Hi ${firstName},

Your personalized AI website demo has been generated and is ready for preview!

🌐 View your demo: ${demoUrl}

This demo showcases how AI can transform your website with:
• Enhanced user experience 
• Improved conversion optimization
• Modern design elements
• AI-powered features

Questions? Simply reply to this email or contact our team.

Best regards,
The GHLU Team

---
This demo was generated using advanced AI technology to give you a preview of your website's potential.`;

  return { subject, body };
}