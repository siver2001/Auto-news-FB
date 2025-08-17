// File: src/videoScraper.js
import ytdl from 'ytdl-core';
import axios from 'axios';
import { load } from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...';

/**
 * Cào video từ một kênh YouTube.
 * Lưu ý: YouTube có thể thay đổi cấu trúc HTML, cần cập nhật nếu code bị lỗi.
 * @param {string} channelUrl URL của kênh YouTube
 * @param {number} limit Số lượng video muốn lấy
 * @returns {Promise<Array<object>>}
 */
export async function crawlYouTubeChannel(channelUrl, limit = 5) {
    try {
        const response = await axios.get(channelUrl, { headers: { 'User-Agent': USER_AGENT } });
        const $ = load(response.data);
        const videos = [];

        // Tìm kiếm dữ liệu video trong script tag
        let initialData = $('script').filter((i, el) => $(el).html().includes('var ytInitialData')).html();
        if (initialData) {
            initialData = JSON.parse(initialData.substring(initialData.indexOf('{'), initialData.lastIndexOf('}') + 1));
            const videoList = initialData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]?.gridRenderer?.items;

            if (videoList) {
                for (let item of videoList) {
                    const videoRenderer = item.gridVideoRenderer;
                    if (videoRenderer && videos.length < limit) {
                        videos.push({
                            title: videoRenderer.title.runs[0].text,
                            link: `https://www.youtube.com/watch?v=${videoRenderer.videoId}`,
                            description: videoRenderer.descriptionSnippet?.runs?.[0]?.text || ''
                        });
                    }
                }
            }
        }
        return videos;
    } catch (error) {
        console.error(`❌ Lỗi khi cào kênh YouTube ${channelUrl}:`, error.message);
        return [];
    }
}

/**
 * Tải video từ một URL YouTube
 * @param {string} videoUrl
 * @returns {Promise<Buffer>}
 */
export async function downloadYouTubeVideo(videoUrl) {
    return new Promise((resolve, reject) => {
        const stream = ytdl(videoUrl, { quality: 'highestvideo' });
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}

/**
 * Hàm chính để cào video từ các nguồn khác nhau
 * @param {Array<string>} sources - Danh sách các URL nguồn
 */
export async function crawlVideoSources(sources) {
    let allVideos = [];
    for (const source of sources) {
        if (source.includes('youtube.com')) {
            const youtubeVideos = await crawlYouTubeChannel(source);
            allVideos = [...allVideos, ...youtubeVideos];
        } else if (source.includes('tiktok.com')) {
            // Đây là khung sườn cho TikTok, cần API hoặc thư viện chuyên biệt
            // Ví dụ: sử dụng một thư viện như "tiktok-scraper" (cần cài đặt riêng)
            // const tiktokVideos = await crawlTikTok(source);
            // allVideos = [...allVideos, ...tiktokVideos];
            console.log("Tính năng cào TikTok chưa được triển khai hoàn chỉnh.");
        }
    }
    return allVideos;
}