// src/configLoader.js (Đã tái cấu trúc cho môi trường web)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Trả về đường dẫn file config.json tại thư mục gốc của dự án.
 */
function getProjectConfigPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // src/configLoader.js -> lên 1 cấp là project root
  const projectRoot = path.resolve(__dirname, '..');
  return path.join(projectRoot, 'config.json');
}

/**
 * Tạo cấu hình mặc định nếu chưa có file.
 */
function getDefaultConfig() {
  return {
    API_KEY: '',
    MODEL: 'qwen/qwen3-30b-a3b:free',
    AI_SOURCE: 'cloud',
    LOCAL_AI_URL: 'http://localhost:1234/v1',
    CLOUD_API_URL: 'https://openrouter.ai/api/v1/chat/completions',
    FB_PAGE_ID: '',
    FB_PAGE_TOKEN: '',
    FB_GRAPH_API_VERSION: 'v17.0',
    DEBUG_MODE: true,
    LOGO_PATH: '',
    REWRITE_MODE: 'ai',
    POST_INTERVAL_MINUTES: 5,
    CRAWL_LOOP_DELAY_MINUTES: 15,
    sources: ['https://cafef.vn', 'https://tuoitre.vn', 'https://dantri.com.vn'],
    USED: 0
  };
}

/**
 * Đọc cấu hình từ file config.json.
 * Nếu file không tồn tại hoặc bị lỗi, sẽ tạo file mặc định.
 * @returns {object} Đối tượng cấu hình.
 */
export function loadConfig() {
  const projectPath = getProjectConfigPath();

  if (fs.existsSync(projectPath)) {
    try {
      const raw = fs.readFileSync(projectPath, 'utf-8');
      console.log('[ConfigLoader] Đã đọc cấu hình từ project config.json.');
      return JSON.parse(raw);
    } catch (err) {
      console.error('[ConfigLoader] ❌ Lỗi đọc project config.json, sẽ tạo mới:', err.message);
      const def = getDefaultConfig();
      fs.writeFileSync(projectPath, JSON.stringify(def, null, 2));
      return def;
    }
  }

  // Nếu không có file nào -> tạo mới mặc định tại project
  const def = getDefaultConfig();
  fs.writeFileSync(projectPath, JSON.stringify(def, null, 2));
  console.log('[ConfigLoader] Tạo file cấu hình mặc định tại project.');
  return def;
}

/**
 * Lưu cấu hình vào file config.json.
 * @param {object} config - Đối tượng cấu hình cần lưu.
 */
export function saveConfig(config) {
  const projectPath = getProjectConfigPath();
  try {
    fs.writeFileSync(projectPath, JSON.stringify(config, null, 2));
    console.log('[ConfigLoader] ✅ Lưu cấu hình (project config.json) thành công.');
  } catch (error) {
    console.error(`[ConfigLoader] ❌ Không thể ghi file cấu hình tại ${projectPath}!`, error);
    throw new Error('Không thể ghi file cấu hình. Vui lòng kiểm tra quyền truy cập thư mục dự án.');
  }
}