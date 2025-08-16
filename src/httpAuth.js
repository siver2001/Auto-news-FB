export function getApiUrl(config) {
  const { AI_SOURCE, LOCAL_AI_URL, CLOUD_API_URL } = config;
  if (AI_SOURCE === 'local') {
    const base = (LOCAL_AI_URL || 'http://localhost:1234/v1').replace(/\/+$/, '');
    return `${base}/chat/completions`;
  }
  return (CLOUD_API_URL && CLOUD_API_URL.trim()) || 'https://openrouter.ai/api/v1/chat/completions';
}

export function buildAuthHeaders(config) {
  const { API_KEY, AI_SOURCE, CLOUD_API_URL } = config;

  if (AI_SOURCE === 'local') return { 'Content-Type': 'application/json' };

  const url = (CLOUD_API_URL || '').toLowerCase();

  // Google Generative Language (OpenAI-compatible)
  if (url.includes('generativelanguage.googleapis.com')) {
    const h = { 'Content-Type': 'application/json' };
    if (API_KEY) {
      // Gửi cả 2 để tương thích mọi gateway Google
      h['x-goog-api-key'] = API_KEY;
      h['Authorization'] = `Bearer ${API_KEY}`;
    }
    return h;
  }

  // Azure OpenAI (tuỳ chọn)
  if (url.includes('.openai.azure.com')) {
    return {
      'Content-Type': 'application/json',
      'api-key': API_KEY || ''
    };
  }

  // Mặc định: OpenAI / OpenRouter / Groq / Together / DeepSeek / v.v…
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {})
  };
}
