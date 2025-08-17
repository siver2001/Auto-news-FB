// File: src/reels.js
import { loadConfig, saveConfig } from './configLoader.js';
import { postToFacebook } from './poster.js';
import { loadLogEntries, isLinkPosted, isTitleSimilarToLog, saveLogEntry } from './logger.js';
import { crawlVideoSources, downloadYouTubeVideo } from './videoScraper.js'; 
import { classifyTopic } from './topicModeler.js';
import { extractKeywords } from './keywords.js';

// Biến để kiểm soát vòng lặp chạy/dừng
let isReelsRunning = false;
let videoQueue = [];
let postIntervalId = null;
let lastPostTimestamp = 0;

// Hàm gửi log về tiến trình chính
function sendLog(message, type = 'info', content = null) {
  if (process.send) {
    process.send({ type: 'log', message: message, contentType: type, content: content });
  } else {
    console.log(message);
  }
}

async function startReelsLoop() {
    if (!isReelsRunning) {
        sendLog('🛑 Luồng cào video đã nhận lệnh dừng và thoát.');
        process.send({ type: 'reels-status', message: 'stopped' });
        process.exit(0);
    }
    
    sendLog(`\n🔄 Bắt đầu chu kỳ cào video mới [${new Date().toLocaleString()}]`);

    const config = loadConfig();
    const { videoSources, DEBUG_MODE_REELS, VIDEO_CRAWL_LOOP_DELAY_MINUTES } = config;
    const entries = loadLogEntries();
    
    // Gọi hàm cào video đã được import
    const videos = await crawlVideoSources(videoSources);

    if (videos.length === 0) {
        sendLog('🤷‍♀️ Không tìm thấy video mới trong chu kỳ này.');
    }

    let videosProcessedInCycle = 0;

    for (const vid of videos) {
        if (!isReelsRunning) {
            sendLog('🛑 Luồng cào video đã nhận lệnh dừng. Đang hoàn tất chu kỳ hiện tại...');
            break;
        }

        if (isLinkPosted(vid.link, entries) || isTitleSimilarToLog(vid.title, entries)) {
            sendLog(`⏭️  Bỏ qua (đã xử lý/đăng): ${vid.link}`);
            continue;
        }

        try {
            sendLog(`✅ Tìm thấy video mới: ${vid.title}`);
            
            // Tải video
            const videoBuffer = await downloadYouTubeVideo(vid.link);

            if (!videoBuffer) {
                sendLog(`❌ Không thể tải video: ${vid.link}`, 'error');
                continue;
            }

            // Dùng AI để tạo caption và hashtag
            const captionContent = `Tiêu đề: ${vid.title}\nMô tả: ${vid.description}`;
            const topics = await classifyTopic(captionContent, config);
            const hashtags = await extractKeywords(captionContent, config);
            
            let finalCaption = `🔥 ${vid.title}\n\n`;
            if (vid.description) {
                finalCaption += `${vid.description.trim()}\n\n`;
            }
            if (hashtags.length > 0) {
                finalCaption += `\n\n${hashtags.map(tag => `#${tag.replace(/#/g, '')}`).join(' ')}`;
            }
            
            videoQueue.push({
                content: finalCaption,
                media: [{ buffer: videoBuffer, filename: 'video.mp4' }],
                link: vid.link,
                title: vid.title
            });
            videosProcessedInCycle++;
            sendLog(`✅ Video "${vid.title}" đã được thêm vào hàng chờ đăng (${videoQueue.length} video).`);

            process.send({
                type: 'new-video-content',
                content: {
                    title: vid.title,
                    caption: finalCaption,
                    link: vid.link
                }
            });

        } catch (err) {
            sendLog(`❌ Lỗi xử lý video "${vid.title}": ${err.message}`, 'error');
            continue;
        }
    }
    
    sendLog(`🏁 Hoàn thành chu kỳ cào video. Đã xử lý ${videosProcessedInCycle} video.`);

    const crawlDelayMs = (config.VIDEO_CRAWL_LOOP_DELAY_MINUTES || 30) * 60 * 1000;
    sendLog(`⏳ Đang chờ ${crawlDelayMs / 60000} phút trước khi cào video tiếp theo...`);
    setTimeout(startReelsLoop, crawlDelayMs);
}

// Hàm xử lý hàng chờ đăng video
async function processVideoQueue() {
    const config = loadConfig();
    const { VIDEO_POST_INTERVAL_MINUTES, DEBUG_MODE_REELS } = config;

    if (!isReelsRunning && videoQueue.length === 0) {
        return;
    }

    const currentTime = Date.now();
    const requiredIntervalMs = (VIDEO_POST_INTERVAL_MINUTES || 15) * 60 * 1000;

    if (currentTime - lastPostTimestamp < requiredIntervalMs) {
        const remainingMinutes = Math.round((requiredIntervalMs - (currentTime - lastPostTimestamp)) / 1000 / 60);
        sendLog(`⏳ Đang chờ ${remainingMinutes} phút nữa để đăng video tiếp theo. (${videoQueue.length} video trong hàng chờ)`);
        return;
    }

    if (videoQueue.length > 0) {
        const videoItem = videoQueue.shift();
        sendLog(`✨ Chuẩn bị xử lý video từ hàng chờ: "${videoItem.title}"`);

        if (DEBUG_MODE_REELS) {
            sendLog(`➡️  Chế độ DEBUG: Bỏ qua đăng video thật lên Facebook.`, 'info');
            lastPostTimestamp = currentTime;
            return;
        }

        try {
            const post = await postToFacebook(videoItem.content, videoItem.media, config);
            if (!post || !post.id) {
                sendLog("❌ Đăng video thất bại từ hàng chờ, không nhận được post ID.", 'error');
                return;
            }

            sendLog(`✅ Đăng thành công lên Facebook với Post ID: ${post.id}`);
            saveLogEntry({ link: videoItem.link, title: videoItem.title });
            process.send({ type: 'reels-post-success', content: { link: videoItem.link, postId: post.id } });
            lastPostTimestamp = currentTime;

        } catch (error) {
            let errorMessage = `❌ Lỗi khi đăng video "${videoItem.title}": ${error.message}`;
            sendLog(errorMessage, 'error');
            console.error("Lỗi chi tiết khi đăng video:", error.response?.data?.error || error);
        }
    } else {
        sendLog('📭 Hàng chờ đăng video trống.');
    }
}
// Lắng nghe tin nhắn từ tiến trình chính
process.on('message', (msg) => {
    if (msg.command === 'start-reels') {
        if (!isReelsRunning) {
            isReelsRunning = true;
            const updatedConfig = { ...loadConfig(), ...msg.config };
            saveConfig(updatedConfig);
            startReelsLoop();
            if (postIntervalId) clearInterval(postIntervalId);
            postIntervalId = setInterval(processVideoQueue, 60 * 1000);
            sendLog('Tiến trình cào và lập lịch đăng video đã khởi động.');
        }
    } else if (msg.command === 'stop-reels') {
        isReelsRunning = false;
        sendLog('🛑 Đã nhận lệnh dừng luồng video. Đang hoàn tất chu kỳ hiện tại...');
    }
});