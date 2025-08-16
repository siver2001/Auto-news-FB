// src/logger.js
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import stringSimilarity from 'string-similarity';

const DATA_DIR = path.resolve('./data');
const LOG_FILE = path.join(DATA_DIR, 'log.json');

/**
 * Đảm bảo thư mục 'data' và file 'log.json' luôn tồn tại.
 */
function ensureLog() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, '[]', 'utf-8');
  }
}

/**
 * Đọc toàn bộ các entry từ log.json.
 * Nếu file bị lỗi, sẽ tạo lại file rỗng và trả về một mảng rỗng.
 * @returns {Array<object>} Mảng các entry đã log.
 */
export function loadLogEntries() {
  ensureLog();
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf-8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('❌ Lỗi đọc log.json, tái tạo file mới:', err.message);
    fs.writeFileSync(LOG_FILE, '[]', 'utf-8');
    return [];
  }
}

/**
 * Đếm số bài đã đăng trong ngày hôm nay.
 * @returns {number}
 */
export function countPostsToday() {
  const logs = loadLogEntries();
  const today = new Date().toISOString().slice(0, 10); // Format "YYYY-MM-DD"
  return logs.filter(e => e.timestamp && e.timestamp.startsWith(today)).length;
}

/**
 * Kiểm tra xem một link đã được đăng trước đó hay chưa.
 * @param {string} link - Link cần kiểm tra.
 * @param {Array<object>} [entries=null] - (Tùy chọn) Mảng log đã tải sẵn để tránh đọc lại file.
 * @returns {boolean}
 */
export function isLinkPosted(link, entries = null) {
  const logs = entries || loadLogEntries();
  return logs.some(e => e.link === link);
}

/**
 * Kiểm tra xem tiêu đề có quá giống với một tiêu đề đã đăng trước đó không.
 * @param {string} title - Tiêu đề cần kiểm tra.
 * @param {Array<object>} [entries=null] - (Tùy chọn) Mảng log đã tải sẵn.
 * @param {number} [threshold=0.85] - Ngưỡng tương đồng (từ 0 đến 1).
 * @returns {boolean}
 */
export function isTitleSimilarToLog(title, entries = null, threshold = 0.85) {
  const logs = entries || loadLogEntries();
  if (!title) return false;
  return logs.some(e =>
    e.title && stringSimilarity.compareTwoStrings(e.title, title) > threshold
  );
}

/**
 * Kiểm tra xem một ảnh (dựa trên mã hash) đã được đăng chưa.
 * @param {string} imgHash - Mã hash MD5 của ảnh cần kiểm tra.
 * @param {Array<object>} [entries=null] - (Tùy chọn) Mảng log đã tải sẵn.
 * @returns {boolean}
 */
export function isImageHashPosted(imgHash, entries = null) {
    const logs = entries || loadLogEntries();
    if (!imgHash) return false;
    return logs.some(e => e.imgHash === imgHash);
}

/**
 * Lưu một entry mới vào log.json.
 * @param {object} logData - Dữ liệu của bài viết cần ghi vào log.
 * @property {string} link - Link bài viết.
 * @property {string} title - Tiêu đề gốc.
 * @property {string} rewritten - Nội dung đã viết lại.
 * @property {string|null} image - URL ảnh gốc.
 * @property {string|null} imgHash - Mã hash của ảnh.
 * @property {Array<string>} topics - Danh sách chủ đề.
 * @property {Array<string>} hashtags - Danh sách hashtag.
 */
export function saveLogEntry(logData) {
  ensureLog();
  const logs = loadLogEntries();

  // Dữ liệu entry đã bao gồm imgHash được tính từ trước trong main.mjs
  const entry = {
    link: logData.link,
    title: logData.title,
    rewritten: logData.rewritten,
    image: logData.image || null,
    imgHash: logData.imgHash || null, // Nhận hash trực tiếp
    topics: logData.topics || [],
    hashtags: logData.hashtags || [],
    timestamp: new Date().toISOString()
  };

  logs.push(entry);
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
}