// index.js (Phiên bản đã sửa lỗi và tái cấu trúc cho môi trường web)
process.stdout.write('\x1b[0m'); // reset
process.stdout.setDefaultEncoding('utf8');
import crypto from 'crypto';
import axios from 'axios';
import { loadConfig, saveConfig } from './src/configLoader.js';
import { crawlSources, fetchArticleContent, fetchArticleImages } from './src/crawler.js';
import { rewriteContent, RateLimitError } from './src/rewrite.js';
import { rewriteManual } from './src/rewrite_manual.js';
import { classifyTopic } from './src/topicModeler.js';
import { extractKeywords } from './src/keywords.js';
import { overlayLogo } from './src/quoteOverlay.js';
import { analyzeTrendingTopics } from './src/trendAnalyzer.js';
import { postToFacebook, reactToFacebook, postStoryWithLink } from './src/poster.js';
import {
  loadLogEntries,
  isLinkPosted,
  isTitleSimilarToLog,
  isImageHashPosted,
  saveLogEntry,
} from './src/logger.js';

const HASH_ALGO = 'md5';

function getImageHash(img) {
  const h = crypto.createHash(HASH_ALGO);
  if (Buffer.isBuffer(img)) h.update(img);
  else h.update(img.toString());
  return h.digest('hex');
}

function incrementUsed(config) {
  config.USED = (config.USED || 0) + 1;
  saveConfig(config);
  sendLog(`📈 USED +1 → Hiện tại: ${config.USED}`);
}

// Biến để kiểm soát vòng lặp chạy/dừng
export let isCrawlingRunning = false;
let postQueue = [];
let postIntervalId = null;
let lastPostTimestamp = 0;
let logCallback = console.log;

function sendLog(message, type = 'info', content = null) {
  logCallback(message, type, content);
}

function validateAndFixContent(aiGeneratedContent) {
  // Logic validateAndFixContent giữ nguyên
  if (!aiGeneratedContent || typeof aiGeneratedContent !== 'string') {
    return null;
  }

  let title, summary, body = '', question = null;
  const partsByBold = aiGeneratedContent.split('**');

  if (partsByBold.length >= 3) {
    title = partsByBold[0].trim();
    summary = `**${partsByBold[1].trim()}**`;
    const restOfContent = partsByBold.slice(2).join('**').trim();
    const restOfContentLines = restOfContent.split('\n\n');
    const lastLine = restOfContentLines[restOfContentLines.length - 1];
    
    if (lastLine && lastLine.trim().endsWith('?')) {
      question = restOfContentLines.pop();
    }
    body = restOfContentLines.join(' ');
  } else {
    let parts = aiGeneratedContent.split('\n\n').filter(p => p.trim() !== '');
    if (parts.length < 3) {
      const processedText = parts.join(' ').replace(/([.!?])\s*(?=[A-ZÀ-Ỹ])/g, '$1\n\n');
      parts = processedText.split('\n\n').filter(p => p.trim() !== '');
    }
    if (parts.length < 3) {
      return null;
    }
    let [tempTitle, tempSummary, ...restOfContent] = parts;
    title = tempTitle;
    summary = `**${tempSummary.replace(/\*\*/g, '').trim()}**`;
    let restOfContentLines = restOfContent;
    for (let i = restOfContentLines.length - 1; i >= 0; i--) {
      if (restOfContentLines[i].trim().endsWith('?')) {
        question = restOfContentLines.splice(i, 1)[0];
        break;
      }
    }
    body = restOfContentLines.join(' ');
  }

  if (!title) {
    return null;
  }
  title = title.toUpperCase().replace(/[.!?]$/, '').trim();
  
  if (body) {
    body = body.replace(/([.!?])([A-ZÀ-Ỹ])/g, '$1 $2');
    body = body.replace(/([.!?])\s/g, '$1\n\n\n');
  }

  const result = [title, summary];
  if (body) result.push(body);
  if (question) result.push(question);
  result.push('📌 Link bài viết gốc ở phần bình luận nhé!');

  return result.filter(Boolean).join('\n\n');
}

// HÀM ĐƯỢC DI CHUYỂN LÊN TRƯỚC
async function processPostQueue() {
  const config = loadConfig();
  const { POST_INTERVAL_MINUTES, DEBUG_MODE } = config;

  if (!isCrawlingRunning && postQueue.length === 0) {
    return;
  }

  const currentTime = Date.now();
  const requiredIntervalMs = (POST_INTERVAL_MINUTES || 1) * 60 * 1000;

  if (currentTime - lastPostTimestamp < requiredIntervalMs) {
    const remainingMinutes = Math.round((requiredIntervalMs - (currentTime - lastPostTimestamp)) / 1000 / 60);
    sendLog(`⏳ Đang chờ ${remainingMinutes} phút nữa để đăng bài tiếp theo. (${postQueue.length} bài trong hàng chờ)`);
    return;
  }

  if (postQueue.length > 0) {
    const postItem = postQueue.shift();
    sendLog(`✨ Chuẩn bị xử lý bài từ hàng chờ: "${postItem.title}"`);

    if (DEBUG_MODE) {
        sendLog(`➡️  Chế độ DEBUG: Bỏ qua đăng bài thật lên Facebook.`, 'info');
        lastPostTimestamp = currentTime;
        return;
    }

    try {
        const post = await postToFacebook(postItem.content, postItem.media, config);
        if (!post || !post.id) {
            sendLog("❌ Đăng bài thất bại từ hàng chờ, không nhận được post ID. (Xem log chi tiết).", 'error');
            console.error("Lỗi đăng bài FB (không có ID):", post);
            return;
        }

        sendLog(`✅ Đăng thành công lên Facebook với Post ID: ${post.id}`);

        if (config.AUTO_LIKE_POSTS) {
            await reactToFacebook(post.id, 'LIKE', config);
            sendLog(`👍 Đã tự động Like bài viết ${post.id}.`);
        }

        if (config.AUTO_REACT_COMMENTS) {
            const delay = (config.AUTO_REACT_COMMENT_DELAY_SECONDS || 60) * 1000;
            setTimeout(async () => {
                await handleCommentReactions(post.id, config);
            }, delay);
            sendLog(`⏰ Sẽ kiểm tra và thả cảm xúc cho bình luận sau ${(delay / 1000)} giây.`);
        }
        await postToFacebook(`${postItem.link}`, [], config, post.id);

        if (config.SHARE_POST_TO_STORY && postItem.rawImages && postItem.rawImages.length > 0) {
            const postUrl = `https://www.facebook.com/${config.FB_PAGE_ID}/posts/${post.id}`;
            const imageUrl = postItem.rawImages[0];
            try {
                await postStoryWithLink(imageUrl, postUrl, config);
                sendLog(`📸 Đã chia sẻ bài viết lên 'Tin của bạn'.`);
            } catch (err) {
                sendLog(`❌ Lỗi khi chia sẻ lên Story: ${err.message}`, 'error');
            }
        }
        saveLogEntry({
            link: postItem.link,
            title: postItem.title,
            rewritten: postItem.content,
            image: postItem.rawImage,
            imgHash: postItem.imgHash,
            topics: postItem.topics,
            hashtags: postItem.hashtags
        });

        sendLog('post-success', 'post-success', { link: postItem.link, postId: post.id });

        if (config.REWRITE_MODE === 'ai') {
            incrementUsed(config);
        }
        lastPostTimestamp = currentTime;
    } catch (error) {
        let errorMessage = `❌ Lỗi khi đăng bài "${postItem.title}": ${error.message}`;
        sendLog(errorMessage, 'error');
        console.error("Lỗi chi tiết khi đăng bài:", error.response?.data?.error || error);
    }
  } else {
    sendLog('📭 Hàng chờ đăng bài trống.');
  }
}

async function handleCommentReactions(postId, config) {
    try {
        const { FB_PAGE_TOKEN, FB_GRAPH_API_VERSION, COMMENT_REACTION_TYPE } = config;
        const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${postId}/comments`;
        
        const res = await axios.get(url, { params: { access_token: FB_PAGE_TOKEN } });
        const comments = res.data.data;

        if (comments && comments.length > 0) {
            sendLog(`💬 Tìm thấy ${comments.length} bình luận trên bài viết ${postId}. Đang bắt đầu tương tác...`);
            for (const comment of comments) {
                await reactToFacebook(comment.id, COMMENT_REACTION_TYPE || 'LOVE', config);
                sendLog(`💖 Đã thả cảm xúc "${COMMENT_REACTION_TYPE || 'LOVE'}" vào bình luận của user ID: ${comment.from.id}`);
            }
        } else {
            sendLog(`🤷‍♂️ Không có bình luận nào để tương tác trên bài viết ${postId}.`);
        }
    } catch (error) {
        console.error('❌ Lỗi khi xử lý bình luận:', error.response?.data?.error?.message || error.message);
    }
}

async function crawlingLoop() {
  if (!isCrawlingRunning) {
    sendLog('🛑 Luồng cào bài đã nhận lệnh dừng và thoát.', 'stopped');
    return;
  }

  sendLog(`\n🔄 Bắt đầu chu kỳ cào bài mới [${new Date().toLocaleString()}]`);

  const config = loadConfig();
  const { REWRITE_MODE, DEBUG_MODE, sources, LOGO_PATH, CRAWL_LOOP_DELAY_MINUTES } = config;
  sendLog(`⚙️  Chế độ: ${REWRITE_MODE} | DEBUG: ${DEBUG_MODE}`);

  const trends = analyzeTrendingTopics(2, 5);
  if (trends.length > 0) {
    sendLog('🔥 Hot Topics gần đây: ' + trends.map(t => `${t.topic} (${t.count})`).join(', '));
  }

  const entries = loadLogEntries();
  const seenLinks = new Set();
  const articles = await crawlSources(sources);
  const seenImagesInQueue = new Set(postQueue.map(item => item.imgHash));

  if (articles.length === 0) {
    sendLog('🤷‍♀️ Không tìm thấy bài viết mới trong chu kỳ này.');
  }

  let articlesProcessedInCycle = 0;

  for (const art of articles) {
    if (!isCrawlingRunning) {
      sendLog('🛑 Luồng cào bài đã nhận lệnh dừng. Đang hoàn tất chu kỳ hiện tại...');
      break;
    }

    const { title, link, images } = art;

    if (!title || !link) {
      sendLog(`⚠️ Bỏ qua bài viết thiếu tiêu đề hoặc link.`);
      continue;
    }
    if (seenLinks.has(link) || isLinkPosted(link, entries)) {
      sendLog(`⏭️  Bỏ qua (đã xử lý/đăng): ${link}`);
      continue;
    }
    seenLinks.add(link);

    if (isTitleSimilarToLog(title, entries)) {
      sendLog(`⏭️  Tiêu đề gần giống bài cũ: ${title}`);
      continue;
    }

    let articleContent = await fetchArticleContent(link);
    if (articleContent) {
      articleContent = articleContent.split('\n\n').slice(0, 5).join('\n\n');
    }
    if (!articleContent || articleContent.length < 100) {
      articleContent = title;
    }
    
    const articleImages = await fetchArticleImages(link);
    const allImages = [...new Set([...(images || []), ...articleImages])];
    let rewritten = '';
    let topics = [];
    let hashtags = [];
    if (!isCrawlingRunning) {
            sendLog('🛑 Đã nhận lệnh dừng. Bỏ qua các bước xử lý AI.', 'warning');
            break;
        }

    try {
        if (REWRITE_MODE === 'ai') {
            sendLog('🤖 Chế độ AI: Đang viết lại, phân loại và tạo hashtag...');
            try {
                rewritten = await rewriteContent({ title, link, originalContent: articleContent }, config);
            } catch (error) {
                if (error instanceof RateLimitError) {
                    sendLog('⏳ Hết lượt AI. Đang thử lại bằng thuật toán...', 'warning');
                    rewritten = await rewriteManual({ title, link, originalContent: articleContent });
                } else {
                    sendLog(`❌ Lỗi khi viết lại AI cho bài "${title}": ${error.message}`, 'error');
                    console.error(error);
                    continue;
                }
            }

            if (!rewritten) {
                sendLog(`⚠️ Bỏ qua bài viết "${title}" do không thể viết lại.`, 'warning');
                continue;
            }

            topics = await classifyTopic(`${title}\n\n${articleContent}`, config);
            hashtags = await extractKeywords(rewritten, config);

        } else {
            sendLog('✍️ Chế độ Thuật toán: Đang tóm tắt cơ bản...');
            const manualResult = await rewriteManual({ title, link, originalContent: articleContent });
            rewritten = manualResult.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '');
        }
      } catch (error) {
          let errorMessage = `❌ Lỗi khi viết lại/phân tích AI cho bài "${title}": ${error.message}`;
          if (error instanceof RateLimitError) {
              errorMessage = `⏳ Hết lượt AI hoặc quá tải. Đã chuyển sang chế độ Thuật toán cho bài này.`;
              rewritten = await rewriteManual({ title, link, originalContent: articleContent });
          }
          sendLog(errorMessage, 'error');
          console.error(error);
      }


    if (hashtags.length > 0) {
      rewritten += `\n\n${hashtags.map(tag => `#${tag.replace(/#/g, '')}`).join(' ')}`;
    }

    let mediaPayload = [];
    let firstProcessedImageHash = null;

    if (allImages && allImages.length > 0) {
      const imageProcessingResults = await Promise.all(
          allImages.slice(0, 5).map(async (imgUrl, index) => {
              try {
                  const res = await axios.get(imgUrl, { responseType: 'arraybuffer' });
                  const originalImageBuffer = Buffer.from(res.data, 'binary');
                  const originalImageHash = getImageHash(originalImageBuffer);

                  if (isImageHashPosted(originalImageHash, entries)) {
                      sendLog(`⏭️ Ảnh gốc "${imgUrl}" trùng với log cũ. Bỏ qua.`);
                      return null;
                  }
                  // THÊM KIỂM TRA MỚI: kiểm tra ảnh có trong hàng chờ chưa
                  if (seenImagesInQueue.has(originalImageHash)) {
                      sendLog(`⏭️ Ảnh gốc "${imgUrl}" trùng với ảnh đang chờ. Bỏ qua.`);
                      return null;
                  }
                  
                  const buffer = await overlayLogo(imgUrl, LOGO_PATH);

                  if (buffer) {
                      const hash = getImageHash(buffer);
                      if (isImageHashPosted(hash, entries)) {
                          sendLog(`⏭️ Ảnh sau xử lý trùng với log cũ. Bỏ qua ảnh này.`, 'warning');
                          return null;
                      }
                      // THÊM KIỂM TRA MỚI: kiểm tra ảnh có trong hàng chờ chưa
                      if (seenImagesInQueue.has(hash)) {
                          sendLog(`⏭️ Ảnh sau xử lý trùng với ảnh đang chờ. Bỏ qua.`);
                          return null;
                      }

                      if (index === 0) {
                          firstProcessedImageHash = hash;
                          seenImagesInQueue.add(firstProcessedImageHash);
                      }
                      return { buffer, filename: `image_${index}.png` };
                  }
              } catch (err) {
                  sendLog(`⚠️ Lỗi xử lý ảnh ${imgUrl} (index ${index}): ${err.message}. Bỏ qua ảnh này.`, 'warning');
                  return null;
              }
          })
      );

      mediaPayload = imageProcessingResults.filter(item => item !== null);

      if (firstProcessedImageHash && isImageHashPosted(firstProcessedImageHash, entries)) {
          sendLog(`⏭️  Ảnh chính trùng với log cũ. Bỏ qua bài viết.`, 'warning');
          continue;
      }
    }

    if (rewritten && mediaPayload.length > 0) {
      postQueue.push({
        content: rewritten,
        media: mediaPayload,
        link: link,
        title: title,
        imgHash: firstProcessedImageHash,
        topics: topics,
        hashtags: hashtags,
        rawImages: allImages
      });
      articlesProcessedInCycle++;
      sendLog(`✅ Bài viết "${title}" đã được thêm vào hàng chờ đăng (${postQueue.length} bài).`);
      sendLog('new-content', 'new-content', {
          title: title,
          rewritten: rewritten,
          images: allImages,
          link: link
      });
    } else {
      sendLog(`⚠️ Bài viết "${title}" không đủ điều kiện để thêm vào hàng chờ (thiếu nội dung/ảnh).`, 'warning');
    }

    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  
  sendLog(`🏁 Hoàn thành chu kỳ cào bài. Đã xử lý ${articlesProcessedInCycle} bài viết.`);

  const crawlDelayMs = (CRAWL_LOOP_DELAY_MINUTES || 15) * 60 * 1000;
  sendLog(`⏳ Đang chờ ${crawlDelayMs / 60000} phút trước khi cào bài tiếp theo...`);
  setTimeout(crawlingLoop, crawlDelayMs);
}

// Các hàm processPostQueue, handleCommentReactions giữ nguyên

export function startCrawlingLoop(callback = console.log) {
  if (isCrawlingRunning) {
    sendLog('❗ Luồng tự động đã chạy rồi.');
    return;
  }
  logCallback = callback;
  isCrawlingRunning = true;
  crawlingLoop();

  if (postIntervalId) clearInterval(postIntervalId);
  postIntervalId = setInterval(processPostQueue, 60 * 1000);

  sendLog('Tiến trình cào và lập lịch đăng bài đã khởi động.', 'running');
}

export function stopCrawlingLoop() {
  if (!isCrawlingRunning) {
    sendLog('❗ Không có luồng tự động nào để dừng.');
    return;
  }
  isCrawlingRunning = false;
  if (postIntervalId) clearInterval(postIntervalId);
  postIntervalId = null;
  sendLog('🛑 Đã nhận lệnh dừng. Đang hoàn tất chu kỳ hiện tại...', 'stopping');
}

export function removePostFromQueue(linkToRemove) {
    const initialLength = postQueue.length;
    postQueue = postQueue.filter(post => post.link !== linkToRemove);
    return postQueue.length < initialLength;
}

export function getPostQueue() {
    return postQueue;
}