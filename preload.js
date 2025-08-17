// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // Hàm mới để điều khiển việc chạy tự động
  startAutoPost: (config) => ipcRenderer.send('start-auto-post', config),
  stopAutoPost: () => ipcRenderer.send('stop-auto-post'),
  saveImage: (imageSrc) => ipcRenderer.send('save-image', imageSrc),
  
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  // Kênh để nhận thông báo trạng thái
  onShowNotification: (callback) => ipcRenderer.on('show-notification', (_e, data) => callback(data)),

  // Kênh mới để nhận nội dung được viết lại theo thời gian thực
  onNewContent: (callback) => ipcRenderer.on('new-content-updated', (_e, content) => callback(content)),

  // KÊNH MỚI: Thêm kênh này để nhận trạng thái cào bài
  onCrawlStatus: (callback) => ipcRenderer.on('crawl-status', (_e, status) => callback(status)),

  onPostSuccess: (callback) => ipcRenderer.on('post-success-updated', (_e, data) => callback(data)),
  removePost: (link) => ipcRenderer.send('remove-post', { link })
});