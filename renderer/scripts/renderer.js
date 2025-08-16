// File: renderer/scripts/renderer.js
document.addEventListener("DOMContentLoaded", async () => {
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
    
    if (config.POST_INTERVAL_MINUTES !== undefined) {
        postIntervalInput.value = config.POST_INTERVAL_MINUTES;
    }
    if (config.CRAWL_LOOP_DELAY_MINUTES !== undefined) {
        crawlLoopDelayInput.value = config.CRAWL_LOOP_DELAY_MINUTES;
    }
    if (shareCheck) shareCheck.checked = !!config.SHARE_POST_TO_STORY;

    // --- LOGIC XỬ LÝ GIAO DIỆN ---
    function toggleLocalApiUrlField() {
        localApiContainer.style.display = sourceSelect.value === 'local' ? 'block' : 'none';
    }
    toggleLocalApiUrlField();
    sourceSelect.addEventListener('change', toggleLocalApiUrlField);

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

        window.electronAPI.startAutoPost(currentConfigFromUI);
        setButtonState(true);
        showStatus("Bắt đầu quá trình tự động...", "info");
    });

    stopBtn.addEventListener("click", () => {
        window.electronAPI.stopAutoPost();
        // Giữ nút "Bắt đầu" bị vô hiệu hóa trong khi chờ
        startBtn.disabled = true;
        showStatus("Đang gửi yêu cầu dừng...", "info");
    });

    browseLogoBtn.addEventListener('click', async () => {
        const filePath = await window.electronAPI.openFileDialog();
        if (filePath) {
            logoPathInput.value = filePath;
        }
    });

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

        await window.electronAPI.saveConfig(newConfig);
        showStatus("✅ Đã lưu cấu hình thành công!", "success");
    });

    addSourceBtn.addEventListener("click", () => {
        const list = document.getElementById("sourceList");
        if (list.querySelectorAll(".source-item").length >= 5) {
            showStatus("❗ Tối đa 5 nguồn.", "error");
            return;
        }
        list.insertAdjacentHTML("beforeend", `<div class="source-item"><input type="url" name="sources[]" placeholder="https://example.com" /><button type="button" class="remove-source">X</button></div>`);
    });

    // Cập nhật sự kiện click để xử lý nút xóa
    document.addEventListener("click", async (e) => {
        // Xử lý các nút X của nguồn tin hoặc thời gian
        if (e.target.classList.contains("remove-source") || e.target.classList.contains("remove-time-slot")) {
            e.target.parentElement.remove();
        }
        // Xử lý nút lưu ảnh
        if (e.target.classList.contains("save-image-btn")) {
            e.preventDefault();
            const imageSrc = e.target.dataset.src;
            if (imageSrc) {
                window.electronAPI.saveImage(imageSrc);
            }
        }
        // Xử lý nút Xóa bài này
        if (e.target.classList.contains("remove-post-btn")) {
            const linkToRemove = e.target.getAttribute('data-link');
            // Yêu cầu xác nhận từ người dùng
            if (window.confirm("Bạn có chắc chắn muốn xóa bài viết này khỏi hàng chờ không?")) {
                // Gửi lệnh xóa về backend
                // Hàm removePost này sẽ được khai báo trong preload.js
                window.electronAPI.removePost(linkToRemove);
                
                // Xóa phần tử HTML của bài viết khỏi giao diện
                e.target.closest('.log-entry').remove();
                
                // Hiển thị thông báo thành công trên giao diện
                showStatus("✅ Đã xóa bài viết khỏi hàng chờ.", "success");
            }
        }
    });


    window.electronAPI.onShowNotification((data) => {
        showStatus(data.message, data.type);
    });

    window.electronAPI.onCrawlStatus((status) => {
        if (status === 'running') {
            setButtonState(true);
        } else {
            setButtonState(false);
            if (status === 'stopped') {
                showStatus('🛑 Luồng tự động đã dừng hoàn toàn.', 'stopped');
            }
        }
    });

    //Sửa lại hàm onNewContent để không bị trùng
        window.electronAPI.onNewContent((content) => {
        const timestamp = new Date().toLocaleTimeString();
        const newLogEntry = document.createElement('div');
        newLogEntry.className = 'log-entry';
        newLogEntry.setAttribute('data-link', content.link); 

        let htmlContent = `<div style="font-size: 0.8rem; color: #6c757d; margin-bottom: 5px;">[${timestamp}] - <strong>${content.title}</strong></div>`;

        // Vòng lặp này đã được viết đúng, vấn đề là ở backend (index.js)
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
    });


    // Thêm hàm lắng nghe sự kiện mới để cập nhật trạng thái bài viết
    window.electronAPI.onPostSuccess((data) => {
        // Tìm entry tương ứng trong khung "Nội dung đang chờ"
        const entry = rewrittenContainer.querySelector(`.log-entry[data-link="${data.link}"]`);
        
        if (entry) {
            // Di chuyển entry từ khung "Đang chờ" sang khung "Đã đăng"
            postedContainer.prepend(entry);
            
            // Cập nhật giao diện của entry
            const statusBadge = document.createElement('span');
            statusBadge.textContent = '✅ Đã đăng';
            statusBadge.style.cssText = 'color: #fff; background-color: #28a745; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; margin-left: 10px;';
            
            // Tìm thẻ <div> chứa nội dung đã viết lại và thêm badge vào
            const contentDiv = entry.querySelector('.log-entry-content');
            if (contentDiv) {
                contentDiv.appendChild(statusBadge);
            }
            // Optional: Có thể xóa nút 'Lưu ảnh' và 'Xem bài gốc' nếu cần
            entry.querySelectorAll('.save-image-btn, .view-original-btn').forEach(btn => btn.remove());
        }
    });
    
    setButtonState(false);
});

// --- CÁC HÀM HELPER ---
function renderSources(sourcesArray) {
    const list = document.getElementById("sourceList");
    list.innerHTML = '';
    sourcesArray.forEach(source => {
        list.insertAdjacentHTML("beforeend", `<div class="source-item"><input type="url" name="sources[]" value="${source}" placeholder="https://example.com" /><button type="button" class="remove-source">X</button></div>`);
    });
}