# 📰 Auto News Poster for Facebook Fanpage

## Tính năng:
- Crawl tin tức từ Zing, VNExpress, CafeF, Tuổi Trẻ
- Viết lại bằng ChatGPT (OpenAI) cho phù hợp phong cách fanpage
- Tự động đăng lên fanpage qua Facebook Graph API

## Cài đặt

### 1. Clone & cài package
```bash
git clone <repo-url>
cd auto-news-tool
npm install
```

### 2. Thiết lập `.env`
```bash
cp .env.example .env
```
Thay thế giá trị `OPENAI_API_KEY`, `FB_PAGE_ID`, `FB_PAGE_TOKEN` bằng thông tin thật.

### 3. Chạy
```bash
node src/index.js
```
> Tool sẽ chạy ngay và tiếp tục mỗi 30 phút.

## Ghi chú:
- Bạn cần cấp quyền `pages_manage_posts` cho access token Facebook
- Bạn có thể deploy lên [Render.com](https://render.com), [Railway.app](https://railway.app), hoặc chạy tại VPS cá nhân.

**Chúc bạn viral khét lẹt! 🔥**