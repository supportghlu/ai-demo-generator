#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Demo Generation System
 * Runs all tests in sequence and generates a consolidated report
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

class TestSuite {
  constructor() {
    this.results = {
      unit: null,
      integration: null,
      performance: null,
      startTime: Date.now()
    };
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async runCommand(command, args = [], description = '') {
    return new Promise((resolve, reject) => {
      this.log(`🔥 Running: ${command} ${args.join(' ')} ${description}`);
      
      const process = spawn('node', [command, ...args], {
        stdio: 'pipe',
        cwd: '.'
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, stdout, stderr });
        } else {
          resolve({ success: false, stdout, stderr, code });
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  async checkServerHealth() {
    try {
      const { default: axios } = await import('axios');
      const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async runUnitTests() {
    this.log('\n📋 RUNNING UNIT TESTS');
    this.log('=' * 50);

    try {
      const result = await this.runCommand('tests/unit-tests.js', [], '(Component Testing)');
      
      // Extract results from stdout
      const lines = result.stdout.split('\n');
      const summaryLine = lines.find(l => l.includes('Success Rate:'));
      let successRate = '0%';
      if (summaryLine) {
        const match = summaryLine.match(/(\d+\.?\d*)%/);
        if (match) successRate = match[0];
      }

      this.results.unit = {
        success: result.success,
        successRate,
        output: result.stdout,
        errors: result.stderr
      };

      if (result.success) {
        this.log(`✅ Unit tests completed - Success rate: ${successRate}`);
      } else {
        this.log(`❌ Unit tests failed`, 'ERROR');
      }

    } catch (error) {
      this.log(`💥 Unit test execution failed: ${error.message}`, 'ERROR');
      this.results.unit = { success: false, error: error.message };
    }
  }

  async runIntegrationTests() {
    this.log('\n🔗 RUNNING INTEGRATION TESTS');
    this.log('=' * 50);

    try {
      // Test with multiple sites
      const testSites = [
        'https://example.com',
        'https://httpbin.org/html'
      ];

      const integrationResults = [];

      for (const site of testSites) {
        this.log(`🧪 Testing integration with: ${site}`);
        const result = await this.runCommand(
          'tests/integration-test.js', 
          ['single', site], 
          `(Full Workflow Test)`
        );

        const lines = result.stdout.split('\n');
        const successLine = lines.find(l => l.includes('Success Rate:'));
        let successRate = '0%';
        if (successLine) {
          const match = successLine.match(/(\d+\.?\d*)%/);
          if (match) successRate = match[0];
        }

        integrationResults.push({
          site,
          success: result.success,
          successRate,
          output: result.stdout
        });

        // Brief delay between tests
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      const overallSuccess = integrationResults.every(r => r.success);
      const avgSuccessRate = integrationResults
        .map(r => parseFloat(r.successRate) || 0)
        .reduce((sum, rate) => sum + rate, 0) / integrationResults.length;

      this.results.integration = {
        success: overallSuccess,
        successRate: `${avgSuccessRate.toFixed(1)}%`,
        tests: integrationResults
      };

      if (overallSuccess) {
        this.log(`✅ Integration tests completed - Average success: ${avgSuccessRate.toFixed(1)}%`);
      } else {
        this.log(`❌ Some integration tests failed`, 'ERROR');
      }

    } catch (error) {
      this.log(`💥 Integration test execution failed: ${error.message}`, 'ERROR');
      this.results.integration = { success: false, error: error.message };
    }
  }

  async runPerformanceTests() {
    this.log('\n⚡ RUNNING PERFORMANCE TESTS');
    this.log('=' * 50);

    try {
      // Light load test
      const result = await this.runCommand(
        'tests/load-test.js', 
        ['concurrent', '3', '30'], 
        '(3 concurrent users for 30s)'
      );

      // Extract performance metrics
      const lines = result.stdout.split('\n');
      const reqSecLine = lines.find(l => l.includes('Requests/sec:'));
      let requestsPerSec = '0';
      if (reqSecLine) {
        const match = reqSecLine.match(/(\d+\.?\d+)/);
        if (match) requestsPerSec = match[0];
      }

      const successLine = lines.find(l => l.includes('Successful:'));
      let successCount = '0';
      if (successLine) {
        const match = successLine.match(/(\d+)/);
        if (match) successCount = match[0];
      }

      this.results.performance = {
        success: result.success,
        requestsPerSecond: requestsPerSec,
        successfulRequests: successCount,
        output: result.stdout,
        errors: result.stderr
      };

      if (result.success) {
        this.log(`✅ Performance tests completed - ${requestsPerSec} req/sec`);
      } else {
        this.log(`❌ Performance tests failed`, 'ERROR');
      }

    } catch (error) {
      this.log(`💥 Performance test execution failed: ${error.message}`, 'ERROR');
      this.results.performance = { success: false, error: error.message };
    }
  }

  generateConsolidatedReport() {
    const totalTime = Date.now() - this.results.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('🏆 COMPREHENSIVE TEST SUITE RESULTS');
    console.log('='.repeat(80));
    console.log(`Total Runtime: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);
    console.log('');

    // Unit Tests
    if (this.results.unit) {
      const icon = this.results.unit.success ? '✅' : '❌';
      console.log(`${icon} Unit Tests: ${this.results.unit.successRate || 'Failed'}`);
    }

    // Integration Tests  
    if (this.results.integration) {
      const icon = this.results.integration.success ? '✅' : '❌';
      console.log(`${icon} Integration Tests: ${this.results.integration.successRate || 'Failed'}`);
    }

    // Performance Tests
    if (this.results.performance) {
      const icon = this.results.performance.success ? '✅' : '❌';
      console.log(`${icon} Performance Tests: ${this.results.performance.requestsPerSecond || 'Failed'} req/sec`);
    }

    // Overall Status
    const allPassed = [
      this.results.unit?.success,
      this.results.integration?.success,
      this.results.performance?.success
    ].every(result => result === true);

    console.log('');
    console.log(`🎯 Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    // Recommendations
    console.log('\n📋 RECOMMENDATIONS:');
    
    if (this.results.unit?.success === false) {
      console.log('• 🔧 Fix unit test failures before production deployment');
    }
    
    if (this.results.integration?.success === false) {
      console.log('• 🚨 Critical: Integration tests failed - check system connectivity');
    }
    
    if (this.results.performance?.success === false) {
      console.log('• ⚠️  Performance issues detected - review system capacity');
    }
    
    if (allPassed) {
      console.log('• 🚀 System ready for production deployment');
      console.log('• 📊 Consider setting up automated testing in CI/CD pipeline');
      console.log('• 🔄 Schedule regular health checks');
    }

    console.log('='.repeat(80));

    // Save consolidated report
    const report = {
      timestamp: new Date().toISOString(),
      totalRuntime: totalTime,
      overallSuccess: allPassed,
      results: this.results
    };

    if (!fs.existsSync('./tests/results')) {
      fs.mkdirSync('./tests/results', { recursive: true });
    }

    const reportFile = path.join('./tests/results', `comprehensive-test-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    this.log(`💾 Comprehensive report saved: ${reportFile}`);
    
    return allPassed;
  }

  async runFullSuite() {
    this.log('🚀 Starting Comprehensive Test Suite for Demo Generation System');
    
    // Check if server is running
    const serverRunning = await this.checkServerHealth();
    if (!serverRunning) {
      this.log('❌ Server not running on http://localhost:3000 - please start the server first', 'ERROR');
      process.exit(1);
    }
    
    this.log('✅ Server health check passed');

    // Run all test types
    await this.runUnitTests();
    await this.runIntegrationTests();
    await this.runPerformanceTests();

    // Generate final report
    const success = this.generateConsolidatedReport();
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = new TestSuite();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'unit':
      suite.runUnitTests().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'integration':
      suite.runIntegrationTests().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'performance':
      suite.runPerformanceTests().then(() => process.exit(0)).catch(() => process.exit(1));
      break;
    case 'full':
    default:
      suite.runFullSuite().catch(console.error);
      break;
  }
}

export default TestSuite;