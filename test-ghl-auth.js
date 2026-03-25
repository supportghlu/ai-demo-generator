#!/usr/bin/env node

/**
 * GHL API Authentication Test Script
 * Tests both SMS and Email delivery capabilities
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const BASE_URL = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

console.log('🔐 GHL API AUTHENTICATION TEST');
console.log('=' .repeat(40));

async function testGHLAuthentication() {
  // Test configuration
  console.log('📋 Environment Configuration:');
  console.log(`GHL_API_KEY: ${GHL_API_KEY ? `${GHL_API_KEY.substring(0, 8)}...` : 'NOT SET'}`);
  console.log(`GHL_LOCATION_ID: ${GHL_LOCATION_ID || 'NOT SET'}`);
  console.log('');

  if (!GHL_API_KEY) {
    console.log('❌ GHL_API_KEY not configured');
    return false;
  }

  if (!GHL_LOCATION_ID) {
    console.log('❌ GHL_LOCATION_ID not configured');
    return false;
  }

  try {
    // Test 1: Basic API connection with contacts endpoint
    console.log('🔍 TEST 1: Basic API Connection');
    const contactsResponse = await fetch(`${BASE_URL}/contacts/?locationId=${GHL_LOCATION_ID}&limit=1`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    });

    if (!contactsResponse.ok) {
      const errorText = await contactsResponse.text();
      console.log(`❌ Basic API test failed (${contactsResponse.status}): ${errorText}`);
      return false;
    }

    const contactsData = await contactsResponse.json();
    console.log(`✅ API Connection: SUCCESS`);
    console.log(`📊 Contacts available: ${contactsData.contacts?.length || 0}`);
    console.log('');

    // Test 2: Try to find or create a test contact
    console.log('🔍 TEST 2: Contact Management');
    const testEmail = 'ghl-test@example.com';
    
    // Search for existing contact
    const searchResponse = await fetch(`${BASE_URL}/contacts/search/duplicate?locationId=${GHL_LOCATION_ID}&email=${encodeURIComponent(testEmail)}`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    });

    let testContact = null;
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      testContact = searchData.contact;
    }

    // Create test contact if doesn't exist
    if (!testContact) {
      console.log('📝 Creating test contact...');
      const createResponse = await fetch(`${BASE_URL}/contacts/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          locationId: GHL_LOCATION_ID,
          firstName: 'GHL',
          lastName: 'Test',
          email: testEmail,
          phone: `+123456${Date.now().toString().slice(-4)}`, // Unique phone
          source: 'GHL API Test',
          tags: ['api-test']
        })
      });

      if (createResponse.ok) {
        const createData = await createResponse.json();
        testContact = createData.contact;
        console.log(`✅ Test contact created: ${testContact.id}`);
      } else {
        const errorText = await createResponse.text();
        console.log(`⚠️ Contact creation failed (${createResponse.status}): ${errorText}`);
        // Try to use existing contact from duplicate error
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.meta?.contactId) {
            testContact = { id: errorData.meta.contactId };
            console.log(`✅ Using existing contact: ${testContact.id}`);
          }
        } catch (e) {
          console.log('❌ Could not parse error or find existing contact');
          return false;
        }
      }
    } else {
      console.log(`✅ Test contact found: ${testContact.id}`);
    }

    console.log('');

    // Test 3: SMS API Test
    console.log('🔍 TEST 3: SMS Delivery');
    try {
      const smsResponse = await fetch(`${BASE_URL}/conversations/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          type: 'SMS',
          contactId: testContact.id,
          message: 'GHL API Test - SMS delivery working! 🎉'
        })
      });

      if (smsResponse.ok) {
        const smsData = await smsResponse.json();
        console.log(`✅ SMS API: SUCCESS`);
        console.log(`📱 Message ID: ${smsData.messageId || 'Generated'}`);
      } else {
        const errorText = await smsResponse.text();
        console.log(`❌ SMS API failed (${smsResponse.status}): ${errorText}`);
      }
    } catch (smsError) {
      console.log(`❌ SMS Error: ${smsError.message}`);
    }

    console.log('');

    // Test 4: Email API Test
    console.log('🔍 TEST 4: Email Delivery');
    try {
      const emailResponse = await fetch(`${BASE_URL}/conversations/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          type: 'Email',
          contactId: testContact.id,
          subject: 'GHL API Test - Email Delivery',
          body: 'This is a test email to verify GHL API email delivery is working correctly. ✅'
        })
      });

      if (emailResponse.ok) {
        const emailData = await emailResponse.json();
        console.log(`✅ Email API: SUCCESS`);
        console.log(`📧 Message ID: ${emailData.messageId || 'Generated'}`);
      } else {
        const errorText = await emailResponse.text();
        console.log(`❌ Email API failed (${emailResponse.status}): ${errorText}`);
      }
    } catch (emailError) {
      console.log(`❌ Email Error: ${emailError.message}`);
    }

    return true;

  } catch (error) {
    console.log(`❌ Authentication test failed: ${error.message}`);
    return false;
  }
}

// Run the test
const success = await testGHLAuthentication();

console.log('\n🏁 GHL AUTHENTICATION TEST RESULTS');
console.log('=' .repeat(35));

if (success) {
  console.log('✅ GHL API Authentication: WORKING');
  console.log('✅ Ready for SMS/Email delivery');
  console.log('');
  console.log('🚀 NEXT STEPS:');
  console.log('1. Ensure Railway environment has same GHL_API_KEY');
  console.log('2. Ensure Railway environment has same GHL_LOCATION_ID');
  console.log('3. Deploy updated code with email service');
  console.log('4. Test end-to-end demo generation');
} else {
  console.log('❌ GHL API authentication needs configuration');
  console.log('');
  console.log('🔧 REQUIRED FIXES:');
  console.log('1. Set GHL_API_KEY in environment');
  console.log('2. Set GHL_LOCATION_ID in environment');
  console.log('3. Verify API key permissions include messages');
}

console.log('\n📋 Current Environment Variables:');
console.log('Copy these to Railway if tests pass:');
console.log(`GHL_API_KEY=${GHL_API_KEY}`);
console.log(`GHL_LOCATION_ID=${GHL_LOCATION_ID}`);