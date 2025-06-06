const { BedrockRuntimeClient, ApplyGuardrailCommand } = require('@aws-sdk/client-bedrock-runtime');

// For Node.js 18+ fetch is built-in, for older versions you might need:
// const fetch = require('node-fetch');

// ARCHITECTURE: This service acts as a validation gateway/proxy
// - If content is BLOCKED: Return error response immediately
// - If content is ALLOWED: Forward request to main video service and return its response

// Easy config - change these values as needed
const MODERATION_CONFIG = {
  guardrailId: 'your-guardrail-id', // Replace with your actual guardrail ID
  guardrailVersion: 'DRAFT', // or specific version number
  
  // Main video service endpoint
  videoServiceUrl: 'https://your-video-service.com/generate', // Replace with actual endpoint
  
  // Custom response messages
  messages: {
    blocked: "Content violates our community guidelines",
    error: "Unable to validate content at this time"
  },
  
  // Enable/disable logging
  enableLogging: true
};

// Initialize AWS Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Helper function to create API Gateway response
function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

// Forward request to main video service
async function forwardToVideoService(originalEvent) {
  try {
    const response = await fetch(MODERATION_CONFIG.videoServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward any auth headers from original request
        ...(originalEvent.headers?.authorization && {
          'Authorization': originalEvent.headers.authorization
        })
      },
      body: originalEvent.body // Forward the original request body
    });

    const responseData = await response.text();
    let parsedData;
    
    try {
      parsedData = JSON.parse(responseData);
    } catch {
      parsedData = { message: responseData };
    }

    return createResponse(response.status, parsedData);

  } catch (error) {
    console.error('Error forwarding to video service:', error);
    return createResponse(502, {
      success: false,
      message: 'Video service unavailable',
      error: 'Failed to connect to video generation service'
    });
  }
}
function logRequest(prompt, result, reason = '') {
  if (!MODERATION_CONFIG.enableLogging) return;
  
  console.log(`[${new Date().toISOString()}] Validation Result:`, {
    promptLength: prompt?.length || 0,
    result: result,
    reason: reason,
    timestamp: Date.now()
  });
}

// Main validation function
async function validatePrompt(prompt) {
  try {
    const command = new ApplyGuardrailCommand({
      guardrailIdentifier: MODERATION_CONFIG.guardrailId,
      guardrailVersion: MODERATION_CONFIG.guardrailVersion,
      source: 'INPUT',
      content: [
        {
          text: {
            text: prompt
          }
        }
      ]
    });

    const response = await bedrockClient.send(command);
    
    // Check if content was blocked
    if (response.action === 'GUARDRAIL_INTERVENED') {
      const reasons = response.assessments?.map(assessment => 
        `${assessment.type}: ${assessment.guardrailCoverage?.type || 'unknown'}`
      ).join(', ') || 'Policy violation';
      
      return {
        allowed: false,
        reason: reasons,
        details: response.assessments
      };
    }

    // Content passed validation
    return {
      allowed: true,
      reason: 'Content approved'
    };

  } catch (error) {
    console.error('Guardrails API Error:', error);
    
    // Fail closed - reject if we can't validate
    return {
      allowed: false,
      reason: 'Validation service unavailable',
      error: error.message
    };
  }
}

// Handle validation request
async function handleValidation(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { prompt } = body;
    
    // Basic input validation
    if (!prompt || typeof prompt !== 'string') {
      return createResponse(400, {
        success: false,
        message: 'Invalid request: prompt is required and must be a string'
      });
    }
    
    if (prompt.length === 0) {
      return createResponse(400, {
        success: false,
        message: 'Invalid request: prompt cannot be empty'
      });
    }

    // Validate with Guardrails
    const validation = await validatePrompt(prompt);
    
    if (validation.allowed) {
      // Content is safe - forward to video service
      logRequest(prompt, 'ALLOWED', validation.reason);
      return await forwardToVideoService(event);
    } else {
      // Content violates policies - reject
      logRequest(prompt, 'BLOCKED', validation.reason);
      return createResponse(422, {
        success: false,
        allowed: false,
        message: MODERATION_CONFIG.messages.blocked,
        details: {
          reason: validation.reason,
          assessments: validation.details || []
        }
      });
    }

  } catch (error) {
    console.error('Validation Error:', error);
    
    return createResponse(500, {
      success: false,
      allowed: false,
      message: MODERATION_CONFIG.messages.error,
      error: 'Internal server error'
    });
  }
}

// Handle batch validation
async function handleBatchValidation(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { prompts } = body;
    
    if (!Array.isArray(prompts)) {
      return createResponse(400, {
        success: false,
        message: 'Invalid request: prompts must be an array'
      });
    }

    const results = await Promise.all(
      prompts.map(async (prompt, index) => {
        const validation = await validatePrompt(prompt);
        return {
          index,
          prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
          allowed: validation.allowed,
          reason: validation.reason
        };
      })
    );

    return createResponse(200, {
      success: true,
      results: results,
      summary: {
        total: prompts.length,
        allowed: results.filter(r => r.allowed).length,
        blocked: results.filter(r => !r.allowed).length
      }
    });

  } catch (error) {
    console.error('Batch Validation Error:', error);
    return createResponse(500, {
      success: false,
      message: 'Batch validation failed'
    });
  }
}

// Handle health check
async function handleHealth() {
  return createResponse(200, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      guardrailId: MODERATION_CONFIG.guardrailId,
      version: MODERATION_CONFIG.guardrailVersion
    }
  });
}

// Handle config request
async function handleConfig() {
  return createResponse(200, {
    guardrailId: MODERATION_CONFIG.guardrailId,
    guardrailVersion: MODERATION_CONFIG.guardrailVersion,
    loggingEnabled: MODERATION_CONFIG.enableLogging,
    messages: MODERATION_CONFIG.messages
  });
}

// Main Lambda handler
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createResponse(200, { message: 'OK' });
  }
  
  const path = event.path || event.rawPath || '/';
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
  
  try {
    // Route the request
    if (method === 'POST' && path === '/validate') {
      return await handleValidation(event);
    }
    
    if (method === 'POST' && path === '/validate-batch') {
      return await handleBatchValidation(event);
    }
    
    if (method === 'GET' && path === '/health') {
      return await handleHealth();
    }
    
    if (method === 'GET' && path === '/config') {
      return await handleConfig();
    }
    
    // Default route
    return createResponse(404, {
      success: false,
      message: 'Not found',
      availableEndpoints: [
        'POST /validate - Validate and forward to video service',
        'POST /validate-batch - Batch validation (returns results only)', 
        'GET /health - Service health check',
        'GET /config - View current configuration'
      ]
    });
    
  } catch (error) {
    console.error('Handler Error:', error);
    return createResponse(500, {
      success: false,
      message: 'Internal server error'
    });
  }
};
