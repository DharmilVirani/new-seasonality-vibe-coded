// Simple health check endpoint for Docker
export async function GET() {
  return new Response(JSON.stringify({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'frontend'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}