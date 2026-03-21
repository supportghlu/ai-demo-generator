#!/usr/bin/env node

/**
 * Load Testing for Demo Generation System
 * Tests system performance under concurrent load
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';

class LoadTester {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.config = {
      serverUrl: 'http://localhost:3000',
      concurrent: 5, // Number of concurrent requests
      duration: 60, // Test duration in seconds
      rampUp: 10, // Ramp up time in seconds
      testSites: [
        'https://example.com',
        'https://httpbin.org/html',
        'https://httpbin.org/json'
      ]
    };
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async generateTestPayload(index) {
    const siteIndex = index % this.config.testSites.length;
    return {
      name: `Load Test User ${index}`,
      email: `loadtest${index}-${Date.now()}@example.com`,
      phone: '+1234567890',
      website_url: this.config.testSites[siteIndex],
      company_name: `Load Test Company ${index}`,
      test_mode: true
    };
  }

  async makeRequest(requestId) {
    const startTime = Date.now();
    const payload = await this.generateTestPayload(requestId);
    
    try {
      const response = await axios.post(
        `${this.config.serverUrl}/webhook/demo-request`,
        payload,
        {
          timeout: 120000, // 2 minute timeout
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        requestId: requestId,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        status: response.status,
        success: response.status === 200,
        url: payload.website_url,
        error: null
      };

      this.log(`✅ Request ${requestId}: ${duration}ms (${payload.website_url})`);
      return result;

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const result = {
        requestId: requestId,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        status: error.response?.status || 0,
        success: false,
        url: payload.website_url,
        error: error.message
      };

      this.log(`❌ Request ${requestId}: ${error.message} (${duration}ms)`, 'ERROR');
      return result;
    }
  }

  async runConcurrentTest() {
    this.log(`🚀 Starting load test: ${this.config.concurrent} concurrent requests for ${this.config.duration}s`);
    
    const endTime = Date.now() + (this.config.duration * 1000);
    let requestId = 1;
    const activeRequests = new Set();
    const maxConcurrent = this.config.concurrent;

    while (Date.now() < endTime || activeRequests.size > 0) {
      // Start new requests if under concurrent limit and time remaining
      while (activeRequests.size < maxConcurrent && Date.now() < endTime) {
        const currentRequestId = requestId++;
        
        const requestPromise = this.makeRequest(currentRequestId)
          .then(result => {
            this.results.push(result);
            activeRequests.delete(requestPromise);
          })
          .catch(error => {
            this.log(`💥 Request ${currentRequestId} crashed: ${error.message}`, 'ERROR');
            activeRequests.delete(requestPromise);
          });

        activeRequests.add(requestPromise);
        
        // Small delay to ramp up gradually
        if (activeRequests.size === 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.rampUp * 1000 / maxConcurrent));
        }
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.log('⏳ Waiting for remaining requests to complete...');
    await Promise.all(Array.from(activeRequests));
    
    this.generateLoadReport();
  }

  async runStressTest() {
    this.log('💪 Starting stress test with increasing concurrent load');
    
    const stressLevels = [1, 2, 5, 10, 15];
    const testDuration = 30; // 30 seconds per level
    
    for (const concurrentLevel of stressLevels) {
      this.log(`🔥 Testing ${concurrentLevel} concurrent requests`);
      this.config.concurrent = concurrentLevel;
      
      const levelResults = [];
      const endTime = Date.now() + (testDuration * 1000);
      const activeRequests = new Set();
      let requestId = this.results.length + 1;

      while (Date.now() < endTime || activeRequests.size > 0) {
        while (activeRequests.size < concurrentLevel && Date.now() < endTime) {
          const currentRequestId = requestId++;
          
          const requestPromise = this.makeRequest(currentRequestId)
            .then(result => {
              levelResults.push(result);
              this.results.push(result);
              activeRequests.delete(requestPromise);
            })
            .catch(error => {
              this.log(`💥 Request ${currentRequestId} crashed: ${error.message}`, 'ERROR');
              activeRequests.delete(requestPromise);
            });

          activeRequests.add(requestPromise);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await Promise.all(Array.from(activeRequests));
      
      // Quick stats for this level
      const successful = levelResults.filter(r => r.success).length;
      const avgDuration = levelResults.reduce((sum, r) => sum + r.duration, 0) / levelResults.length;
      
      this.log(`📊 Level ${concurrentLevel}: ${successful}/${levelResults.length} successful, avg ${avgDuration.toFixed(0)}ms`);
      
      // Brief pause between levels
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    this.generateLoadReport();
  }

  generateLoadReport() {
    const totalDuration = Date.now() - this.startTime;
    const successfulRequests = this.results.filter(r => r.success);
    const failedRequests = this.results.filter(r => !r.success);
    
    // Calculate metrics
    const totalRequests = this.results.length;
    const successRate = (successfulRequests.length / totalRequests * 100).toFixed(1);
    const avgResponseTime = successfulRequests.reduce((sum, r) => sum + r.duration, 0) / successfulRequests.length;
    const minResponseTime = Math.min(...successfulRequests.map(r => r.duration));
    const maxResponseTime = Math.max(...successfulRequests.map(r => r.duration));
    const requestsPerSecond = (totalRequests / (totalDuration / 1000)).toFixed(2);

    // Percentiles
    const sortedDurations = successfulRequests.map(r => r.duration).sort((a, b) => a - b);
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)] || 0;
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0;
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0;

    console.log('\n' + '='.repeat(70));
    console.log('📈 LOAD TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`⏱️  Test Duration: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`📊 Total Requests: ${totalRequests}`);
    console.log(`✅ Successful: ${successfulRequests.length} (${successRate}%)`);
    console.log(`❌ Failed: ${failedRequests.length}`);
    console.log(`🚀 Requests/sec: ${requestsPerSecond}`);
    console.log('');
    console.log('⚡ RESPONSE TIMES:');
    console.log(`Average: ${avgResponseTime.toFixed(0)}ms`);
    console.log(`Min: ${minResponseTime}ms`);
    console.log(`Max: ${maxResponseTime}ms`);
    console.log(`P50: ${p50}ms`);
    console.log(`P95: ${p95}ms`);
    console.log(`P99: ${p99}ms`);
    console.log('='.repeat(70));

    // Error analysis
    if (failedRequests.length > 0) {
      console.log('\n❌ ERROR ANALYSIS:');
      const errorTypes = {};
      failedRequests.forEach(r => {
        const errorType = r.error || 'Unknown';
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      });
      
      Object.entries(errorTypes).forEach(([error, count]) => {
        console.log(`• ${error}: ${count} times`);
      });
    }

    // Performance over time (for long tests)
    if (totalDuration > 60000) { // > 1 minute
      this.generateTimeSeriesAnalysis();
    }

    // Save detailed report
    const report = {
      summary: {
        testDuration: totalDuration,
        totalRequests,
        successfulRequests: successfulRequests.length,
        failedRequests: failedRequests.length,
        successRate: parseFloat(successRate),
        requestsPerSecond: parseFloat(requestsPerSecond)
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        minResponseTime,
        maxResponseTime,
        p50, p95, p99
      },
      results: this.results
    };

    if (!fs.existsSync('./tests/results')) {
      fs.mkdirSync('./tests/results', { recursive: true });
    }

    const reportFile = path.join('./tests/results', `load-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    this.log(`💾 Detailed report saved: ${reportFile}`);

    return report;
  }

  generateTimeSeriesAnalysis() {
    console.log('\n📈 PERFORMANCE OVER TIME:');
    
    const bucketSize = 10000; // 10 second buckets
    const buckets = {};
    
    this.results.forEach(result => {
      const bucket = Math.floor((result.startTime - this.startTime) / bucketSize) * bucketSize;
      if (!buckets[bucket]) {
        buckets[bucket] = [];
      }
      buckets[bucket].push(result);
    });

    Object.entries(buckets).forEach(([bucketStart, results]) => {
      const successful = results.filter(r => r.success);
      const avgTime = successful.length > 0 
        ? successful.reduce((sum, r) => sum + r.duration, 0) / successful.length 
        : 0;
      
      const timeRange = `${(parseInt(bucketStart) / 1000).toFixed(0)}-${((parseInt(bucketStart) + bucketSize) / 1000).toFixed(0)}s`;
      console.log(`${timeRange}: ${successful.length}/${results.length} success, avg ${avgTime.toFixed(0)}ms`);
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const tester = new LoadTester();

  switch (args[0]) {
    case 'stress':
      await tester.runStressTest();
      break;
    case 'concurrent':
      const concurrent = parseInt(args[1]) || 5;
      const duration = parseInt(args[2]) || 60;
      tester.config.concurrent = concurrent;
      tester.config.duration = duration;
      await tester.runConcurrentTest();
      break;
    default:
      console.log('Usage:');
      console.log('  node load-test.js stress              # Run stress test with increasing load');
      console.log('  node load-test.js concurrent [n] [t]  # Run concurrent test (n=concurrent, t=time)');
      break;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default LoadTester;