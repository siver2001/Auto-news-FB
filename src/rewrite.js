// src/rewrite.js
import { getApiUrl, buildAuthHeaders } from './httpAuth.js';
export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export async function rewriteContent({ title, originalContent }, config) {
  const { API_KEY, MODEL, AI_SOURCE } = config;
  const API_URL = getApiUrl(config);

  const prompt = `
Bạn là một **biên tập viên tin tức chuyên nghiệp và giàu kinh nghiệm**, đang làm việc cho một fanpage cộng đồng. Nhiệm vụ của bạn là chắt lọc thông tin và viết lại một cách lôi cuốn, nhưng vẫn đảm bảo tính **trung thực và khách quan tuyệt đối**.

**NGUYÊN TẮC CỐT LÕI (BẮT BUỘC):**
* Mọi thông tin trong bài viết phải được rút ra hoàn toàn từ **"Nội dung gốc"**.
* Không được phép thêm ý kiến cá nhân, suy đoán hay thông tin ngoài lề.
* Hãy giữ nguyên các con số, mốc thời gian, tên người, tên địa danh.
* Tuyệt đối không chèn đường link hay hashtag nếu không có trong bài gốc.
* Giữ khoảng cách nội dung trong khoảng **50–150 từ**.

**PHONG CÁCH & CẤU TRÚC MỚI (CHUYÊN NGHIỆP & TỰ NHIÊN):**
* **Tiêu đề**: Tạo một tiêu đề mới, cực ngắn gọn, hấp dẫn và giật gân, dí dỏm tùy trường hợp để thu hút người dùng. Viết IN HOA toàn bộ, không có dấu chấm.
* **Khoảng cách**: Sau tiêu đề, xuống dòng và bỏ thêm 1 dòng trống rồi mới viết tiếp nội dung kế tiếp.
* **Nội dung**: Viết lại nội dung hoàn chỉnh, sau mỗi câu (dấu chấm câu), xuống dòng và cách 1 dòng.
* **Mở đầu**: Bắt đầu bài viết bằng một câu tóm tắt chính, xuống 1 dòng và cách 1 dòng để không bị nhầm lẫn với tiêu đề ,in đậm để thu hút sự chú ý. Có thể dùng 1-2 emoji phù hợp.
* **Thân bài**: Phát triển nội dung một cách tự nhiên, nối tiếp các ý chính bằng các từ ngữ chuyển tiếp như "Đáng chú ý," "Bên cạnh đó," để bài viết thêm chuyên nghiệp.
* **Tương tác**: Kết thúc bằng một câu hỏi mở, khơi gợi sự thảo luận tích cực từ cộng đồng.

---

**ĐỊNH DẠNG ĐẦU RA (Từng câu một):**
TIÊU ĐỀ HẤP DẪN, NGẮN GỌN. Có thể kèm emoji nếu cần

**Câu tóm tắt chính (in đậm) có kèm emoji nếu cần:.**

Nội dung bài viết hoàn chỉnh .Sau mỗi dấu chấm câu, xuống dòng và cách một dòng mới viết tiếp.

Câu hỏi mở.


---
TIÊU ĐỀ GỐC: ${title}
NỘI DUNG GỐC:
\`\`\`
${originalContent}
\`\`\`
  `.trim();


  if (AI_SOURCE === 'cloud' && !API_KEY) {
    throw new Error("Chưa cấu hình API Key cho chế độ Cloud.");
  }
  
  let retries = 3;
  while(retries > 0) {
    try {
      const res = await fetch(API_URL, {
          method: 'POST',
          headers: buildAuthHeaders(config),
          body: JSON.stringify({
              model: MODEL,
              messages: [
                  { role: 'system', content: 'Bạn là một biên tập viên tin tức chuyên nghiệp, chỉ tóm tắt nội dung được cung cấp.' },
                  { role: 'user', content: prompt }
              ]
          })
      });
      
      const rawResponseText = await res.text();
  
      if (!res.ok) {
          if (res.status === 429) { 
            const errorJson = JSON.parse(rawResponseText);
            const retryInfo = errorJson.error?.details?.find(d => d['@type'] === 'type.googleapis.com/google.rpc.RetryInfo');
            const retryDelaySeconds = retryInfo ? parseInt(retryInfo.retryDelay) : 60; // Default to 60s
            console.warn(`⏳ Rate limit exceeded. Retrying in ${retryDelaySeconds}s...`);
            await new Promise(resolve => setTimeout(resolve, retryDelaySeconds * 1000));
            retries--;
            continue; // Retry the loop
          }
          throw new Error(`Lỗi API (${res.status}): ${rawResponseText}`);
      }
      
      const json = JSON.parse(rawResponseText);
      const text = json.choices?.[0]?.message?.content.trim();
      
      if (!text) { throw new Error("AI trả về nội dung trống."); }
  
      return text;

    } catch (error) {
      if (error instanceof RateLimitError) {
        // This case is now handled inside the fetch block
      }
      throw error;
    }

  }

    throw new RateLimitError("Vượt quá số lần thử lại cho API AI do Rate Limit.");
}