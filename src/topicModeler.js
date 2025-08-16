// src/topicModeler.js
import { getApiUrl, buildAuthHeaders } from './httpAuth.js';
export async function classifyTopic(text, config) {
  const { MODEL } = config;
  const API_URL = getApiUrl(config);

  const prompt = `
Bạn là chuyên gia phân loại tin tức. Cho đoạn nội dung sau, hãy liệt kê tối đa 3 chủ đề chính (Tiếng Việt), phân tách bằng dấu phẩy.
Ví dụ: Kinh tế, Chứng khoán, Bất động sản
Chỉ trả lại danh sách chủ đề, không thêm bất kỳ giải thích hay ký tự nào khác.
---
${text}
---
`.trim();

  let retries = 3;
  while(retries > 0) {
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: buildAuthHeaders(config),
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: 'Bạn là một trợ lý AI chuyên phân loại nội dung tin tức một cách ngắn gọn và chính xác.' },
            { role: 'user', content: prompt }
          ]
        })
      });

      const rawResponseText = await res.text();

      if (!res.ok) {
        if (res.status === 429) {
          const errorJson = JSON.parse(rawResponseText);
          const retryInfo = errorJson.error?.details?.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
          const retryDelaySeconds = retryInfo ? parseInt(retryInfo.retryDelay) : 60;
          console.warn(`❌ classifyTopic: Rate limit exceeded. Retrying in ${retryDelaySeconds}s...`);
          await new Promise(resolve => setTimeout(resolve, retryDelaySeconds * 1000));
          retries--;
          continue;
        }
        console.error(`❌ classifyTopic: Lỗi API (${res.status}):`, rawResponseText);
        return [];
      }

      const json = JSON.parse(rawResponseText);
      const textResponse = json.choices?.[0]?.message?.content || '';
      
      return textResponse
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0 && t.length < 30);
    } catch (error) {
      console.error('❌ classifyTopic: Lỗi khi gọi API:', error.message || error);
      return [];
    }
  }
  
  return [];
}