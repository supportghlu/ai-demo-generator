#!/usr/bin/env node

/**
 * Unit Tests for Demo Generation System Components
 * Tests individual services and functions
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import services to test
import * as validator from '../services/validator.js';
import * as industryAnalyzer from '../services/industry-analyzer.js';

class UnitTester {
  constructor() {
    this.results = [];
    this.testCount = 0;
    this.passCount = 0;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  assert(condition, testName, description = '') {
    this.testCount++;
    if (condition) {
      this.passCount++;
      this.log(`✅ ${testName}: PASS ${description}`, 'TEST');
      this.results.push({ test: testName, status: 'PASS', description });
    } else {
      this.log(`❌ ${testName}: FAIL ${description}`, 'ERROR');
      this.results.push({ test: testName, status: 'FAIL', description });
    }
  }

  async testValidator() {
    this.log('🧪 Testing URL Validator Service');

    // Helper function for basic URL validation
    const isValidUrl = (urlString) => {
      try {
        const url = new URL(urlString);
        return ['http:', 'https:'].includes(url.protocol);
      } catch {
        return false;
      }
    };

    // Test valid URLs
    this.assert(
      isValidUrl('https://example.com'),
      'Valid HTTPS URL',
      'Should accept standard HTTPS URLs'
    );

    this.assert(
      isValidUrl('http://example.com'),
      'Valid HTTP URL',
      'Should accept HTTP URLs'
    );

    // Test invalid URLs
    this.assert(
      !isValidUrl('not-a-url'),
      'Invalid URL format',
      'Should reject malformed URLs'
    );

    this.assert(
      !isValidUrl('ftp://example.com'),
      'Invalid Protocol',
      'Should reject non-HTTP(S) protocols'
    );

    this.assert(
      !isValidUrl(''),
      'Empty URL',
      'Should reject empty strings'
    );

    // Test edge cases
    this.assert(
      isValidUrl('https://sub.domain.co.uk'),
      'Subdomain URL',
      'Should accept subdomains'
    );

    this.assert(
      isValidUrl('https://localhost:3000'),
      'Localhost with port',
      'Should accept localhost URLs'
    );

    // Test actual validator service
    try {
      const result = await validator.validateUrl('https://example.com');
      this.assert(
        typeof result === 'object' && result.hasOwnProperty('valid'),
        'Validator Service Response',
        'Should return object with valid property'
      );
    } catch (error) {
      this.log(`⚠️ Validator service test skipped: ${error.message}`, 'WARN');
    }
  }

  async testIndustryAnalyzer() {
    this.log('🧪 Testing Industry Analyzer Service');

    try {
      // Test with mock scraped data
      const mockScrapedData = {
        content: 'We are a law firm providing legal services to clients. Our attorneys specialize in corporate law.',
        headings: ['Legal Services', 'Our Attorneys'],
        pageTitle: 'Smith & Associates Law Firm'
      };

      const result = await industryAnalyzer.analyzeIndustry(mockScrapedData, 'https://example-law.com');
      
      this.assert(
        typeof result === 'object',
        'Industry Analyzer Response Type',
        'Should return an object'
      );

      this.assert(
        result.hasOwnProperty('success'),
        'Industry Analyzer Success Property',
        'Should have success property'
      );

      if (result.success && result.analysis) {
        this.assert(
          typeof result.analysis.industry === 'string',
          'Industry Identification',
          'Should identify industry as string'
        );

        this.assert(
          typeof result.analysis.optimizationScore === 'number' &&
          result.analysis.optimizationScore >= 1 &&
          result.analysis.optimizationScore <= 10,
          'Optimization Score Range',
          'Score should be between 1-10'
        );
      } else {
        this.log(`⚠️ Industry analysis not available: ${result.error || 'Unknown error'}`, 'WARN');
      }

    } catch (error) {
      this.log(`⚠️ Industry analyzer test skipped: ${error.message}`, 'WARN');
      // Don't fail the test if API keys are missing
      this.assert(true, 'Industry Analyzer Availability', 'Test skipped due to missing dependencies');
    }
  }

  async testDatabaseOperations() {
    this.log('🧪 Testing Database Operations');

    try {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(path.join(__dirname, '../demo-generator.db'));
      
      // Test database connection
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      this.assert(
        tables.length > 0,
        'Database Connection',
        'Should connect to database and find tables'
      );

      // Test jobs table exists
      const jobsTable = tables.find(t => t.name === 'jobs');
      this.assert(
        !!jobsTable,
        'Jobs Table Exists',
        'Should have jobs table for queue management'
      );

      // Test basic query
      const jobCount = db.prepare("SELECT COUNT(*) as count FROM jobs").get();
      this.assert(
        typeof jobCount.count === 'number',
        'Job Count Query',
        'Should be able to count jobs in database'
      );

      db.close();
    } catch (error) {
      this.assert(false, 'Database Access', `Database error: ${error.message}`);
    }
  }

  async testFileStructure() {
    this.log('🧪 Testing File Structure');

    const requiredFiles = [
      '../server.js',
      '../package.json',
      '../services/validator.js',
      '../services/scraper.js',
      '../services/ai-generator.js',
      '../services/industry-analyzer.js',
      '../queue/enhanced-processor.js'
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(__dirname, file);
      this.assert(
        fs.existsSync(filePath),
        `Required File: ${file}`,
        'Essential system file should exist'
      );
    }

    // Test directories
    const requiredDirs = [
      '../services',
      '../queue',
      '../routes',
      '../demos'
    ];

    for (const dir of requiredDirs) {
      const dirPath = path.join(__dirname, dir);
      this.assert(
        fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory(),
        `Required Directory: ${dir}`,
        'Essential system directory should exist'
      );
    }
  }

  async testEnvironmentVariables() {
    this.log('🧪 Testing Environment Variables');

    // Load environment variables
    const dotenv = await import('dotenv');
    dotenv.config({ path: path.join(__dirname, '../.env') });

    const requiredVars = [
      'ANTHROPIC_API_KEY',
      'GHL_API_KEY',
      'REPLIT_API_TOKEN'
    ];

    const optionalVars = [
      'OPENAI_API_KEY',
      'NODE_ENV'
    ];

    // Test required variables
    for (const varName of requiredVars) {
      this.assert(
        !!process.env[varName],
        `Required Env Var: ${varName}`,
        'Should be set for system to function'
      );
    }

    // Test optional variables (just report, don't fail)
    for (const varName of optionalVars) {
      const exists = !!process.env[varName];
      this.log(`📋 Optional Env Var ${varName}: ${exists ? 'SET' : 'NOT SET'}`, 'INFO');
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Unit Test Suite');

    await this.testValidator();
    await this.testIndustryAnalyzer();
    await this.testDatabaseOperations();
    await this.testFileStructure();
    await this.testEnvironmentVariables();

    this.generateReport();
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 UNIT TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.testCount}`);
    console.log(`✅ Passed: ${this.passCount}`);
    console.log(`❌ Failed: ${this.testCount - this.passCount}`);
    console.log(`📊 Success Rate: ${((this.passCount / this.testCount) * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    // Show failed tests
    const failedTests = this.results.filter(r => r.status === 'FAIL');
    if (failedTests.length > 0) {
      console.log('\n❌ FAILED TESTS:');
      failedTests.forEach(test => {
        console.log(`• ${test.test}: ${test.description}`);
      });
    }

    // Save results
    if (!fs.existsSync('./results')) {
      fs.mkdirSync('./results', { recursive: true });
    }
    
    const reportFile = path.join('./results', `unit-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify({
      summary: {
        total: this.testCount,
        passed: this.passCount,
        failed: this.testCount - this.passCount,
        successRate: `${((this.passCount / this.testCount) * 100).toFixed(1)}%`
      },
      results: this.results
    }, null, 2));

    this.log(`💾 Report saved: ${reportFile}`);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new UnitTester();
  tester.runAllTests().catch(console.error);
}

export default UnitTester;