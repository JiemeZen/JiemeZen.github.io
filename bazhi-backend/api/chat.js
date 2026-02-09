// ============================================
// Serverless function to proxy DeepSeek API calls
// Keeps API key secure on the server
// ============================================

module.exports = async (req, res) => {
  // CORS headers - MUST be set first for all responses
  const allowedOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://jiemezen.github.io',
    'https://www.jimmyzeng.tech',
  ];
  
  const origin = req.headers.origin || '';
  
  // Set CORS headers only for allowed origins
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  } else {
    // Reject requests from unauthorized origins
    res.status(403).json({ error: 'Forbidden: Origin not allowed' });
    return;
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { messages, temperature, max_tokens } = req.body;
    
    // Validate request
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request body: messages array required' });
    }

    // Call DeepSeek API with your secret key from environment variable
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 2000
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'API request failed');
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to process request',
      message: error.message 
    });
  }
};
