// File: renderer/scripts/reelsRenderer.js
document.addEventListener("DOMContentLoaded", async () => {
    const configForm = document.getElementById("reelsConfigForm");
    const videoQueue = document.getElementById("videoQueue");
    const reelsPosted = document.getElementById("reelsPosted");
    const startBtn = document.getElementById("btnStartReels");
    const stopBtn = document.getElementById("btnStopReels");
    const addSourceBtn = document.querySelector(".add-source");
    const statusElement = document.getElementById("reelsStatus");

    function setButtonState(isPosting) {
        startBtn.disabled = isPosting;
        startBtn.innerText = isPosting ? "🚀 Đang chạy..." : "🚀 Bắt đầu";
        stopBtn.disabled = !isPosting;
    }

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
    
    // --- RENDER DỮ LIỆU TỪ CONFIG ---
    const config = await window.electronAPI.getConfig();
    if (Array.isArray(config.videoSources)) renderSources(config.videoSources);
    
    if (config.VIDEO_POST_INTERVAL_MINUTES !== undefined) {
        document.getElementById("videoPostIntervalInput").value = config.VIDEO_POST_INTERVAL_MINUTES;
    }
    if (config.VIDEO_CRAWL_LOOP_DELAY_MINUTES !== undefined) {
        document.getElementById("videoCrawlLoopDelayInput").value = config.VIDEO_CRAWL_LOOP_DELAY_MINUTES;
    }
    if (config.DEBUG_MODE_REELS !== undefined) {
        document.getElementById("debugCheckReels").checked = config.DEBUG_MODE_REELS;
    }

    // --- LOGIC XỬ LÝ GIAO DIỆN ---
    startBtn.addEventListener("click", async () => {
        const currentConfigFromUI = {};
        const formData = new FormData(configForm);
        for (const [key, value] of formData.entries()) {
             currentConfigFromUI[key] = value;
        }

        currentConfigFromUI.DEBUG_MODE_REELS = document.getElementById("debugCheckReels").checked;
        currentConfigFromUI.videoSources = Array.from(document.querySelectorAll('#videoSourceList input[name="videoSources[]"]')).map(input => input.value.trim()).filter(Boolean);

        currentConfigFromUI.VIDEO_POST_INTERVAL_MINUTES = parseInt(document.getElementById("videoPostIntervalInput").value, 10);
        currentConfigFromUI.VIDEO_CRAWL_LOOP_DELAY_MINUTES = parseInt(document.getElementById("videoCrawlLoopDelayInput").value, 10);
        
        window.electronAPI.startReelsPost(currentConfigFromUI);
        setButtonState(true);
        showStatus("Bắt đầu quá trình tự động đăng video...", "info");
    });

    stopBtn.addEventListener("click", () => {
        window.electronAPI.stopReelsPost();
        startBtn.disabled = true;
        showStatus("Đang gửi yêu cầu dừng...", "info");
    });

    configForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newConfig = {};

        for (const [key, value] of formData.entries()) {
             newConfig[key] = value;
        }

        newConfig.DEBUG_MODE_REELS = document.getElementById("debugCheckReels").checked;
        newConfig.videoSources = Array.from(document.querySelectorAll('#videoSourceList input[name="videoSources[]"]')).map(input => input.value.trim()).filter(Boolean);

        newConfig.VIDEO_POST_INTERVAL_MINUTES = parseInt(document.getElementById("videoPostIntervalInput").value, 10);
        newConfig.VIDEO_CRAWL_LOOP_DELAY_MINUTES = parseInt(document.getElementById("videoCrawlLoopDelayInput").value, 10);

        await window.electronAPI.saveConfig(newConfig);
        showStatus("✅ Đã lưu cấu hình thành công!", "success");
    });

    addSourceBtn.addEventListener("click", () => {
        const list = document.getElementById("videoSourceList");
        if (list.querySelectorAll(".source-item").length >= 5) {
            showStatus("❗ Tối đa 5 nguồn.", "error");
            return;
        }
        list.insertAdjacentHTML("beforeend", `<div class="source-item"><input type="url" name="videoSources[]" placeholder="https://youtube.com/channel/..." /><button type="button" class="remove-source">X</button></div>`);
    });

    document.addEventListener("click", async (e) => {
        if (e.target.classList.contains("remove-source")) {
            e.target.parentElement.remove();
        }
    });

    window.electronAPI.onShowNotification((data) => {
        showStatus(data.message, data.type);
    });

    window.electronAPI.onReelsStatus((status) => {
        if (status === 'running') {
            setButtonState(true);
        } else {
            setButtonState(false);
            if (status === 'stopped') {
                showStatus('🛑 Luồng tự động đã dừng hoàn toàn.', 'stopped');
            }
        }
    });

    window.electronAPI.onNewVideoContent((content) => {
        const timestamp = new Date().toLocaleTimeString();
        const newLogEntry = document.createElement('div');
        newLogEntry.className = 'log-entry';
        newLogEntry.setAttribute('data-link', content.link); 
        
        let htmlContent = `<div style="font-size: 0.8rem; color: #6c757d; margin-bottom: 5px;">[${timestamp}] - <strong>${content.title}</strong></div>`;
        htmlContent += `<p>${content.caption}</p>`;
        htmlContent += `<a href="${content.link}" target="_blank" class="view-original-btn">📌 Xem video gốc</a>`;

        newLogEntry.innerHTML = htmlContent;
        videoQueue.prepend(newLogEntry);
    });

    window.electronAPI.onReelsPostSuccess((data) => {
        const entry = videoQueue.querySelector(`.log-entry[data-link="${data.link}"]`);
        if (entry) {
            reelsPosted.prepend(entry);
            const statusBadge = document.createElement('span');
            statusBadge.textContent = '✅ Đã đăng';
            statusBadge.style.cssText = 'color: #fff; background-color: #28a745; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-left: 10px;';
            const contentDiv = entry.querySelector('p');
            if (contentDiv) {
                contentDiv.appendChild(statusBadge);
            }
        }
    });
    
    setButtonState(false);
});

function renderSources(sourcesArray) {
    const list = document.getElementById("videoSourceList");
    list.innerHTML = '';
    sourcesArray.forEach(source => {
        list.insertAdjacentHTML("beforeend", `<div class="source-item"><input type="url" name="videoSources[]" value="${source}" placeholder="https://youtube.com/channel/..." /><button type="button" class="remove-source">X</button></div>`);
    });
}