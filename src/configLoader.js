// src/configLoader.js
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

/**
 * Trả về đường dẫn file config.json tại thư mục dự án
 * (cùng cấp với main.mjs). File này sẽ là nguồn cấu hình duy nhất.
 */
function getProjectConfigPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // src/configLoader.js -> lên 1 cấp là project root
  const projectRoot = path.resolve(__dirname, '..');
  const configFilePath = path.join(projectRoot, 'config.json');
  console.log(`[ConfigLoader] Sử dụng file cấu hình tại: ${configFilePath}`);
  return configFilePath;
}

/**
 * Đường dẫn legacy (AppData/.config) để hỗ trợ di trú cấu hình cũ nếu có
 */
function getLegacyConfigPath() {
  const APP_NAME = 'Auto Update FB';
  const legacyDir = path.join(
    os.homedir(),
    process.platform === 'win32' ? 'AppData/Roaming' : '.config',
    APP_NAME
  );
  return path.join(legacyDir, 'config.json');
}

/**
 * Tạo cấu hình mặc định nếu chưa có file.
 * Thêm cả CLOUD_API_URL để linh hoạt chọn nhà cung cấp.
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

export function loadConfig() {
  const projectPath = getProjectConfigPath();

  // 1) Nếu đã có file tại thư mục dự án -> đọc luôn
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

  // 2) Nếu chưa có, thử di trú từ file legacy (AppData/.config)
  const legacyPath = getLegacyConfigPath();
  if (fs.existsSync(legacyPath)) {
    try {
      const raw = fs.readFileSync(legacyPath, 'utf-8');
      const legacyConfig = JSON.parse(raw);
      fs.writeFileSync(projectPath, JSON.stringify(legacyConfig, null, 2));
      console.log('[ConfigLoader] ✅ Đã di trú cấu hình từ legacy sang project config.json.');
      return legacyConfig;
    } catch (err) {
      console.warn('[ConfigLoader] ⚠️ Không thể di trú cấu hình legacy:', err.message);
    }
  }

  // 3) Không có file nào -> tạo mới mặc định tại project
  const def = getDefaultConfig();
  fs.writeFileSync(projectPath, JSON.stringify(def, null, 2));
  console.log('[ConfigLoader] Tạo file cấu hình mặc định tại project.');
  return def;
}

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
