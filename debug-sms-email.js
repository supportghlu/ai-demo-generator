#!/usr/bin/env node

/**
 * Debug SMS/Email Delivery Issues
 * Direct test of the GHL services with detailed logging
 */

import dotenv from 'dotenv';
import { sendDemoSMS } from './services/sms.js';
import { sendDemoEmail } from './services/email.js';
import { upsertContactWithDemo } from './services/ghl.js';

dotenv.config();

console.log('🔍 DEBUG: SMS/EMAIL DELIVERY ISSUES');
console.log('=' .repeat(40));

async function debugDelivery() {
  const testData = {
    name: 'Debug Test User',
    email: 'debug@ghluni.com',
    phone: '+1234567890',
    demoUrl: 'https://ai-demo-generator-v3-production.up.railway.app/demo/debug-test'
  };

  console.log('📋 Test Data:');
  console.log(`Name: ${testData.name}`);
  console.log(`Email: ${testData.email}`);
  console.log(`Phone: ${testData.phone}`);
  console.log(`Demo URL: ${testData.demoUrl}`);
  console.log('');

  try {
    // Step 1: Test contact upsert
    console.log('🔍 STEP 1: Testing Contact Upsert');
    const contact = await upsertContactWithDemo(testData);
    
    if (!contact) {
      console.log('❌ Contact upsert failed - returned null');
      return;
    }
    
    console.log(`✅ Contact upsert successful: ${contact.id}`);
    console.log(`📧 Email: ${contact.email}`);
    console.log(`📞 Phone: ${contact.phone}`);
    console.log('');

    // Step 2: Test SMS delivery
    console.log('🔍 STEP 2: Testing SMS Delivery');
    try {
      const smsResult = await sendDemoSMS(contact.id, testData.demoUrl, testData.name);
      console.log(`SMS Result:`, smsResult);
      
      if (smsResult.sent) {
        console.log('✅ SMS delivery successful');
      } else {
        console.log(`❌ SMS delivery failed: ${smsResult.message}`);
      }
    } catch (smsError) {
      console.log(`❌ SMS error: ${smsError.message}`);
      console.log(`SMS Stack:`, smsError.stack);
    }
    
    console.log('');

    // Step 3: Test Email delivery
    console.log('🔍 STEP 3: Testing Email Delivery');
    try {
      const emailResult = await sendDemoEmail(contact.id, testData.demoUrl, testData.name, testData.email);
      console.log(`Email Result:`, emailResult);
      
      if (emailResult.sent) {
        console.log('✅ Email delivery successful');
      } else {
        console.log(`❌ Email delivery failed: ${emailResult.message}`);
      }
    } catch (emailError) {
      console.log(`❌ Email error: ${emailError.message}`);
      console.log(`Email Stack:`, emailError.stack);
    }

  } catch (error) {
    console.log(`❌ Debug failed: ${error.message}`);
    console.log(`Stack:`, error.stack);
  }
}

// Run debug
await debugDelivery();

console.log('\n🏁 DEBUG COMPLETE');
console.log('Check logs above for specific failure points');