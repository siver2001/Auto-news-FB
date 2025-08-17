// File: src/rewrite_manual.js
// Phiên bản nâng cấp để tạo nội dung 'giống AI' hơn bằng thuật toán.
// Mô phỏng việc viết lại, chọn tiêu đề và câu hỏi theo ngữ cảnh.

export async function rewriteManual({ title, originalContent }) {
    // ------------------- Cấu hình & Dữ liệu -------------------
    if (!originalContent || originalContent.trim().length < 50) {
        return `[CẬP NHẬT] ${title}\n\n(Nội dung quá ngắn để tóm tắt)`;
    }

    // Các ngưỡng và hằng số
    const MIN_WORDS = 50;
    const MAX_WORDS = 150;
    const TARGET = 100;
    const STOP_WORDS = new Set(['và', 'là', 'có', 'của', 'ở', 'tại', 'trong', 'trên', 'cho', 'đến', 'khi', 'bị', 'được', 'với', 'cũng', 'đã', 'thì', 'một', 'những', 'các', 'rằng', 'theo', 'không', 'chỉ', 'sẽ', 'nên', 'nếu', 'tuy', 'tuy nhiên', 'bởi']);

    // Mẫu câu hỏi dựa trên ngữ cảnh
    const QUESTION_TEMPLATES = {
        'pháp luật': [
            'Bạn nghĩ gì về vụ việc này dưới góc độ pháp lý?',
            'Bạn có đồng tình với cách xử lý của cơ quan chức năng không?',
            'Liệu có nên có những biện pháp răn đe mạnh hơn không?',
        ],
        'kinh tế': [
            'Theo bạn, động thái này sẽ tác động như thế nào đến thị trường?',
            'Bạn có lời khuyên nào cho các nhà đầu tư trong bối cảnh này?',
            'Đâu là cơ hội và thách thức của ngành này trong thời gian tới?',
        ],
        'công nghệ': [
            'Bạn nghĩ gì về sự phát triển của công nghệ này?',
            'Liệu công nghệ này có thay đổi cuộc sống của chúng ta không?',
            'Bạn đã từng trải nghiệm sản phẩm này chưa? Hãy chia sẻ nhé!',
        ],
        'xã hội': [
            'Bạn có lời khuyên nào để giải quyết vấn đề này không?',
            'Theo bạn, đâu là nguyên nhân cốt lõi của sự việc?',
            'Bạn đã bao giờ trải qua tình huống tương tự chưa? Hãy chia sẻ nhé!',
        ],
        'giải trí': [
            'Bạn có ấn tượng gì về nhân vật/sự kiện này?',
            'Bạn nghĩ sao về màn trình diễn này?',
            'Bạn đã xem bộ phim/nghe bài hát này chưa? Hãy chia sẻ cảm nhận!',
        ],
        'sức khỏe': [
            'Bạn nghĩ sao về những lời khuyên sức khỏe này?',
            'Bạn có kinh nghiệm nào trong việc chăm sóc sức khỏe không?',
            'Bạn có đang áp dụng những thói quen này không?',
        ],
        'thể thao': [
            'Bạn nghĩ gì về kết quả trận đấu này?',
            'Theo bạn, chiến thuật của đội bóng có điểm gì cần cải thiện?',
            'Khoảnh khắc nào trong trận đấu khiến bạn ấn tượng nhất?',
        ],
        'du lịch': [
            'Bạn có gợi ý nào về các điểm đến đẹp khác không?',
            'Bạn đã từng ghé thăm địa điểm này chưa?',
            'Bạn nghĩ đâu là điểm thu hút nhất của địa danh này?',
        ],
        'môi trường': [
            'Theo bạn, chúng ta cần làm gì để bảo vệ môi trường?',
            'Bạn nghĩ sao về những giải pháp được đề xuất?',
            'Hãy chia sẻ những hành động xanh mà bạn đã thực hiện nhé!',
        ],
        'mặc định': [
            'Bạn nghĩ sao về vấn đề này?',
            'Theo bạn, đâu là giải pháp phù hợp lúc này?',
            'Bạn có đồng tình với nhận định trên không?',
            'Góc nhìn của bạn về sự việc này là gì?',
            'Đây là một thông tin đáng chú ý. Bạn có đồng tình không?',
        ],
    };
    
    // Mẫu tiêu đề và emoji dựa trên cảm xúc của bài viết
    const TITLE_TEMPLATES = {
        'cảnh báo': {
            tags: ['🚨 CẢNH BÁO', '🆘 KHẨN CẤP', '⚠️ VÔ CÙNG QUAN TRỌNG'],
            emojis: ['🚨', '🔥', '😱', '❗'],
        },
        'tích cực': {
            tags: ['🎉 TIN VUI', '✨ ĐÁNG MỪNG', '💖 ẤM LÒNG'],
            emojis: ['🎉', '✨', '⭐', '🥰'],
        },
        'bất ngờ': {
            tags: ['🤯 KHÔNG THỂ TIN NỔI', '😲 BẤT NGỜ', '💡 BÍ MẬT ĐÃ HÉ LỘ'],
            emojis: ['🤯', '😱', '😲', '🤔'],
        },
        'thông báo': {
            tags: ['📢 THÔNG BÁO MỚI', '✅ ĐÃ CÓ KẾT LUẬN', '📜 QUYẾT ĐỊNH QUAN TRỌNG'],
            emojis: ['📢', '✅', '📝', '📌'],
        },
        'mặc định': {
            tags: ['🆕 TIN MỚI NHẤT', '📰 ĐANG GÂY SỐT', '👀 ĐỪNG BỎ LỠ'],
            emojis: ['🆕', '🔥', '👀', '💬'],
        }
    };
    
    // ------------------- Xử lý nội dung -------------------
    const normalize = s => s.replace(/\s+/g, ' ').trim();
    const sentences = (originalContent.match(/[^\.!\?]+[\.!\?]+/g) || [normalize(originalContent) + '.'])
        .map(normalize);
    const wordCount = str => (str.match(/\b\w+\b/g) || []).length;
    const freqs = {};
    const lowerContent = originalContent.toLowerCase();
    lowerContent.split(/\s+/).forEach(w => {
        const t = w.replace(/[()'",.:\-;!?“”]/g, '').trim();
        if (t.length > 2 && !STOP_WORDS.has(t)) freqs[t] = (freqs[t] || 0) + 1;
    });
    const titleWords = title.toLowerCase().split(/\s+/).filter(w => !STOP_WORDS.has(w));
    
    let bestSentences = [];
    let currentWordCount = 0;
    
    // Chấm điểm và chọn câu cho phần thân bài
    const scored = sentences.map((s, idx) => {
        const words = s.split(/\s+/);
        let score = 0;
        const lowerSentence = s.toLowerCase().split(/\s+/);

        // Tiêu chí 1: từ khóa tiêu đề
        titleWords.forEach(tw => { if (lowerSentence.includes(tw)) score += 10; });
        // Tiêu chí 2: mật độ từ khóa
        lowerSentence.forEach(w => {
            const cleanWord = w.replace(/[()'",.:\-;!?“”]/g, '');
            if (freqs[cleanWord]) score += freqs[cleanWord];
        });
        // Tiêu chí 3: tên riêng & số liệu
        words.forEach((w, i) => {
            if (/^[A-ZĐÀ-Ỹ]/.test(w) && i > 0) score += 5;
            if (/\d/.test(w)) score += 3;
        });
        // Tiêu chí 4: vị trí câu
        if (idx < 3) score *= 1.5;

        const sentenceLength = words.length;
        const isValid = sentenceLength > 4 && sentenceLength < 50;
        return { s, idx, score: isValid ? score / Math.sqrt(sentenceLength) : 0 };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

    // Xây dựng phần thân bài
    let takenSentences = new Set();
    for (const s of scored) {
        if (currentWordCount + wordCount(s.s) <= TARGET) {
            bestSentences.push(s);
            currentWordCount += wordCount(s.s);
            takenSentences.add(s.idx);
        }
    }
    
    // Đảm bảo có ít nhất 3 câu nếu có thể, và không vượt quá MAX_WORDS
    if (bestSentences.length < 3) {
      for (const s of scored) {
        if (!takenSentences.has(s.idx) && (currentWordCount + wordCount(s.s) <= MAX_WORDS)) {
          bestSentences.push(s);
          takenSentences.add(s.idx);
          if (bestSentences.length >= 3) break;
        }
      }
    }
    
    // Nếu vẫn thiếu từ, thêm các câu chưa được chọn một cách tuần tự
    for (let i = 0; i < sentences.length; i++) {
        if (!takenSentences.has(i) && (currentWordCount + wordCount(sentences[i]) <= MAX_WORDS)) {
            bestSentences.push({ s: sentences[i], idx: i, score: 0 });
            currentWordCount += wordCount(sentences[i]);
            takenSentences.add(i);
        }
    }

    // Nếu sau khi lấy hết câu quan trọng vẫn chưa đủ MIN_WORDS,
    // ta sẽ lấy thêm các câu khác cho đủ.
    if (currentWordCount < MIN_WORDS) {
        for (let i = 0; i < sentences.length; i++) {
            if (!takenSentences.has(i) && (currentWordCount + wordCount(sentences[i]) <= MAX_WORDS)) {
                bestSentences.push({ s: sentences[i], idx: i, score: 0 });
                currentWordCount += wordCount(sentences[i]);
                takenSentences.add(i);
            }
        }
    }

    // Sắp xếp lại theo thứ tự ban đầu
    bestSentences.sort((a, b) => a.idx - b.idx);
    
    // ------------------- Tạo bài viết cuối cùng -------------------
    let finalTitle = title.replace(/\[[^\]]+\]\s*/g, '').trim();
    let finalSummary = '';
    let finalBody = '';
    let finalQuestion = '';

    // Lựa chọn mẫu tiêu đề dựa trên từ khóa cảm xúc
    let titleEmotion = 'mặc định';
    if (/\b(lỗi|bị chặn|tự tử|tai nạn|mất tích|chết|tố|kiện|bắt|lừa đảo|cảnh báo|khẩn|thiệt hại|phẫn nộ|hành hung)\b/i.test(finalTitle)) {
      titleEmotion = 'cảnh báo';
    } else if (/\b(vinh danh|thành công|thắng|vô địch|kỷ lục|vượt đỉnh|tin vui|lên ngôi|sáng giá)\b/i.test(finalTitle)) {
      titleEmotion = 'tích cực';
    } else if (/\b(bất ngờ|hóa ra|tiết lộ|ngã ngửa|chấn động|sốc)\b/i.test(finalTitle)) {
      titleEmotion = 'bất ngờ';
    } else if (/\b(thông báo|quyết định|chỉ đạo|khai mạc)\b/i.test(finalTitle)) {
      titleEmotion = 'thông báo';
    }
    const titleTemplate = TITLE_TEMPLATES[titleEmotion];
    const randomTag = titleTemplate.tags[Math.floor(Math.random() * titleTemplate.tags.length)];
    const randomEmoji = titleTemplate.emojis[Math.floor(Math.random() * titleTemplate.emojis.length)];
    
    // Đảm bảo tiêu đề mới có độ dài hợp lý
    let finalTitleText = `${randomTag} ${finalTitle}`.toUpperCase();
    if(wordCount(finalTitleText) > 20) {
        finalTitleText = `${randomEmoji} ${finalTitle}`.toUpperCase();
    }
    
    // Tạo câu tóm tắt chính (kết hợp các câu quan trọng nhất)
    if (bestSentences.length > 0) {
        finalSummary = `**${bestSentences[0].s}**`;
        finalBody = bestSentences.slice(1).map(s => s.s).join(' ');
    } else {
        finalSummary = `**${title}**`; // Fallback nếu không tìm thấy câu nào phù hợp
    }

    // Dọn dẹp phần thân bài
    if (finalBody) {
        finalBody = finalBody.replace(/([.!?])\s+(?=[A-ZÀ-Ỹ])/g, '$1\n- ');
    }
    
    // Ép độ dài nếu quá dài
    const finalWords = wordCount(finalBody);
    if (finalWords > MAX_WORDS) {
        finalBody = finalBody.split(/\s+/).slice(0, MAX_WORDS).join(' ') + '...';
    }
    
    // Chọn câu hỏi tương tác theo chủ đề của bài viết
    let questionKey = 'mặc định';
    if (/\b(luật|pháp luật|tòa án|tội phạm|công an)\b/i.test(lowerContent)) questionKey = 'pháp luật';
    else if (/\b(kinh tế|chứng khoán|đầu tư|doanh nghiệp|tài chính|giá cả)\b/i.test(lowerContent)) questionKey = 'kinh tế';
    else if (/\b(công nghệ|AI|điện thoại|phần mềm|samsung|apple)\b/i.test(lowerContent)) questionKey = 'công nghệ';
    else if (/\b(xã hội|cộng đồng|từ thiện|hành hung|vấn đề|tranh cãi)\b/i.test(lowerContent)) questionKey = 'xã hội';
    else if (/\b(nghệ sĩ|ca sĩ|diễn viên|phim|âm nhạc|showbiz|sao)\b/i.test(lowerContent)) questionKey = 'giải trí';
    else if (/\b(sức khỏe|bệnh|dinh dưỡng|lão hóa|bác sĩ|chăm sóc)\b/i.test(lowerContent)) questionKey = 'sức khỏe';
    else if (/\b(bóng đá|thể thao|giải đấu|huấn luyện viên)\b/i.test(lowerContent)) questionKey = 'thể thao';
    else if (/\b(du lịch|điểm đến|khách sạn|hành trình|phú quốc|đà lạt)\b/i.test(lowerContent)) questionKey = 'du lịch';
    else if (/\b(môi trường|rác thải|ô nhiễm|thực phẩm)\b/i.test(lowerContent)) questionKey = 'môi trường';

    const questionsList = QUESTION_TEMPLATES[questionKey];
    finalQuestion = questionsList[Math.floor(Math.random() * questionsList.length)];
    
    // Gộp tất cả các phần lại thành bài viết hoàn chỉnh
    const result = [
        finalTitleText,
        finalSummary,
        finalBody.trim(),
        finalQuestion,
    ].filter(Boolean).join('\n\n');
    
    return result;
}