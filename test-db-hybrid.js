#!/usr/bin/env node
/**
 * Test the hybrid database system
 */

import { createJob, getJob, getJobStats, hasFileStorage, backend } from './db-hybrid.js';
import { v4 as uuidv4 } from 'uuid';

console.log('🧪 Testing Hybrid Database System');
console.log(`   Backend: ${backend}`);
console.log(`   File Storage: ${hasFileStorage ? 'Yes (PostgreSQL)' : 'No (SQLite)'}`);

async function testDatabase() {
  try {
    // Test job creation
    const testJobId = uuidv4();
    console.log('\n📋 Testing job creation...');
    
    const newJob = await createJob(
      testJobId,
      'Test User',
      'test@example.com',
      '+1234567890',
      'https://example.com',
      null,
      'Test Company'
    );
    
    console.log('✅ Job created:', newJob.id);

    // Test job retrieval
    const retrievedJob = await getJob(testJobId);
    console.log('✅ Job retrieved:', retrievedJob ? 'success' : 'failed');

    // Test stats
    const stats = await getJobStats();
    console.log('✅ Job stats:', stats);

    console.log('\n🎯 Database test completed successfully!');
    
    if (hasFileStorage) {
      console.log('💾 PostgreSQL is active - demos will survive container restarts');
    } else {
      console.log('⚠️  SQLite is active - demos will be lost on container restart');
      console.log('   Set DATABASE_URL environment variable to enable PostgreSQL');
    }

    return true;
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    return false;
  }
}

// Run test
testDatabase().then(success => {
  if (success) {
    console.log('\n✅ Hybrid database system is working correctly');
  } else {
    console.log('\n❌ Database system has issues');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test script error:', error.message);
  process.exit(1);
});