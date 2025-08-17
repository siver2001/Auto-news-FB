// main.mjs
import { app, BrowserWindow, ipcMain, shell, dialog  } from 'electron';
import path from 'path';
import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadConfig, saveConfig } from './src/configLoader.js';

import axios from 'axios';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow = null;
let crawlerProcess = null;
let reelsProcess = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (crawlerProcess) {
            crawlerProcess.kill('SIGTERM');
            console.log('News crawler process stopped due to app close.');
        }
        if (reelsProcess) {
            reelsProcess.kill('SIGTERM');
            console.log('Reels crawler process stopped due to app close.');
        }
        app.quit();
    }
});

ipcMain.handle('get-config', () => loadConfig());

ipcMain.handle('save-config', (_event, newConfig) => {
    try {
        const config = loadConfig();
        const updatedConfig = { ...config, ...newConfig };
        saveConfig(updatedConfig);
        mainWindow.webContents.send('show-notification', { type: 'success', message: '✅ Đã lưu cấu hình thành công!' });
    } catch (error) {
        console.error("Lỗi khi lưu cấu hình:", error);
        mainWindow.webContents.send('show-notification', { type: 'error', message: `Lỗi khi lưu cấu hình: ${error.message}` });
    }
});

ipcMain.on('start-auto-post', (event, configUpdate) => {
    console.log('Nhận lệnh START AUTO POST');
    const currentConfig = loadConfig();
    Object.assign(currentConfig, configUpdate);
    saveConfig(currentConfig);

    if (!crawlerProcess || crawlerProcess.killed) {
        crawlerProcess = fork(path.join(__dirname, 'index.js'), [], {
            stdio: ['inherit', 'inherit', 'inherit', 'ipc']
        });

        crawlerProcess.on('message', (msg) => {
            if (msg.type === 'log') {
                mainWindow.webContents.send('show-notification', { type: 'info', message: msg.message });
            } else if (msg.type === 'new-content') {
                mainWindow.webContents.send('new-content-updated', msg.content);
            } else if (msg.type === 'status') {
                mainWindow.webContents.send('crawl-status', msg.message);
                if (msg.message === 'stopped') {
                    if (crawlerProcess) {
                        crawlerProcess.kill('SIGTERM');
                        crawlerProcess = null;
                    }
                }
            } else if (msg.type === 'post-success') { 
                // CHỖ NÀY ĐÃ ĐƯỢC SỬA: Chuyển tiếp thông điệp đăng bài thành công
                mainWindow.webContents.send('post-success-updated', msg.content);
            }
        });

        crawlerProcess.on('exit', (code, signal) => {
            console.log(`Crawler process exited with code ${code} and signal ${signal}`);
            mainWindow.webContents.send('show-notification', { type: 'stopped', message: `Tiến trình đã dừng (Code: ${code}, Signal: ${signal})` });
            crawlerProcess = null;
        });

        crawlerProcess.send({ command: 'start' });
        mainWindow.webContents.send('show-notification', { type: 'info', message: '🚀 Đang khởi động luồng tự động...' });
        mainWindow.webContents.send('crawl-status', 'running');
    } else {
        console.log('Crawler process already running.');
        mainWindow.webContents.send('show-notification', { type: 'info', message: '❗ Luồng tự động đã chạy rồi.' });
    }
});

ipcMain.on('stop-auto-post', () => {
    console.log('Nhận lệnh STOP AUTO POST');
    if (crawlerProcess) {
        crawlerProcess.send({ command: 'stop' });
        mainWindow.webContents.send('show-notification', { type: 'info', message: '🛑 Đang gửi yêu cầu dừng luồng tự động...' });
        mainWindow.webContents.send('crawl-status', 'stopping');

        // Thêm timeout để buộc tiến trình con phải dừng nếu nó không tự thoát sau 10 giây
        setTimeout(() => {
            if (crawlerProcess && !crawlerProcess.killed) {
                console.warn('⚠️ Tiến trình con không tự dừng, buộc phải kill.');
                crawlerProcess.kill('SIGKILL');
                crawlerProcess = null; // Đặt lại biến
                mainWindow.webContents.send('show-notification', { type: 'stopped', message: '🛑 Buộc dừng luồng tự động.' });
                mainWindow.webContents.send('crawl-status', 'stopped');
            }
        }, 10000); // Đợi 10 giây
    } else {
        console.log('No crawler process to stop.');
        mainWindow.webContents.send('show-notification', { type: 'info', message: '❗ Không có luồng tự động nào để dừng.' });
    }
});

ipcMain.on('start-reels-post', (event, configUpdate) => {
    console.log('Nhận lệnh START REELS POST');
    const currentConfig = loadConfig();
    Object.assign(currentConfig, configUpdate);
    saveConfig(currentConfig);

    if (!reelsProcess || reelsProcess.killed) {
        reelsProcess = fork(path.join(__dirname, 'src', 'reels.js'), [], {
            stdio: ['inherit', 'inherit', 'inherit', 'ipc']
        });

        reelsProcess.on('message', (msg) => {
            if (msg.type === 'log') {
                notifyRenderer('info', msg.message);
            } else if (msg.type === 'new-video-content') {
                mainWindow.webContents.send('new-video-content-updated', msg.content);
            } else if (msg.type === 'reels-status') {
                mainWindow.webContents.send('reels-status', msg.message);
                if (msg.message === 'stopped') {
                    if (reelsProcess) {
                        reelsProcess.kill('SIGTERM');
                        reelsProcess = null;
                    }
                }
            } else if (msg.type === 'reels-post-success') {
                mainWindow.webContents.send('reels-post-success-updated', msg.content);
            }
        });

        reelsProcess.on('exit', (code, signal) => {
            console.log(`Reels crawler process exited with code ${code} and signal ${signal}`);
            notifyRenderer('stopped', `Tiến trình Video đã dừng (Code: ${code}, Signal: ${signal})`);
            reelsProcess = null;
        });

        reelsProcess.send({ command: 'start-reels', config: configUpdate });
        notifyRenderer('info', '🚀 Đang khởi động luồng video...');
        mainWindow.webContents.send('reels-status', 'running');
    } else {
        console.log('Reels crawler process already running.');
        notifyRenderer('info', '❗ Luồng Video đã chạy rồi.');
    }
});

ipcMain.on('stop-reels-post', () => {
    console.log('Nhận lệnh STOP REELS POST');
    if (reelsProcess) {
        reelsProcess.send({ command: 'stop-reels' });
        notifyRenderer('info', '🛑 Đang gửi yêu cầu dừng luồng Video...');
        mainWindow.webContents.send('reels-status', 'stopping');
        
        setTimeout(() => {
            if (reelsProcess && !reelsProcess.killed) {
                console.warn('⚠️ Tiến trình Video không tự dừng, buộc phải kill.');
                reelsProcess.kill('SIGKILL');
                reelsProcess = null;
                notifyRenderer('stopped', '🛑 Buộc dừng luồng Video.');
                mainWindow.webContents.send('reels-status', 'stopped');
            }
        }, 10000);
    } else {
        console.log('No reels process to stop.');
        notifyRenderer('info', '❗ Không có luồng Video nào để dừng.');
    }
});

ipcMain.on('save-image', async (event, imageSrc) => {
    if (!mainWindow) return;

    // Chuẩn bị dữ liệu ảnh (buffer)
    let imageBuffer;
    try {
        if (imageSrc.startsWith('data:image')) {
            // Xử lý ảnh dạng base64
            const base64Data = imageSrc.replace(/^data:image\/png;base64,/, "");
            imageBuffer = Buffer.from(base64Data, 'base64');
        } else if (imageSrc.startsWith('http')) {
            // Xử lý ảnh dạng URL
            const response = await axios.get(imageSrc, { responseType: 'arraybuffer' });
            imageBuffer = response.data;
        } else {
            throw new Error('Định dạng ảnh không xác định.');
        }
    } catch (error) {
        console.error('Lỗi tải dữ liệu ảnh:', error);
        notifyRenderer('error', 'Không thể tải dữ liệu ảnh để lưu.');
        return;
    }


    // Mở hộp thoại lưu file
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Lưu ảnh về máy',
        defaultPath: `auto-news-image-${Date.now()}.png`,
        buttonLabel: 'Lưu ảnh',
        filters: [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }
        ]
    });

    if (filePath) {
        try {
            fs.writeFileSync(filePath, imageBuffer);
            notifyRenderer('success', `✅ Đã lưu ảnh thành công tại: ${filePath}`);
        } catch (error) {
            console.error('Lỗi khi lưu file ảnh:', error);
            notifyRenderer('error', `Lỗi khi lưu ảnh: ${error.message}`);
        }
    }
});

ipcMain.removeHandler('open-file-dialog');
ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp'] }]
    });
    if (canceled) return null;
    return filePaths[0];
});

ipcMain.on('remove-post', (_event, { link }) => {
  if (crawlerProcess) {
    crawlerProcess.send({ command: 'remove-post', link });
  }
});
