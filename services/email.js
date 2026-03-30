/**
 * Email Service — sends demo notifications via GHL Email API
 */

/**
 * Send Email via GHL API
 */
export async function sendDemoEmail(contactId, demoUrl, name, email, analysis = null) {
  console.log(`[email] Sending demo email to contact ${contactId} (${email})`);

  try {
    const emailContent = generateEmailContent(name, demoUrl, analysis);
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
      html: body
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL Email API failed (${response.status}): ${text}`);
  }

  return response.json();
}

function generateEmailContent(name, demoUrl, analysis) {
  const firstName = name?.split(' ')[0] || 'there';

  const subject = analysis?.businessName
    ? `${firstName}, we've analysed your ${analysis.businessName} website`
    : `Your AI Website Demo is Ready`;

  let body;

  if (analysis?.issues?.length && analysis?.improvements?.length) {
    const issuesHtml = analysis.issues
      .map(i => `<li style="margin-bottom:8px;color:#dc2626;">${escapeHtml(i)}</li>`)
      .join('\n');

    const improvementsHtml = analysis.improvements
      .map(i => `<li style="margin-bottom:8px;color:#16a34a;">${escapeHtml(i)}</li>`)
      .join('\n');

    body = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">

    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your Website Analysis</h1>
        <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">Powered by GHLU</p>
      </div>

      <!-- Body -->
      <div style="padding:32px 24px;">

        <p style="font-size:16px;color:#1f2937;margin:0 0 24px;">Hi ${escapeHtml(firstName)},</p>

        <p style="font-size:15px;color:#374151;margin:0 0 24px;line-height:1.6;">
          We've analysed your website and built an enhanced demo to show you what's possible. Here's what we found:
        </p>

        <!-- Issues -->
        <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
          <h2 style="margin:0 0 12px;font-size:15px;color:#991b1b;font-weight:700;">
            \u{1F50D} What we found on your current site
          </h2>
          <ul style="margin:0;padding:0 0 0 20px;font-size:14px;line-height:1.6;">
            ${issuesHtml}
          </ul>
        </div>

        <!-- Improvements -->
        <div style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
          <h2 style="margin:0 0 12px;font-size:15px;color:#166534;font-weight:700;">
            \u{2705} What we improved in your demo
          </h2>
          <ul style="margin:0;padding:0 0 0 20px;font-size:14px;line-height:1.6;">
            ${improvementsHtml}
          </ul>
        </div>

        <!-- CTA Button -->
        <div style="text-align:center;margin:32px 0;">
          <a href="${escapeHtml(demoUrl)}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;">
            View Your Enhanced Demo \u{2192}
          </a>
        </div>

        <!-- AI Highlight -->
        <div style="background:#f5f3ff;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <h3 style="margin:0 0 8px;font-size:14px;color:#5b21b6;font-weight:700;">
            \u{1F916} AI-Powered Features Included
          </h3>
          <p style="margin:0;font-size:13px;color:#6b21a8;line-height:1.6;">
            Your demo includes an <strong>AI chat assistant</strong> and <strong>AI voice agent</strong> that can handle customer enquiries, bookings, and support around the clock — so you never miss a lead, even outside business hours.
          </p>
        </div>

        <p style="font-size:14px;color:#6b7280;margin:0;line-height:1.6;">
          Want to discuss how we can bring these improvements to your live site? Simply reply to this email — we'd love to help.
        </p>

      </div>

      <!-- Footer -->
      <div style="background:#f9fafb;padding:20px 24px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          Sent by the GHLU Team &middot; AI-powered website analysis
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;
  } else {
    // Fallback — no analysis available
    body = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">

    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">Your AI Website Demo is Ready</h1>
        <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">Powered by GHLU</p>
      </div>

      <div style="padding:32px 24px;">

        <p style="font-size:16px;color:#1f2937;margin:0 0 24px;">Hi ${escapeHtml(firstName)},</p>

        <p style="font-size:15px;color:#374151;margin:0 0 24px;line-height:1.6;">
          Your personalised AI website demo has been generated and is ready for preview.
        </p>

        <div style="background:#f5f3ff;border-radius:8px;padding:20px 24px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.8;">
            Your demo includes:<br>
            \u{2728} Premium redesign of your current website<br>
            \u{1F916} AI-powered chat assistant for instant customer support<br>
            \u{1F3A4} AI voice agent for natural, hands-free enquiries<br>
            \u{1F4F1} Mobile-optimised responsive design
          </p>
        </div>

        <div style="text-align:center;margin:32px 0;">
          <a href="${escapeHtml(demoUrl)}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:700;">
            View Your Demo \u{2192}
          </a>
        </div>

        <p style="font-size:14px;color:#6b7280;margin:0;line-height:1.6;">
          Questions? Simply reply to this email or contact our team.
        </p>

      </div>

      <div style="background:#f9fafb;padding:20px 24px;border-top:1px solid #e5e7eb;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          Sent by the GHLU Team &middot; AI-powered website analysis
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;
  }

  return { subject, body };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
