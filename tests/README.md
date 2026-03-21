# Demo Generation System Testing Suite

Comprehensive testing framework for the AI Demo Generator system.

## 🧪 Test Types

### 1. Integration Tests (`test-runner.js`)
End-to-end testing of the complete demo generation workflow.

```bash
# Run all integration tests
node tests/test-runner.js all

# Quick test with simple site
node tests/test-runner.js quick

# Performance test with complex site
node tests/test-runner.js performance

# Test specific URL
node tests/test-runner.js single https://example.com
```

**Test Sites:**
- **Simple**: example.com (15s expected)
- **E-commerce**: shopify.com (45s expected)  
- **Enterprise**: apple.com (60s expected)
- **Legal**: law.stanford.edu (45s expected)
- **Healthcare**: mayoclinic.org (50s expected)

### 2. Unit Tests (`unit-tests.js`)
Component-level testing of individual services.

```bash
node tests/unit-tests.js
```

**Tests:**
- URL validator functionality
- Industry analyzer accuracy
- Database operations
- File structure integrity
- Environment variable validation

### 3. Load Tests (`load-test.js`)
Performance testing under concurrent load.

```bash
# Stress test with increasing concurrent load
node tests/load-test.js stress

# Custom concurrent test (5 concurrent for 60 seconds)
node tests/load-test.js concurrent 5 60
```

**Metrics:**
- Requests per second
- Response time percentiles (P50, P95, P99)
- Success/failure rates
- Error analysis
- Performance degradation under load

## 📊 Test Reports

All tests generate detailed reports in `tests/results/`:

- **JSON reports**: Detailed test data and metrics
- **CSV exports**: For spreadsheet analysis
- **Console summaries**: Quick overview of results
- **Time series**: Performance trends over time

## 🚀 Quick Start

1. **Ensure server is running:**
   ```bash
   npm start
   ```

2. **Quick health check (30 seconds):**
   ```bash
   node tests/quick-check.js
   ```

3. **Full test suite (recommended):**
   ```bash
   # Complete automated test pipeline
   node test-suite.js full
   
   # Individual test types
   node test-suite.js unit
   node test-suite.js integration  
   node test-suite.js performance
   ```

4. **Individual tests for debugging:**
   ```bash
   # Unit tests (fast)
   node tests/unit-tests.js
   
   # Integration test with custom URL
   node tests/integration-test.js single https://example.com
   
   # Load test (custom parameters)
   node tests/load-test.js concurrent 5 60
   ```

5. **Check results:**
   ```bash
   ls tests/results/
   ```

## 📋 Test Checklist

Before production deployment, verify:

- [ ] All unit tests pass (100%)
- [ ] Integration tests show >90% success rate  
- [ ] Performance tests complete under expected times
- [ ] Load tests handle expected concurrent users
- [ ] No memory leaks during extended testing
- [ ] Error handling works correctly
- [ ] Database operations are stable

## 🔧 Configuration

### Test Parameters

Edit test files to adjust:
- **Timeout values**: Default 2 minutes per request
- **Test sites**: Add/remove websites to test
- **Load levels**: Adjust concurrent user counts
- **Duration**: Change test run times

### Environment

Tests use the same environment as production:
- Same `.env` file
- Same database
- Same API keys
- Same service endpoints

## 📈 Performance Targets

### Response Times
- **Simple sites**: <15 seconds
- **Medium complexity**: <45 seconds  
- **Complex enterprise**: <60 seconds

### Reliability
- **Success rate**: >95%
- **Uptime**: >99.9%
- **Error handling**: Graceful degradation

### Scalability
- **Concurrent users**: 5+ simultaneous
- **Queue processing**: No backlog under normal load
- **Resource usage**: Stable memory/CPU

## 🐛 Debugging

### Common Issues

1. **Server not responding**
   ```bash
   # Check if server is running
   curl http://localhost:3000/health
   ```

2. **Database errors**
   ```bash
   # Check database file
   ls -la demo-generator.db*
   ```

3. **API failures**
   ```bash
   # Check environment variables
   grep -v "^#" .env | grep API_KEY
   ```

### Log Analysis

Test logs include:
- Request/response timing
- Error messages and stack traces
- Performance metrics
- API usage and limits

## 🔄 Continuous Testing

### Automated Testing

Set up cron jobs for regular testing:
```bash
# Daily health check
0 9 * * * cd /path/to/ai-demo-generator && node tests/test-runner.js quick

# Weekly full test suite
0 2 * * 0 cd /path/to/ai-demo-generator && node tests/test-runner.js all
```

### Monitoring Integration

Test results can be integrated with:
- StatusCake/UptimeRobot for uptime monitoring
- DataDog/NewRelic for performance tracking
- Slack/Discord for alert notifications

## 📚 Test Documentation

### Adding New Tests

1. **Integration test**: Add new test site to `TEST_CONFIG.testSites`
2. **Unit test**: Add test function to `UnitTester` class
3. **Load test**: Modify `LoadTester.config` parameters

### Best Practices

- **Isolated tests**: Each test should be independent
- **Cleanup**: Remove test data after completion  
- **Timeout handling**: All tests should have timeouts
- **Error reporting**: Clear error messages and stack traces
- **Performance**: Tests shouldn't impact production

---

**Run tests regularly to ensure system reliability and performance!** 🚀