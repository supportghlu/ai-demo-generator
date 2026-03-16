/**
 * GoHighLevel API Client
 * Docs: https://highlevel.stoplight.io/docs/integrations
 */

const BASE_URL = 'https://services.leadconnectorhq.com';

async function ghlRequest(method, path, body = null) {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) throw new Error('GHL_API_KEY not configured');

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Version': '2021-07-28'
    }
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${BASE_URL}${path}`, options);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GHL API ${method} ${path} failed (${response.status}): ${text}`);
  }

  return response.json();
}

/**
 * Find a contact by email
 */
export async function findContactByEmail(email) {
  try {
    const result = await ghlRequest('GET', `/contacts/search/duplicate?email=${encodeURIComponent(email)}`);
    return result?.contact || null;
  } catch (err) {
    console.error(`[ghl] findContactByEmail failed: ${err.message}`);
    return null;
  }
}

/**
 * Create a new contact
 */
export async function createContact({ name, email, phone, source }) {
  const nameParts = (name || '').split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  return ghlRequest('POST', '/contacts/', {
    firstName,
    lastName,
    email,
    phone,
    source: source || 'AI Website Demo',
    tags: ['ai-demo-prospect']
  });
}

/**
 * Update a contact's fields
 */
export async function updateContact(contactId, fields) {
  return ghlRequest('PUT', `/contacts/${contactId}`, fields);
}

/**
 * Update the AI Demo Website custom field on a contact
 */
export async function setDemoUrl(contactId, demoUrl, status = 'SUCCESS') {
  return updateContact(contactId, {
    customFields: [
      { key: 'ai_demo_website', value: demoUrl },
      { key: 'demo_status', value: status },
      { key: 'demo_generated_at', value: new Date().toISOString() }
    ]
  });
}

/**
 * Find or create a contact, then update with demo info
 */
export async function upsertContactWithDemo({ name, email, phone, demoUrl }) {
  let contact = await findContactByEmail(email);
  
  if (!contact) {
    const result = await createContact({ name, email, phone, source: 'AI Website Demo' });
    contact = result.contact;
  }

  if (contact?.id && demoUrl) {
    await setDemoUrl(contact.id, demoUrl);
  }

  return contact;
}
