// src/httpAuth.js

// Đối tượng ánh xạ các model với URL API tương ứng
const API_URLS = {
  // Google
  'gemini-pro': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
  'gemini-1.5-pro': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
  'gemini-2.0-flash': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',

  // OpenAI
  'gpt-3.5-turbo': 'https://api.openai.com/v1/chat/completions',
  'gpt-4o': 'https://api.openai.com/v1/chat/completions',
  'gpt-4': 'https://api.openai.com/v1/chat/completions',

  // Groq
  'llama3-8b-8192': 'https://api.groq.com/openai/v1/chat/completions',
  'llama3-70b-8192': 'https://api.groq.com/openai/v1/chat/completions',

  // OpenRouter (mặc định)
  'default-openrouter': 'https://openrouter.ai/api/v1/chat/completions',
};

/**
 * Tự động xác định URL API dựa trên tên model.
 * @param {object} config - Đối tượng cấu hình.
 * @returns {string} URL API phù hợp.
 */
export function getApiUrl(config) {
  const { AI_SOURCE, LOCAL_AI_URL, MODEL, CLOUD_API_URL } = config;

  if (AI_SOURCE === 'local') {
    const base = (LOCAL_AI_URL || 'http://localhost:1234/v1').replace(/\/+$/, '');
    return `${base}/chat/completions`;
  }

  // Ưu tiên CLOUD_API_URL nếu được cung cấp (cho các API không phổ biến)
  if (CLOUD_API_URL && CLOUD_API_URL.trim()) {
    return CLOUD_API_URL.trim();
  }

  // Tự động tìm URL dựa trên tên model
  const apiUrl = API_URLS[MODEL] || API_URLS['default-openrouter'];

  // Xử lý một số trường hợp đặc biệt
  if (apiUrl.includes('generativelanguage.googleapis.com')) {
    // API của Google yêu cầu endpoint cụ thể
    return apiUrl;
  }

  // Các API tương thích OpenAI
  return apiUrl;
}

/**
 * Xây dựng headers xác thực dựa trên nguồn AI.
 * @param {object} config - Đối tượng cấu hình.
 * @returns {object} Headers xác thực.
 */
export function buildAuthHeaders(config) {
  const { API_KEY, AI_SOURCE } = config;
  const resolvedUrl = getApiUrl(config);

  if (AI_SOURCE === 'local') {
    return { 'Content-Type': 'application/json' };
  }

  // Google Generative Language (OpenAI-compatible)
  if (resolvedUrl.includes('generativelanguage.googleapis.com')) {
    const h = { 'Content-Type': 'application/json' };
    if (API_KEY) {
      h['x-goog-api-key'] = API_KEY;
    }
    return h;
  }

  // Mặc định: OpenAI / OpenRouter / Groq / Together / DeepSeek / v.v…
  return {
    'Content-Type': 'application/json',
    ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {})
  };
}