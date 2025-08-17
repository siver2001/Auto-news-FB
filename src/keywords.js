// src/keywords.js
import { getApiUrl, buildAuthHeaders } from './httpAuth.js';
export async function extractKeywords(text, config, n = 5) {
  const { MODEL } = config;
  const API_URL = getApiUrl(config);

  const prompt = `
Bạn là chuyên gia SEO. Cho đoạn văn sau, hãy trích ra ${n} từ khóa chính liên quan nhất bằng tiếng Việt, phân tách bởi dấu phẩy.
Chỉ trả về danh sách keyword, không giải thích thêm.
---
"${text}"
  `;

  let retries = 3;
  while(retries > 0) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: buildAuthHeaders(config),
        body: JSON.stringify({
          model: MODEL,
          contents: [{
            role: 'user',
            parts: [{ text: prompt }]
          }]
        })
      });

      const rawResponseText = await res.text();

      if (!res.ok) {
        if (res.status === 429) {
          const errorJson = JSON.parse(rawResponseText);
          const retryInfo = errorJson.error?.details?.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          const retryDelaySeconds = retryInfo ? parseInt(retryInfo.retryDelay) : 60;
          console.warn(`❌ extractKeywords: Rate limit exceeded. Retrying in ${retryDelaySeconds}s...`);
          await new Promise(resolve => setTimeout(resolve, retryDelaySeconds * 1000));
          retries--;
          continue;
        }
        console.error(`❌ extractKeywords: Lỗi API (${res.status}):`, rawResponseText);
        return [];
      }
      
      const json = JSON.parse(rawResponseText);
      const textResponse = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const keywords = textResponse
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0 && k.length < 25);

      return keywords.map(k => '#' + k.replace(/\s+/g, ''));
    } catch (err) {
      console.error('❌ extractKeywords: Lỗi khi gọi API:', err.message || err);
      return [];
    }
  }

  return [];
}