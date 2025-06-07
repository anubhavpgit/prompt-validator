// Dummy Video Service Lambda Function
// This simulates a video generation service for testing

function createResponse(statusCode, body) {
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
      },
      body: JSON.stringify(body)
    };
  }
  
  exports.handler = async (event, context) => {
    console.log('Dummy Video Service - Event:', JSON.stringify(event, null, 2));
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'OK' });
    }
    
    try {
      const body = JSON.parse(event.body || '{}');
      const { prompt } = body;
      
      // Simulate video generation processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Return success response with dummy video data
      return createResponse(200, {
        success: true,
        message: "Video generated successfully",
        data: {
          videoId: `video_${Date.now()}`,
          prompt: prompt,
          status: "completed",
          duration: "30s",
          url: `https://example.com/videos/video_${Date.now()}.mp4`,
          thumbnail: `https://example.com/thumbnails/thumb_${Date.now()}.jpg`,
          generatedAt: new Date().toISOString(),
          processingTime: "1.2s"
        }
      });
      
    } catch (error) {
      console.error('Dummy Video Service Error:', error);
      return createResponse(500, {
        success: false,
        message: "Video generation failed",
        error: error.message
      });
    }
  };