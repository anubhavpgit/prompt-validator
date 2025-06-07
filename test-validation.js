// Node.js test script for the prompt validation API
// Run with: node test-validation.js

const https = require('https');

// Configuration
const API_BASE_URL = 'https://your-api-gateway-url.execute-api.us-east-1.amazonaws.com/dev';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test cases
async function runTests() {
  console.log('🔍 Testing Prompt Validation API');
  console.log('=================================\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthCheck = await makeRequest('GET', '/health');
    console.log(`Status: ${healthCheck.statusCode}`);
    console.log('Response:', JSON.stringify(healthCheck.data, null, 2));
    console.log('---\n');

    // Test 2: Configuration
    console.log('2. Testing Configuration...');
    const config = await makeRequest('GET', '/config');
    console.log(`Status: ${config.statusCode}`);
    console.log('Response:', JSON.stringify(config.data, null, 2));
    console.log('---\n');

    // Test 3: Valid prompt
    console.log('3. Testing Valid Prompt...');
    const validPrompt = await makeRequest('POST', '/validate', {
      prompt: 'Create a beautiful sunset landscape video with mountains and a lake'
    });
    console.log(`Status: ${validPrompt.statusCode}`);
    console.log('Response:', JSON.stringify(validPrompt.data, null, 2));
    console.log('---\n');

    // Test 4: Invalid request
    console.log('4. Testing Invalid Request (missing prompt)...');
    const invalidRequest = await makeRequest('POST', '/validate', {});
    console.log(`Status: ${invalidRequest.statusCode}`);
    console.log('Response:', JSON.stringify(invalidRequest.data, null, 2));
    console.log('---\n');

    // Test 5: Empty prompt
    console.log('5. Testing Empty Prompt...');
    const emptyPrompt = await makeRequest('POST', '/validate', {
      prompt: ''
    });
    console.log(`Status: ${emptyPrompt.statusCode}`);
    console.log('Response:', JSON.stringify(emptyPrompt.data, null, 2));
    console.log('---\n');

    // Test 6: Potentially problematic content
    console.log('6. Testing Potentially Problematic Content...');
    const problematicContent = await makeRequest('POST', '/validate', {
      prompt: 'Create a violent and disturbing horror video with explicit content'
    });
    console.log(`Status: ${problematicContent.statusCode}`);
    console.log('Response:', JSON.stringify(problematicContent.data, null, 2));
    console.log('---\n');

    // Test 7: Batch validation
    console.log('7. Testing Batch Validation...');
    const batchValidation = await makeRequest('POST', '/validate-batch', {
      prompts: [
        'Create a peaceful nature video',
        'Generate a cooking tutorial video',
        'Make a video with violent content',
        'Create a family-friendly animation'
      ]
    });
    console.log(`Status: ${batchValidation.statusCode}`);
    console.log('Response:', JSON.stringify(batchValidation.data, null, 2));
    console.log('---\n');

    console.log('✅ All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Performance test
async function performanceTest() {
  console.log('\n🚀 Running Performance Test...');
  
  const startTime = Date.now();
  const concurrentRequests = 5;
  const testPrompt = 'Create a simple animation video';

  try {
    const promises = Array(concurrentRequests).fill().map(async (_, index) => {
      const start = Date.now();
      const response = await makeRequest('POST', '/validate', {
        prompt: `${testPrompt} - Request ${index + 1}`
      });
      const duration = Date.now() - start;
      return { index: index + 1, duration, statusCode: response.statusCode };
    });

    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    console.log('Performance Results:');
    results.forEach(result => {
      console.log(`  Request ${result.index}: ${result.duration}ms (Status: ${result.statusCode})`);
    });
    console.log(`Total time for ${concurrentRequests} concurrent requests: ${totalTime}ms`);
    console.log(`Average response time: ${results.reduce((sum, r) => sum + r.duration, 0) / results.length}ms`);

  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
  }
}

// Run tests
async function main() {
  if (API_BASE_URL.includes('your-api-gateway-url')) {
    console.log('⚠️  Please update API_BASE_URL with your actual API Gateway URL');
    return;
  }

  await runTests();
  await performanceTest();
}

main();