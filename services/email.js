/**
 * Email Trigger — sends demo email via GHL workflow
 * 
 * This triggers the demo delivery email through GHL's automation system.
 * The email template is configured in GHL with the following variables:
 * - {{contact.name}} or {{name}}
 * - {{ai_demo_website}} — the demo URL
 */

/**
 * Trigger demo email to prospect
 * In production, this will either:
 * 1. Trigger a GHL workflow via webhook, or
 * 2. Use GHL's email API directly
 * 
 * For now, logs the intent and returns success.
 * Connect to GHL workflow when automation is configured.
 */
export async function triggerDemoEmail(email, demoUrl, name) {
  console.log(`[email] Triggering demo email to ${email}`);
  console.log(`[email] Name: ${name}`);
  console.log(`[email] Demo URL: ${demoUrl}`);

  // Option 1: Trigger GHL workflow via webhook
  // const workflowWebhookUrl = process.env.GHL_DEMO_EMAIL_WEBHOOK;
  // if (workflowWebhookUrl) {
  //   await fetch(workflowWebhookUrl, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ email, demoUrl, name })
  //   });
  // }

  // Option 2: Direct GHL email API (requires email template ID)
  // await ghlRequest('POST', `/conversations/messages`, {
  //   contactId,
  //   type: 'Email',
  //   subject: 'Your AI Website Demo Is Ready',
  //   html: buildEmailHtml(name, demoUrl)
  // });

  return { sent: true, method: 'logged', message: 'Email trigger logged — connect GHL workflow to activate' };
}

/**
 * Email template for reference — to be configured in GHL
 */
export const EMAIL_TEMPLATE = {
  subject: 'Your AI Website Demo Is Ready',
  body: `Hi {{name}},

We built a live demo showing how AI would work directly on your website.

You can view it here:

{{ai_demo_website}}

Try asking the AI questions as if you were a customer visiting your site.

This shows how your website could automatically answer questions, capture leads, and convert visitors.

Let me know what you think.`
};
