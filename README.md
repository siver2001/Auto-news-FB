# 📰 Auto News Poster for Facebook Fanpage

Đây là một công cụ tự động đăng tin tức lên Fanpage Facebook, được thiết kế với giao diện web thân thiện và các tính năng mạnh mẽ.

#### 🌟 Tính năng nổi bật:
* **Hệ thống Crawler thông minh**: Tự động cào tin tức từ các nguồn hàng đầu của Việt Nam như Zing, VNExpress, CafeF, Tuổi Trẻ và Dân Trí.
* **Xử lý nội dung linh hoạt**:
    * Sử dụng AI tiên tiến (Gemini, OpenAI, hoặc các mô hình tương thích khác) để viết lại nội dung một cách tự nhiên và hấp dẫn cho fanpage.
    * Hỗ trợ chế độ "thuật toán" để tóm tắt nội dung khi không dùng AI.
* **Tối ưu hóa hình ảnh**: Tự động chèn logo vào ảnh bài viết gốc để tạo dấu ấn thương hiệu.
* **Tự động hóa hoàn toàn**: Lên lịch đăng bài tự động lên fanpage thông qua Facebook Graph API.
* **Phân tích và gợi ý**:
    * Phân loại chủ đề và trích xuất từ khóa để gắn hashtag phù hợp cho mỗi bài viết.
    * Có tính năng phân tích các chủ đề đang thịnh hành trong các bài viết đã đăng.
* **Các tính năng tương tác tự động**: Tự động Like bài viết, thả cảm xúc vào bình luận và chia sẻ bài viết lên Story.

---

#### 🛠️ Cài đặt & Hướng dẫn sử dụng

1.  **Clone và cài đặt các gói cần thiết:**
    ```bash
    git clone <repo-url>
    cd auto-news-tool
    npm install
    ```
2.  **Thiết lập cấu hình:**
    * Chạy chương trình bằng lệnh `node server.js` để khởi động giao diện web.
    * Truy cập `http://localhost:3000` trên trình duyệt của bạn.
    * Điền các thông tin cần thiết vào form (API Key, Page ID, Page Token, v.v.). Bạn có thể chọn nguồn AI (Cloud hoặc Local) và chế độ viết lại (AI hoặc Thuật toán).
    * Chương trình sẽ tự động đọc và lưu cấu hình vào tệp `config.json`.
3.  **Bắt đầu tự động hóa:**
    * Nhấn nút "🚀 Bắt đầu" trên giao diện web.
    * Chương trình sẽ bắt đầu chu kỳ cào tin, xử lý và lập lịch đăng bài theo các cấu hình bạn đã thiết lập.

**Lưu ý:** Bạn cần cấp quyền `pages_manage_posts` cho Page Access Token Facebook để chương trình có thể đăng bài thành công.