// File: src/poster.js (Bản đầy đủ và hoàn chỉnh)
import axios from 'axios';
import FormData from 'form-data';

/**
 * Upload một ảnh (URL hoặc buffer) lên Facebook dưới dạng chưa công bố.
 */
async function uploadUnpublishedPhoto(photoData, config) {
  const { FB_PAGE_ID, FB_PAGE_TOKEN, FB_GRAPH_API_VERSION } = config;
  const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${FB_PAGE_ID}/photos`;

  const form = new FormData();
  form.append('access_token', FB_PAGE_TOKEN);
  form.append('published', 'false');

  if (typeof photoData === 'string') {
    form.append('url', photoData);
  } else if (photoData && photoData.buffer) {
    form.append('source', photoData.buffer, { filename: photoData.filename });
  } else {
    return null;
  }

  try {
    const response = await axios.post(url, form, { headers: form.getHeaders() });
    return response.data.id;
  } catch (error) {
    console.error(`❌ Lỗi upload ảnh:`, error.response?.data?.error?.message || error.message);
    return null;
  }
}

/**
 * Đăng bài viết lên fanpage Facebook hoặc comment.
 * @param {string} message - Caption của bài viết hoặc nội dung comment.
 * @param {Array<string | {buffer: Buffer, filename: string}>} mediaItems - MẢNG các URL hoặc buffer ảnh.
 * @param {object} config - Đối tượng cấu hình.
 * @param {string|null} [targetPostId=null] - ID bài viết để comment.
 * @returns {Promise<object>} Dữ liệu trả về từ Facebook API.
 */
async function postToFacebook(message, mediaItems = [], config, targetPostId = null) {
  const { FB_PAGE_ID, FB_PAGE_TOKEN, FB_GRAPH_API_VERSION } = config;

  if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
    throw new Error('Thiếu FB_PAGE_ID hoặc FB_PAGE_TOKEN.');
  }

  // Chế độ comment
  if (targetPostId) {
    const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${targetPostId}/comments`;
    return axios.post(url, { message, access_token: FB_PAGE_TOKEN }).then(res => res.data);
  }
  
  // Chế độ đăng bài mới
  const validMedia = Array.isArray(mediaItems) ? mediaItems.filter(item => item) : [];

  // Đăng bài không có ảnh
  if (validMedia.length === 0) {
    const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${FB_PAGE_ID}/feed`;
    return axios.post(url, { message, access_token: FB_PAGE_TOKEN }).then(res => res.data);
  }

  // Đăng bài có 1 ảnh (buffer) hoặc nhiều ảnh
  const uploadPromises = validMedia.map(item => uploadUnpublishedPhoto(item, config));
  const photoIds = (await Promise.all(uploadPromises)).filter(id => id);

  if (photoIds.length === 0) {
    console.error("❌ Không upload được ảnh nào, thử đăng bài dạng text.");
    return postToFacebook(message, [], config);
  }

  // Cách bền vững: dùng form-data với attached_media[i]
  const form = new FormData();
  form.append('message', message);
  form.append('access_token', FB_PAGE_TOKEN);
  photoIds.forEach((id, i) => {
    form.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id }));
  });

  const feedUrl = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${FB_PAGE_ID}/feed`;
  const response = await axios.post(feedUrl, form, { headers: form.getHeaders() });
  return response.data;
  
}
/**
 * Thả cảm xúc vào một bài viết hoặc comment trên Facebook.
 * @param {string} objectId - ID của bài viết hoặc comment.
 * @param {string} reactionType - Loại cảm xúc: LIKE, LOVE, WOW, HAHA, SAD, ANGRY.
 * @param {object} config - Đối tượng cấu hình.
 * @returns {Promise<object>} Dữ liệu trả về từ API.
 */
async function reactToFacebook(objectId, reactionType = 'LIKE', config) {
  const { FB_PAGE_TOKEN, FB_GRAPH_API_VERSION } = config;
  const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${objectId}/reactions`;
  try {
    const response = await axios.post(url, {
      access_token: FB_PAGE_TOKEN,
      type: reactionType
    });
    return response.data;
  } catch (error) {
    console.error(`❌ Lỗi khi thả cảm xúc (${reactionType}) vào ${objectId}:`, error.response?.data?.error?.message || error.message);
    return null;
  }
}
/**
 * Đăng Story với một hình ảnh và một liên kết đến bài viết.
 * @param {string} imageUrl - URL của ảnh cho Story.
 * @param {string} postUrl - URL của bài viết trên fanpage.
 * @param {object} config - Đối tượng cấu hình.
 * @returns {Promise<object>} Dữ liệu trả về từ Facebook API.
 */
async function postStoryWithLink(imageUrl, postUrl, config) {
  const { FB_PAGE_ID, FB_PAGE_TOKEN, FB_GRAPH_API_VERSION } = config;
  const url = `https://graph.facebook.com/${FB_GRAPH_API_VERSION}/${FB_PAGE_ID}/photos`;

  const form = new FormData();
  form.append('access_token', FB_PAGE_TOKEN);
  form.append('url', imageUrl);
  form.append('published', 'true');
  form.append('is_post', 'false');
  form.append('link', postUrl);

  try {
    const response = await axios.post(url, form, { headers: form.getHeaders() });
    return response.data;
  } catch (error) {
    console.error('❌ Lỗi khi đăng Story với liên kết:', error.response?.data?.error?.message || error.message);
    throw new Error('Không thể đăng Story lên Facebook.');
  }
}

export { postToFacebook, reactToFacebook, postStoryWithLink };