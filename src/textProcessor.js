// File: src/textProcessor.js
export function postProcessText(text) {
  if (!text) return '';

  let cleanedText = text.trim();

  // 1. Xóa các dấu cách thừa
  cleanedText = cleanedText.replace(/\s{2,}/g, ' '); 
  cleanedText = cleanedText.replace(/\s+([,.?!:;])/g, '$1'); 

  // 2. Viết hoa chữ cái đầu tiên của toàn bộ văn bản
  if (cleanedText.length > 0) {
    cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
  }

  // 3. Viết hoa chữ cái đầu tiên của mỗi câu (sau dấu . ! ?)
  cleanedText = cleanedText.replace(/([.!?]\s+)([a-zà-ỹ])/g, (match, p1, p2) => {
    return p1 + p2.toUpperCase();
  });

  return cleanedText;
}