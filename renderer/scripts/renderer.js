// File: renderer/scripts/renderer.js

document.addEventListener("DOMContentLoaded", async () => {
    // Khai báo các phần tử DOM
    const configForm = document.getElementById("configForm");
    const rewrittenContainer = document.getElementById("rewritten");
    const postedContainer = document.getElementById("posted");
    const startBtn = document.getElementById("btnStartAuto");
    const stopBtn = document.getElementById("btnStopAuto");
    const addSourceBtn = document.querySelector(".add-source");
    const sourceSelect = document.getElementById("sourceSelect");
    const localApiContainer = document.getElementById("localApiContainer");
    const debugCheck = document.getElementById("debugCheck");
    const shareCheck = document.getElementById("shareToStoryCheck");
    const postIntervalInput = document.getElementById("postIntervalInput");
    const crawlLoopDelayInput = document.getElementById("crawlLoopDelayInput");
    const logoPathInput = document.getElementById("logoPathInput");
    const browseLogoBtn = document.getElementById("browseLogoBtn");
    const statusElement = document.getElementById("status");
    const queueStatusElement = document.getElementById("queueStatus");
    
    // Thêm biến mới
    const logoFileInput = document.getElementById('logoFileInput');
    
    // Hàm helper mới để lấy tên file từ đường dẫn
    function getFileNameFromPath(fullPath) {
        if (!fullPath) return '';
        const parts = fullPath.split(/[\/\\]/);
        return parts[parts.length - 1];
    }


    /**
     * Cập nhật trạng thái nút Start/Stop.
     * @param {boolean} isPosting - True nếu luồng đang chạy.
     */
    function setButtonState(isPosting) {
        startBtn.disabled = isPosting;
        startBtn.innerText = isPosting ? "🚀 Đang chạy..." : "🚀 Bắt đầu";
        stopBtn.disabled = !isPosting;
    }

    /**
     * Hiển thị thông báo trạng thái trên giao diện.
     * @param {string} message - Nội dung thông báo.
     * @param {string} type - Loại thông báo ('info', 'success', 'error', 'stopped').
     */
    function showStatus(message, type = 'info') {
        if (!statusElement) return;
        statusElement.textContent = message;
        statusElement.className = 'status-' + type;
        const duration = (type === 'error' || type === 'stopped') ? 8000 : 5000;
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = '';
        }, duration);
    }
    
    /**
     * Tải cấu hình từ Backend và hiển thị lên form.
     */
    async function loadConfig() {
      try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Không thể tải cấu hình.');
        const config = await response.json();
        for (const [key, value] of Object.entries(config)) {
            if (key === "sources" || key === "POST_INTERVAL_MINUTES" || key === "CRAWL_LOOP_DELAY_MINUTES") continue;
            const input = document.querySelector(`[name="${key}"]`);
            if (input) {
                input.type === "checkbox" ? (input.checked = value) : (input.value = value);
            } else {
                const select = document.querySelector(`[name="${key}"]`);
                if (select) select.value = value;
            }
        }
        if (Array.isArray(config.sources)) renderSources(config.sources);
        if (config.POST_INTERVAL_MINUTES !== undefined) postIntervalInput.value = config.POST_INTERVAL_MINUTES;
        if (config.CRAWL_LOOP_DELAY_MINUTES !== undefined) crawlLoopDelayInput.value = config.CRAWL_LOOP_DELAY_MINUTES;
        if (shareCheck) shareCheck.checked = !!config.SHARE_POST_TO_STORY;
        // Cập nhật trường logo nếu có
        if (config.LOGO_PATH) {
            // SỬ DỤNG HÀM MỚI
            const fileName = getFileNameFromPath(config.LOGO_PATH);
            logoPathInput.value = fileName;
        }

      } catch (error) {
        showStatus(`❌ Lỗi tải cấu hình: ${error.message}`, 'error');
      }
    }
    await loadConfig();

    /**
     * Hiển thị/ẩn trường Local AI URL.
     */
    function toggleLocalApiUrlField() {
        localApiContainer.style.display = sourceSelect.value === 'local' ? 'block' : 'none';
    }
    toggleLocalApiUrlField();
    sourceSelect.addEventListener('change', toggleLocalApiUrlField);

    // Xử lý sự kiện click nút START
    startBtn.addEventListener("click", async () => {
        const currentConfigFromUI = {};
        const formData = new FormData(configForm);
        for (const [key, value] of formData.entries()) {
             currentConfigFromUI[key] = value;
        }
        currentConfigFromUI.DEBUG_MODE = debugCheck.checked;
        currentConfigFromUI.SHARE_POST_TO_STORY = document.getElementById("shareToStoryCheck").checked;
        currentConfigFromUI.AUTO_LIKE_POSTS = document.getElementById("autoLikePostsCheck").checked;
        currentConfigFromUI.AUTO_REACT_COMMENTS = document.getElementById("autoReactCommentsCheck").checked;
        currentConfigFromUI.sources = Array.from(document.querySelectorAll('input[name="sources[]"]')).map(input => input.value.trim()).filter(Boolean);
        currentConfigFromUI.POST_INTERVAL_MINUTES = parseInt(postIntervalInput.value, 10);
        currentConfigFromUI.CRAWL_LOOP_DELAY_MINUTES = parseInt(crawlLoopDelayInput.value, 10);
        // Lấy giá trị từ input file
        const logoFile = logoFileInput.files[0];
        let logoPath = '';
        if (logoFile) {
            // Tải logo lên server trước
            const logoFormData = new FormData();
            logoFormData.append('logo', logoFile);
            const uploadResponse = await fetch('/api/upload-logo', {
                method: 'POST',
                body: logoFormData
            });
            const uploadResult = await uploadResponse.json();
            if (uploadResult.success) {
                logoPath = uploadResult.logoPath;
            } else {
                showStatus(uploadResult.message, 'error');
                return;
            }
        } else {
            // Nếu không có file mới, giữ nguyên đường dẫn cũ
            const oldConfig = await (await fetch('/api/config')).json();
            logoPath = oldConfig.LOGO_PATH;
        }
        currentConfigFromUI.LOGO_PATH = logoPath;

        try {
          const response = await fetch('/api/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(currentConfigFromUI),
          });
          const result = await response.json();
          if (result.success) {
            setButtonState(true);
            showStatus(result.message, "info");
          } else {
            showStatus(result.message, "error");
          }
        } catch (error) {
          showStatus(`❌ Lỗi khi bắt đầu: ${error.message}`, "error");
        }
    });

    // Xử lý sự kiện click nút STOP
    stopBtn.addEventListener("click", async () => {
        try {
          const response = await fetch('/api/stop', { method: 'POST' });
          const result = await response.json();
          if (result.success) {
            setButtonState(false);
            showStatus(result.message, "info");
          } else {
            showStatus(result.message, "error");
          }
        } catch (error) {
          showStatus(`❌ Lỗi khi dừng: ${error.message}`, "error");
        }
    });

    // Xử lý sự kiện lưu cấu hình
    configForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newConfig = {};
        for (const [key, value] of formData.entries()) {
             newConfig[key] = value;
        }
        newConfig.DEBUG_MODE = debugCheck.checked;
        newConfig.AUTO_LIKE_POSTS = document.getElementById("autoLikePostsCheck").checked;
        newConfig.AUTO_REACT_COMMENTS = document.getElementById("autoReactCommentsCheck").checked;
        newConfig.SHARE_POST_TO_STORY = document.getElementById("shareToStoryCheck").checked;
        newConfig.sources = Array.from(document.querySelectorAll('input[name="sources[]"]')).map(input => input.value.trim()).filter(Boolean);
        newConfig.POST_INTERVAL_MINUTES = parseInt(postIntervalInput.value, 10);
        newConfig.CRAWL_LOOP_DELAY_MINUTES = parseInt(crawlLoopDelayInput.value, 10);

        // Lấy giá trị từ input file
        const logoFile = logoFileInput.files[0];
        let logoPath = '';
        if (logoFile) {
            // Tải logo lên server trước khi lưu cấu hình
            const logoFormData = new FormData();
            logoFormData.append('logo', logoFile);
            const uploadResponse = await fetch('/api/upload-logo', {
                method: 'POST',
                body: logoFormData
            });
            const uploadResult = await uploadResponse.json();
            if (uploadResult.success) {
                logoPath = uploadResult.logoPath;
            } else {
                showStatus(uploadResult.message, 'error');
                return;
            }
        } else {
             // Nếu không có file mới được chọn, giữ nguyên đường dẫn cũ
            const oldConfig = await (await fetch('/api/config')).json();
            logoPath = oldConfig.LOGO_PATH;
        }
        newConfig.LOGO_PATH = logoPath;

        try {
          const response = await fetch('/api/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newConfig),
          });
          const result = await response.json();
          if (result.success) {
            showStatus(result.message, "success");
            // Sau khi lưu thành công, cập nhật lại đường dẫn hiển thị
            if (newConfig.LOGO_PATH) {
                // SỬ DỤNG HÀM MỚI
                const fileName = getFileNameFromPath(newConfig.LOGO_PATH);
                logoPathInput.value = fileName;
            } else {
                logoPathInput.value = '';
            }
          } else {
            showStatus(result.message, "error");
          }
        } catch (error) {
          showStatus(`❌ Lỗi khi lưu cấu hình: ${error.message}`, 'error');
        }
    });

    // Thêm nguồn
    addSourceBtn.addEventListener("click", () => {
        const list = document.getElementById("sourceList");
        if (list.querySelectorAll(".source-item").length >= 5) {
            showStatus("❗ Tối đa 5 nguồn.", "error");
            return;
        }
        list.insertAdjacentHTML("beforeend", `<div class="source-item"><input type="url" name="sources[]" placeholder="https://example.com" /><button type="button" class="remove-source">X</button></div>`);
    });

    // Xử lý sự kiện click nút "Chọn Logo"
    browseLogoBtn.addEventListener('click', () => {
        logoFileInput.click(); // Kích hoạt input file ẩn
    });

    // Xử lý sự kiện khi file được chọn
    logoFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            logoPathInput.value = file.name;
        } else {
            logoPathInput.value = '';
        }
    });

    // Lắng nghe các sự kiện click chung
    document.addEventListener("click", async (e) => {
        if (e.target.classList.contains("remove-source")) {
            e.target.parentElement.remove();
        }
        if (e.target.classList.contains("remove-post-btn")) {
            const linkToRemove = e.target.getAttribute('data-link');
            if (window.confirm("Bạn có chắc chắn muốn xóa bài viết này khỏi hàng chờ không?")) {
                try {
                    const response = await fetch(`/api/post/${encodeURIComponent(linkToRemove)}`, { method: 'DELETE' });
                    const result = await response.json();
                    if (result.success) {
                        e.target.closest('.log-entry').remove();
                        showStatus("✅ Đã xóa bài viết khỏi hàng chờ.", "success");
                    } else {
                        showStatus(result.message, "error");
                    }
                } catch (error) {
                    showStatus(`❌ Lỗi khi xóa bài: ${error.message}`, 'error');
                }
            }
        }
    });

    // Các hàm cập nhật trạng thái từ Backend (thay thế ipcRenderer)
    function handleBackendLog(data) {
        if (data.type === 'log') {
            showStatus(data.message, data.contentType);
        } else if (data.type === 'new-content') {
            renderNewContent(data.content);
        } else if (data.type === 'status') {
            if (data.message === 'running') {
                setButtonState(true);
            } else {
                setButtonState(false);
                if (data.message === 'stopped') {
                    showStatus('🛑 Luồng tự động đã dừng hoàn toàn.', 'stopped');
                }
            }
        } else if (data.type === 'post-success') {
            movePostToPosted(data.content.link);
        }
    }
    
    // Sử dụng WebSocket để nhận thông tin cập nhật theo thời gian thực
    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleBackendLog(data);
    };

    function renderNewContent(content) {
        const timestamp = new Date().toLocaleTimeString();
        const newLogEntry = document.createElement('div');
        newLogEntry.className = 'log-entry';
        newLogEntry.setAttribute('data-link', content.link); 

        let htmlContent = `<div style="font-size: 0.8rem; color: #6c757d; margin-bottom: 5px;">[${timestamp}] - <strong>${content.title}</strong></div>`;
        if (content.images && content.images.length > 0) {
            htmlContent += '<div class="image-previews" style="display:flex; flex-direction:column; gap:10px; margin: 10px 0;">';
            content.images.forEach((imgSrc, index) => {
                htmlContent += `<img src="${imgSrc}" alt="Ảnh ${index + 1}" style="max-width: 100%; height: auto; border-radius: 6px;">`;
                htmlContent += `<a href="#" class="save-image-btn" data-src="${imgSrc}">💾 Lưu ảnh này</a>`;
            });
            htmlContent += '</div>';
        }

        const rewrittenTextNode = document.createElement('div');
        rewrittenTextNode.className = 'log-entry-content';
        rewrittenTextNode.innerText = content.rewritten;
        htmlContent += rewrittenTextNode.outerHTML;

        if (content.link) {
            htmlContent += `<a href="${content.link}" target="_blank" class="view-original-btn">📌 Xem bài viết gốc</a>`;
        }
        htmlContent += `<button type="button" class="remove-post-btn" data-link="${content.link}" style="background-color: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 5px; cursor: pointer; margin-top: 10px;">❌ Xóa bài này</button>`;

        newLogEntry.innerHTML = htmlContent;
        rewrittenContainer.prepend(newLogEntry);
    }

    function movePostToPosted(link) {
        const entry = rewrittenContainer.querySelector(`.log-entry[data-link="${link}"]`);
        
        if (entry) {
            postedContainer.prepend(entry);
            const statusBadge = document.createElement('span');
            statusBadge.textContent = '✅ Đã đăng';
            statusBadge.style.cssText = 'color: #fff; background-color: #28a745; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-left: 10px;';
            const contentDiv = entry.querySelector('.log-entry-content');
            if (contentDiv) {
                contentDiv.appendChild(statusBadge);
            }
            entry.querySelectorAll('.save-image-btn, .view-original-btn, .remove-post-btn').forEach(btn => btn.remove());
        }
    }
    
    async function initializeUI() {
        try {
            const statusRes = await fetch('/api/status');
            const statusData = await statusRes.json();
            setButtonState(statusData.isRunning);
        } catch (error) {
            console.error('Không thể lấy trạng thái server:', error);
            setButtonState(false);
        }
        
        try {
            const queueRes = await fetch('/api/post-queue');
            const queueData = await queueRes.json();
            queueStatusElement.textContent = `Hàng chờ (${queueData.postQueue.length} bài)`;
        } catch (error) {
            console.error('Không thể lấy hàng chờ:', error);
            queueStatusElement.textContent = `Hàng chờ`;
        }
    }
    await initializeUI();

    function renderSources(sourcesArray) {
        const list = document.getElementById("sourceList");
        list.innerHTML = '';
        sourcesArray.forEach(source => {
            list.insertAdjacentHTML("beforeend", `<div class="source-item"><input type="url" name="sources[]" value="${source}" placeholder="https://example.com" /><button type="button" class="remove-source">X</button></div>`);
        });
    }
});