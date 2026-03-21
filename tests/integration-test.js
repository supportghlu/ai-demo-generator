#!/usr/bin/env node

/**
 * Full Integration Test
 * Tests complete demo generation workflow including job completion
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

const TEST_CONFIG = {
  serverUrl: 'http://localhost:3000',
  pollInterval: 2000, // Check every 2 seconds
  maxWaitTime: 180000, // 3 minutes max
  testSites: [
    {
      name: 'Example.com Simple Test',
      url: 'https://example.com',
      expectedTime: 30000
    },
    {
      name: 'HTTPBin JSON Test',
      url: 'https://httpbin.org/json',
      expectedTime: 25000
    }
  ]
};

class IntegrationTester {
  constructor() {
    this.results = [];
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async checkJobStatus(jobId) {
    try {
      const response = await axios.get(`${TEST_CONFIG.serverUrl}/status/${jobId}`);
      return response.data;
    } catch (error) {
      return { error: error.message };
    }
  }

  async waitForJobCompletion(jobId, testName) {
    const startTime = Date.now();
    this.log(`⏳ Waiting for job completion: ${jobId}`);
    
    while (Date.now() - startTime < TEST_CONFIG.maxWaitTime) {
      const status = await this.checkJobStatus(jobId);
      
      if (status.error) {
        this.log(`❌ Error checking job status: ${status.error}`, 'ERROR');
        return { success: false, error: status.error };
      }

      const jobStatus = status.job?.status || status.status || 'unknown';
      this.log(`📊 Job ${jobId}: ${jobStatus} (${((Date.now() - startTime) / 1000).toFixed(1)}s)`);

      if (jobStatus === 'completed') {
        const processingTime = Date.now() - startTime;
        this.log(`✅ ${testName} completed in ${(processingTime / 1000).toFixed(1)}s`);
        
        if (status.demoUrl) {
          this.log(`📖 Demo URL: ${status.demoUrl}`);
        }
        
        return {
          success: true,
          processingTime,
          status,
          demoUrl: status.job?.demo_url || status.demoUrl
        };
      }
      
      if (jobStatus === 'failed') {
        this.log(`❌ ${testName} failed: ${status.error || 'Unknown error'}`, 'ERROR');
        return {
          success: false,
          error: status.error || 'Job failed',
          status
        };
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.pollInterval));
    }

    // Timeout
    this.log(`⏰ ${testName} timed out after ${TEST_CONFIG.maxWaitTime / 1000}s`, 'ERROR');
    return {
      success: false,
      error: 'Timeout waiting for job completion'
    };
  }

  async testDemoUrl(demoUrl, testName) {
    if (!demoUrl) return { accessible: false, error: 'No demo URL provided' };

    try {
      this.log(`🌐 Testing demo accessibility: ${demoUrl}`);
      const response = await axios.get(demoUrl, {
        timeout: 10000,
        validateStatus: status => status < 500 // Accept redirects, etc.
      });
      
      const accessible = response.status < 400;
      const hasContent = response.data && response.data.length > 100;
      
      this.log(`📄 Demo response: ${response.status}, Content length: ${response.data?.length || 0}`);
      
      return {
        accessible,
        hasContent,
        status: response.status,
        contentLength: response.data?.length || 0
      };
      
    } catch (error) {
      this.log(`❌ Demo URL test failed: ${error.message}`, 'ERROR');
      return {
        accessible: false,
        error: error.message
      };
    }
  }

  async runFullTest(testSite) {
    const testStartTime = Date.now();
    this.log(`\n🧪 Starting full integration test: ${testSite.name}`);
    this.log(`🎯 Target URL: ${testSite.url}`);

    const testData = {
      name: `Integration Test User`,
      email: `integration-test-${Date.now()}@example.com`,
      phone: '+1234567890',
      website_url: testSite.url,
      company_name: `Integration Test Company`,
      test_mode: true
    };

    try {
      // Step 1: Submit demo request
      this.log(`📤 Submitting demo request...`);
      const submitResponse = await axios.post(
        `${TEST_CONFIG.serverUrl}/webhook/demo-request`,
        testData,
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (submitResponse.status !== 200) {
        throw new Error(`Submit failed with status ${submitResponse.status}`);
      }

      const jobId = submitResponse.data.jobId;
      if (!jobId) {
        throw new Error('No jobId returned from submission');
      }

      this.log(`✅ Job submitted successfully: ${jobId}`);

      // Step 2: Wait for completion
      const completionResult = await this.waitForJobCompletion(jobId, testSite.name);
      
      if (!completionResult.success) {
        return {
          ...completionResult,
          testName: testSite.name,
          url: testSite.url,
          totalTime: Date.now() - testStartTime
        };
      }

      // Step 3: Test demo URL accessibility
      const demoTest = await this.testDemoUrl(completionResult.demoUrl, testSite.name);

      // Step 4: Compile results
      const result = {
        testName: testSite.name,
        url: testSite.url,
        success: completionResult.success && demoTest.accessible,
        jobId,
        totalTime: Date.now() - testStartTime,
        processingTime: completionResult.processingTime,
        expectedTime: testSite.expectedTime,
        performanceRatio: completionResult.processingTime / testSite.expectedTime,
        demoUrl: completionResult.demoUrl,
        demoAccessible: demoTest.accessible,
        demoHasContent: demoTest.hasContent,
        status: completionResult.status,
        timestamp: new Date().toISOString()
      };

      this.log(`🎉 Integration test complete: ${testSite.name}`);
      this.log(`📊 Total time: ${(result.totalTime / 1000).toFixed(1)}s, Processing: ${(result.processingTime / 1000).toFixed(1)}s`);
      this.log(`📈 Performance: ${(result.performanceRatio * 100).toFixed(1)}% of expected time`);
      
      return result;

    } catch (error) {
      this.log(`💥 Integration test failed: ${error.message}`, 'ERROR');
      return {
        testName: testSite.name,
        url: testSite.url,
        success: false,
        error: error.message,
        totalTime: Date.now() - testStartTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  async runAllIntegrationTests() {
    this.log('🚀 Starting Full Integration Test Suite');
    
    // Check server health
    try {
      const healthResponse = await axios.get(`${TEST_CONFIG.serverUrl}/health`);
      this.log(`✅ Server health check: ${healthResponse.data.status}`);
    } catch (error) {
      this.log(`❌ Server health check failed: ${error.message}`, 'ERROR');
      return;
    }

    // Run tests sequentially to avoid overwhelming the system
    for (const testSite of TEST_CONFIG.testSites) {
      const result = await this.runFullTest(testSite);
      this.results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    this.generateReport();
  }

  generateReport() {
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);

    console.log('\n' + '='.repeat(80));
    console.log('🏁 INTEGRATION TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📊 Success Rate: ${((successful.length / this.results.length) * 100).toFixed(1)}%`);

    if (successful.length > 0) {
      const avgTotal = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
      const avgProcessing = successful.reduce((sum, r) => sum + (r.processingTime || 0), 0) / successful.length;
      console.log(`⏱️  Average Total Time: ${(avgTotal / 1000).toFixed(1)}s`);
      console.log(`⚡ Average Processing Time: ${(avgProcessing / 1000).toFixed(1)}s`);
    }

    console.log('='.repeat(80));

    // Detailed results
    this.results.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      console.log(`\n${icon} ${result.testName}:`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Total Time: ${(result.totalTime / 1000).toFixed(1)}s`);
      
      if (result.success) {
        console.log(`   Processing Time: ${(result.processingTime / 1000).toFixed(1)}s`);
        console.log(`   Performance: ${(result.performanceRatio * 100).toFixed(1)}% of expected`);
        console.log(`   Demo URL: ${result.demoUrl || 'N/A'}`);
        console.log(`   Demo Accessible: ${result.demoAccessible ? 'Yes' : 'No'}`);
        console.log(`   Demo Has Content: ${result.demoHasContent ? 'Yes' : 'No'}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }
    });

    // Save report
    if (!fs.existsSync('./tests/results')) {
      fs.mkdirSync('./tests/results', { recursive: true });
    }

    const reportFile = path.join('./tests/results', `integration-test-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({
      summary: {
        total: this.results.length,
        successful: successful.length,
        failed: failed.length,
        successRate: ((successful.length / this.results.length) * 100).toFixed(1) + '%'
      },
      results: this.results
    }, null, 2));

    this.log(`💾 Report saved: ${reportFile}`);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new IntegrationTester();
  
  if (process.argv[2] === 'single') {
    const url = process.argv[3] || 'https://example.com';
    const customTest = {
      name: 'Custom Integration Test',
      url: url,
      expectedTime: 45000
    };
    tester.runFullTest(customTest).then(result => {
      tester.results.push(result);
      tester.generateReport();
    });
  } else {
    tester.runAllIntegrationTests().catch(console.error);
  }
}

export default IntegrationTester;