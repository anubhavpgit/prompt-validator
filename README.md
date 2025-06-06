# Prompt Validator

A validation layer for prompts using AWS Bedrock Guardrails. This service acts as a gateway that validates content before forwarding requests to your main video generation service.

## Features

- **Content Validation**: Uses AWS Bedrock Guardrails to validate prompts against configurable policies
- **Gateway Architecture**: Acts as a proxy - blocks harmful content, forwards safe content
- **Batch Processing**: Supports validating multiple prompts at once
- **Health Monitoring**: Built-in health check and configuration endpoints
- **CORS Support**: Ready for web applications

## Architecture

```
Client Request ’ Prompt Validator ’ AWS Bedrock Guardrails
                       “
                 [BLOCKED] Return error
                       “
                 [ALLOWED] Forward to Video Service ’ Return response
```

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure AWS Credentials**
   - Set up AWS CLI or environment variables
   - Ensure your AWS account has Bedrock access

3. **Update Configuration**
   Edit the `MODERATION_CONFIG` object in `index.js`:
   ```javascript
   const MODERATION_CONFIG = {
     guardrailId: 'your-guardrail-id',
     guardrailVersion: 'DRAFT',
     videoServiceUrl: 'https://your-video-service.com/generate',
     // ... other settings
   };
   ```

## API Endpoints

### POST /validate
Validates a prompt and forwards to video service if approved.

**Request:**
```json
{
  "prompt": "Generate a video of a sunset"
}
```

**Response (Approved):**
```json
{
  "success": true,
  "video_url": "https://...",
  "message": "Video generated successfully"
}
```

**Response (Blocked):**
```json
{
  "success": false,
  "allowed": false,
  "message": "Content violates our community guidelines",
  "details": {
    "reason": "HARMFUL_CONTENT: violence",
    "assessments": [...]
  }
}
```

### POST /validate-batch
Validates multiple prompts and returns results (doesn't forward).

**Request:**
```json
{
  "prompts": [
    "Generate a peaceful landscape",
    "Create an educational video"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "index": 0,
      "prompt": "Generate a peaceful landscape",
      "allowed": true,
      "reason": "Content approved"
    }
  ],
  "summary": {
    "total": 2,
    "allowed": 1,
    "blocked": 1
  }
}
```

### GET /health
Health check endpoint.

### GET /config
View current configuration.

## Deployment

This service is designed to run as an AWS Lambda function with API Gateway. The handler is already configured for Lambda deployment.

## Environment Variables

- `AWS_REGION`: AWS region for Bedrock service (default: us-east-1)

## License

ISC