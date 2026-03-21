#!/usr/bin/env node

/**
 * Demo Generation System Test Runner
 * Comprehensive testing suite for the AI Demo Generator
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Test Configuration
const TEST_CONFIG = {
  serverUrl: 'http://localhost:3000',
  timeout: 120000, // 2 minutes max per test
  outputDir: './tests/results',
  testSites: [
    {
      name: 'Simple Site',
      url: 'https://example.com',
      expectedTime: 15000, // 15 seconds
      complexity: 'simple'
    },
    {
      name: 'E-commerce',
      url: 'https://shopify.com',
      expectedTime: 45000, // 45 seconds
      complexity: 'medium'
    },
    {
      name: 'Enterprise',
      url: 'https://apple.com',
      expectedTime: 60000, // 60 seconds
      complexity: 'complex'
    },
    {
      name: 'Law Firm',
      url: 'https://law.stanford.edu',
      expectedTime: 45000,
      complexity: 'medium'
    },
    {
      name: 'Healthcare',
      url: 'https://mayoclinic.org',
      expectedTime: 50000,
      complexity: 'medium'
    }
  ]
};

class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    
    // Ensure output directory exists
    if (!fs.existsSync(TEST_CONFIG.outputDir)) {
      fs.mkdirSync(TEST_CONFIG.outputDir, { recursive: true });
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    
    // Append to test log
    fs.appendFileSync(
      path.join(TEST_CONFIG.outputDir, 'test-log.txt'),
      logMessage + '\n'
    );
  }

  async checkServerStatus() {
    this.log('🔍 Checking server status...');
    try {
      const response = await axios.get(`${TEST_CONFIG.serverUrl}/health`);
      this.log('✅ Server is online');
      return true;
    } catch (error) {
      this.log('❌ Server is not responding', 'ERROR');
      return false;
    }
  }

  async runSingleTest(testSite) {
    const testStartTime = Date.now();
    this.log(`🧪 Starting test: ${testSite.name} (${testSite.url})`);

    const testData = {
      name: `Test User ${testSite.name}`,
      email: `test-${Date.now()}@example.com`,
      phone: '+1234567890',
      website_url: testSite.url,
      company_name: `Test Company ${testSite.name}`,
      test_mode: true
    };

    try {
      // Submit demo request
      const response = await axios.post(
        `${TEST_CONFIG.serverUrl}/webhook/demo-request`,
        testData,
        { 
          timeout: TEST_CONFIG.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const processingTime = Date.now() - testStartTime;
      
      const result = {
        site: testSite.name,
        url: testSite.url,
        complexity: testSite.complexity,
        success: response.status === 200,
        processingTime: processingTime,
        expectedTime: testSite.expectedTime,
        performanceRatio: processingTime / testSite.expectedTime,
        response: response.data,
        timestamp: new Date().toISOString()
      };

      // Log results
      if (result.success) {
        this.log(`✅ ${testSite.name}: ${processingTime}ms (expected: ${testSite.expectedTime}ms)`);
        if (response.data.demoUrl) {
          this.log(`📖 Demo URL: ${response.data.demoUrl}`);
        }
        if (response.data.analysis) {
          this.log(`📊 Industry: ${response.data.analysis.industry || 'N/A'}`);
          this.log(`📈 Score: ${response.data.analysis.optimizationScore || 'N/A'}/10`);
        }
      } else {
        this.log(`❌ ${testSite.name}: Failed`, 'ERROR');
      }

      this.results.push(result);
      return result;

    } catch (error) {
      const processingTime = Date.now() - testStartTime;
      const errorResult = {
        site: testSite.name,
        url: testSite.url,
        complexity: testSite.complexity,
        success: false,
        processingTime: processingTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };

      this.log(`❌ ${testSite.name}: ${error.message}`, 'ERROR');
      this.results.push(errorResult);
      return errorResult;
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Demo Generation System Test Suite');
    
    // Check server first
    const serverOnline = await this.checkServerStatus();
    if (!serverOnline) {
      this.log('❌ Cannot proceed - server is offline', 'ERROR');
      return;
    }

    // Run all tests
    for (const testSite of TEST_CONFIG.testSites) {
      await this.runSingleTest(testSite);
      
      // Small delay between tests to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Generate report
    this.generateReport();
  }

  generateReport() {
    const totalTime = Date.now() - this.startTime;
    const successfulTests = this.results.filter(r => r.success);
    const failedTests = this.results.filter(r => !r.success);
    
    this.log('📊 Generating test report...');

    const report = {
      summary: {
        totalTests: this.results.length,
        successful: successfulTests.length,
        failed: failedTests.length,
        successRate: `${((successfulTests.length / this.results.length) * 100).toFixed(1)}%`,
        totalRunTime: `${(totalTime / 1000).toFixed(1)}s`
      },
      performance: {
        averageProcessingTime: `${(successfulTests.reduce((sum, r) => sum + r.processingTime, 0) / successfulTests.length / 1000).toFixed(1)}s`,
        fastestTest: successfulTests.sort((a, b) => a.processingTime - b.processingTime)[0]?.site || 'N/A',
        slowestTest: successfulTests.sort((a, b) => b.processingTime - a.processingTime)[0]?.site || 'N/A'
      },
      results: this.results
    };

    // Console summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`✅ Successful: ${report.summary.successful}`);
    console.log(`❌ Failed: ${report.summary.failed}`);
    console.log(`📊 Success Rate: ${report.summary.successRate}`);
    console.log(`⏱️  Total Time: ${report.summary.totalRunTime}`);
    console.log(`⚡ Avg Processing: ${report.performance.averageProcessingTime}`);
    console.log('='.repeat(60));

    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failedTests.forEach(test => {
        console.log(`• ${test.site}: ${test.error || 'Unknown error'}`);
      });
    }

    if (successfulTests.length > 0) {
      console.log('\n✅ SUCCESSFUL TESTS:');
      successfulTests.forEach(test => {
        const performance = test.processingTime <= test.expectedTime ? '🚀' : '⚠️';
        console.log(`• ${performance} ${test.site}: ${(test.processingTime/1000).toFixed(1)}s`);
      });
    }

    // Save detailed report
    const reportFile = path.join(TEST_CONFIG.outputDir, `test-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    this.log(`💾 Detailed report saved: ${reportFile}`);

    // Save CSV for analysis
    this.generateCSVReport();
  }

  generateCSVReport() {
    const csvHeaders = 'Site,URL,Complexity,Success,ProcessingTime(ms),ExpectedTime(ms),PerformanceRatio,Industry,Score,Timestamp';
    const csvRows = this.results.map(r => [
      r.site,
      r.url,
      r.complexity,
      r.success,
      r.processingTime || '',
      r.expectedTime || '',
      r.performanceRatio?.toFixed(2) || '',
      r.response?.analysis?.industry || '',
      r.response?.analysis?.optimizationScore || '',
      r.timestamp
    ].join(','));

    const csvContent = [csvHeaders, ...csvRows].join('\n');
    const csvFile = path.join(TEST_CONFIG.outputDir, `test-data-${Date.now()}.csv`);
    fs.writeFileSync(csvFile, csvContent);
    this.log(`📊 CSV report saved: ${csvFile}`);
  }

  async runQuickTest() {
    this.log('⚡ Running quick test with example.com');
    const quickTest = {
      name: 'Quick Test',
      url: 'https://example.com',
      expectedTime: 15000,
      complexity: 'simple'
    };
    
    await this.runSingleTest(quickTest);
    this.generateReport();
  }

  async runPerformanceTest() {
    this.log('🏎️ Running performance test with Apple.com');
    const perfTest = {
      name: 'Performance Test',
      url: 'https://apple.com',
      expectedTime: 60000,
      complexity: 'complex'
    };
    
    await this.runSingleTest(perfTest);
    this.generateReport();
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const testRunner = new TestRunner();

  switch (args[0]) {
    case 'quick':
      await testRunner.runQuickTest();
      break;
    case 'performance':
      await testRunner.runPerformanceTest();
      break;
    case 'single':
      if (args[1]) {
        const customTest = {
          name: 'Custom Test',
          url: args[1],
          expectedTime: 45000,
          complexity: 'medium'
        };
        await testRunner.runSingleTest(customTest);
        testRunner.generateReport();
      } else {
        console.log('Usage: node test-runner.js single <url>');
      }
      break;
    case 'all':
    default:
      await testRunner.runAllTests();
      break;
  }
}

// Run if called directly (ES module check)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default TestRunner;