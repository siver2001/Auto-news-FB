// server.js
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import { loadConfig, saveConfig } from './src/configLoader.js';
import {
  startCrawlingLoop,
  stopCrawlingLoop,
  removePostFromQueue,
  isCrawlingRunning,
  getPostQueue,
} from './index.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3000;
const LOGO_UPLOAD_DIR = path.join(__dirname, 'data', 'logo');

// Đảm bảo thư mục logo tồn tại
if (!fs.existsSync(LOGO_UPLOAD_DIR)) {
  fs.mkdirSync(LOGO_UPLOAD_DIR, { recursive: true });
}

// Cấu hình multer để xử lý file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, LOGO_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Lưu file với tên gốc
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'renderer')));

// Khởi tạo WebSocket Server trên cùng một port
const wss = new WebSocketServer({ noServer: true });

let wsClient = null;

wss.on('connection', ws => {
  console.log('Client đã kết nối WebSocket');
  wsClient = ws;
});

/**
 * Hàm callback để gửi log và trạng thái về Frontend qua WebSocket.
 * @param {string} message - Nội dung thông báo.
 * @param {string} type - Loại thông báo ('info', 'success', 'error', 'stopped', 'running', etc.).
 * @param {object|null} content - Dữ liệu bổ sung.
 */
function sendLogToClient(message, type = 'info', content = null) {
  if (wsClient && wsClient.readyState === wsClient.OPEN) {
    wsClient.send(JSON.stringify({ type: type, message: message, content: content }));
  }
}

// Endpoint lấy cấu hình
app.get('/api/config', (req, res) => {
  try {
    const config = loadConfig();
    res.json(config);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi đọc cấu hình.' });
  }
});

// Endpoint lưu cấu hình
app.post('/api/config', (req, res) => {
  try {
    const newConfig = req.body;
    saveConfig(newConfig);
    res.json({ success: true, message: '✅ Đã lưu cấu hình thành công!' });
  } catch (error) {
    res.status(500).json({ success: false, message: `Lỗi khi lưu cấu hình: ${error.message}` });
  }
});

// Endpoint TẢI LÊN logo
app.post('/api/upload-logo', upload.single('logo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Không có file nào được tải lên.' });
        }
        const logoPath = path.join(LOGO_UPLOAD_DIR, req.file.filename);
        res.json({ success: true, message: '✅ Đã tải logo lên server thành công!', logoPath });
    } catch (error) {
        res.status(500).json({ success: false, message: `Lỗi khi tải logo: ${error.message}` });
    }
});

// Endpoint bắt đầu luồng tự động
app.post('/api/start', async (req, res) => {
  const configUpdate = req.body;
  const currentConfig = loadConfig();
  Object.assign(currentConfig, configUpdate);
  saveConfig(currentConfig);

  // Khởi động luồng chính và chuyển hàm callback
  startCrawlingLoop(sendLogToClient);

  res.json({ success: true, message: '🚀 Đang khởi động luồng tự động...' });
});

// Endpoint dừng luồng tự động
app.post('/api/stop', (req, res) => {
  stopCrawlingLoop();
  res.json({ success: true, message: '🛑 Đang gửi yêu cầu dừng luồng tự động...' });
});

// Endpoint xóa bài viết khỏi hàng chờ
app.delete('/api/post/:link', (req, res) => {
  const { link } = req.params;
  const removed = removePostFromQueue(link);
  if (removed) {
    res.json({ success: true, message: '✅ Đã xóa bài viết khỏi hàng chờ.' });
  } else {
    res.status(404).json({ success: false, message: '❗ Không tìm thấy bài viết để xóa.' });
  }
});

// THÊM CÁC ENDPOINT ĐỒNG BỘ TRẠNG THÁI CHO FRONTEND
app.get('/api/status', (req, res) => {
  res.json({ isRunning: isCrawlingRunning });
});

app.get('/api/post-queue', (req, res) => {
  res.json({ postQueue: getPostQueue() });
});

const server = app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log(`Mở trình duyệt và truy cập http://localhost:${PORT}/index.html`);
});

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wss.handleUpgrade(request, socket, head, ws => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});