#!/usr/bin/env node

/**
 * Quick System Health Check
 * Fast verification that all systems are operational
 */

import axios from 'axios';

const TESTS = [
  {
    name: 'Server Health',
    test: async () => {
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      return response.status === 200 && response.data.status === 'ok';
    }
  },
  {
    name: 'Demo Request Submission',
    test: async () => {
      const response = await axios.post('http://localhost:3000/webhook/demo-request', {
        name: 'Quick Test User',
        email: 'quicktest@example.com',
        website_url: 'https://example.com',
        test_mode: true
      }, { timeout: 10000 });
      return response.status === 200 && response.data.jobId;
    }
  },
  {
    name: 'Database Connection',
    test: async () => {
      try {
        const { default: Database } = await import('better-sqlite3');
        const db = new Database('./demo-generator.db');
        const result = db.prepare("SELECT COUNT(*) as count FROM jobs").get();
        db.close();
        return typeof result.count === 'number';
      } catch (error) {
        return false;
      }
    }
  },
  {
    name: 'Environment Variables',
    test: async () => {
      const { default: dotenv } = await import('dotenv');
      dotenv.config();
      
      const required = ['ANTHROPIC_API_KEY', 'GHL_API_KEY'];
      return required.every(key => !!process.env[key]);
    }
  }
];

async function runQuickCheck() {
  console.log('⚡ Quick System Health Check');
  console.log('=' * 40);
  
  let passed = 0;
  let failed = 0;
  
  for (const { name, test } of TESTS) {
    try {
      const result = await test();
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '=' * 40);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`Status: ${failed === 0 ? '✅ HEALTHY' : '⚠️  ISSUES DETECTED'}`);
  
  if (failed === 0) {
    console.log('\n🚀 System ready for demo generation!');
  } else {
    console.log('\n🔧 Please resolve issues before proceeding.');
  }
  
  return failed === 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runQuickCheck().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Quick check failed:', error.message);
    process.exit(1);
  });
}

export default runQuickCheck;