// File: src/crawler.js
//-------------------------------------------------------------
// Crawl bài viết từ danh sách nguồn động (tối đa 5) được lưu
// trong config. Ưu tiên RSS, fallback HTML với selector cụ thể
// hoặc parse mặc định. Hỗ trợ auto‑discover RSS.
//-------------------------------------------------------------

import axios from "axios";
import Parser from "rss-parser";
import { load } from "cheerio";

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...';
const rssParser = new Parser({
  headers: {
    'User-Agent': USER_AGENT,
    'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
  },
  timeout: 10000
});

/* ---------------------------------------------------------
 * 1. Catalog các site đã support sẵn (selector & parser)
 *    Key: hostname (không www) => config preset
 * -------------------------------------------------------*/
const SITE_PRESETS = {
  "cafef.vn": {
    name: "CafeF",
    rss: "https://cafef.vn/home.rss",
    selector: ".topNewsList li, .list-news li",
    parse($el) {
      const $a = $el.find("a").first();
      const title = $a.find("h2, h3, .title").text().trim() || $a.text().trim();
      const link = $a.attr("href");
      const image = $el.find("img.thumb, img").attr("src") || null;
      return { title, link, image };
    },
  },
  "tuoitre.vn": {
    name: "Tuổi Trẻ",
    rss: "https://tuoitre.vn/rss/tin-moi-nhat.rss",
    selector: ".box-category-item",
    parse($el) {
      const $a = $el.find("a").first();
      return { title: $a.text().trim(), link: $a.attr("href"), image: $el.find("img").attr("src") || null };
    },
  },
  "dantri.com.vn": {
    name: "Dân Trí",
    rss: "https://dantri.com.vn/rss/home.rss",
    selector: ".news-item .news-item__content",
    parse($el) {
      const $a = $el.find("h3 a").first();
      const image = $el.parent().find("img").attr("data-src") || null;
      return { title: $a.text().trim(), link: $a.attr("href"), image };
    },
  },
  "thanhnien.vn": {
    name: "Thanh Niên",
    rss: "https://thanhnien.vn/rss/home.rss",
    selector: ".box-list.story .story-item",
    parse($el) {
      const title = $el.find(".story__title").text().trim();
      const link = $el.find(".story__thumb a").attr("href");
      const image = $el.find("img").attr("data-src") || null;
      return { title, link, image };
    },
  },
};

/* ---------------------------------------------------------
 * 2. Hàm lấy preset từ URL hoặc tạo config mặc định
 * -------------------------------------------------------*/
function buildSourceConfig(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    throw new Error(`URL không hợp lệ: ${rawUrl}`);
  }
  const host = url.hostname.replace(/^www\./, "");
  const preset = SITE_PRESETS[host];
  if (preset) return { ...preset, url: url.origin };

  // fallback generic
  return {
    name: host,
    url: url.origin,
    rss: null, // sẽ auto-discover
    selector: "a",
    parse: defaultParse,
  };
}

/* ---------------------------------------------------------
 * 3. Parser mặc định cho HTML fallback
 * -------------------------------------------------------*/
function defaultParse($el) {
  const $a = $el.is("a") ? $el : $el.find("a").first();
  return {
    title: $a.text().trim(),
    link: $a.attr("href"),
    image: $el.find("img").attr("src") || null,
  };
}

/* ---------------------------------------------------------
 * 4. Auto discover RSS trong <link> head
 * -------------------------------------------------------*/
async function discoverRss(homeUrl) {
  try {
    const { data } = await axios.get(homeUrl, { headers: { "User-Agent": USER_AGENT } });
    const $ = load(data);
    const rssLink = $('link[type="application/rss+xml"]').attr("href") || $('link[type="application/atom+xml"]').attr("href");
    if (!rssLink) return null;
    return rssLink.startsWith("http") ? rssLink : new URL(rssLink, homeUrl).href;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------
 * 5. Crawl nguồn động
 * -------------------------------------------------------*/
export async function crawlSources(sourceUrls = []) {
  // Nếu chưa truyền (test) → lấy preset default 3 site
  if (sourceUrls.length === 0) {
    sourceUrls = ["https://cafef.vn", "https://tuoitre.vn", "https://dantri.com.vn"];
  }

  const sources = await Promise.all(
    sourceUrls.slice(0, 5).map(async (u) => {
      const cfg = buildSourceConfig(u);
      if (!cfg.rss) cfg.rss = await discoverRss(cfg.url);
      return cfg;
    })
  );

  const results = [];

  for (const src of sources) {
    let items = [];

    /* ---------- 5.1 RSS ---------- */
    if (src.rss) {
      try {
        const feed = await rssParser.parseURL(src.rss);
        items = feed.items.slice(0, 5).map((item) => ({
          source: src.name,
          title: item.title?.trim() || "",
          link: item.link,
          images: collectImagesFromRssItem(item),
        }));
      } catch (err) {
        console.warn(`RSS fail ${src.name}:`, err.message);
      }
    }

    /* ---------- 5.2 HTML Fallback ---------- */
     if (items.length === 0 && src.url) {
      try {
        const { data } = await axios.get(src.url, { headers: { "User-Agent": USER_AGENT } });
        const $ = load(data);
        let count = 0;
        $(src.selector).each((i, el) => {
          if (count >= 5) return false;

          // === BẮT ĐẦU THAY ĐỔI ===
          const parsedData = src.parse($(el));
          const title = parsedData.title;
          const rawLink = parsedData.link;
          const link = normalizeUrl(rawLink, src.url);

          if (!title || !link || !/\d{4}/.test(link)) return;

          // Cố gắng lấy nhiều ảnh từ trong box
          const images = [];
          $(el).find("img").each((_, imgEl) => {
              const imgUrl = $(imgEl).attr("src") || $(imgEl).attr("data-src");
              if (imgUrl && images.length < 5) {
                  images.push(normalizeUrl(imgUrl, src.url));
              }
          });
          // === KẾT THÚC THAY ĐỔI ===

          results.push({ source: src.name, title, link, images: images });
          count++;
        });
      } catch (err) {
        console.warn(`HTML fail ${src.name}:`, err.message);
      }
    }

    results.push(...items);
  }

  return results;
}

/* ---------------------------------------------------------
 * 6. Helpers
 * -------------------------------------------------------*/
function collectImagesFromRssItem(item) {
  const imgs = [];
  if (item.enclosure?.url) imgs.push(item.enclosure.url);
  if (item.content) {
    const $ = load(item.content);
    $("img").each((_, el) => {
      const u = $(el).attr("src");
      if (u) imgs.push(u);
    });
  }
  return Array.from(new Set(imgs));
}

function normalizeUrl(raw, base) {
  if (!raw) return "";
  return raw.startsWith("http") ? raw : new URL(raw, base).href;
}

/* ---------------------------------------------------------
 * 7. Lấy nội dung chi tiết bài viết
 * -------------------------------------------------------*/
export async function fetchArticleContent(url) {
  // Giả lập headers của một trình duyệt thật để tránh bị chặn
  const browserHeaders = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    'Sec-Ch-Ua': '"Not A;Brand";v="99", "Chromium";v="90", "Google Chrome";v="90"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
  };

  try {
    // Sử dụng bộ headers đã giả lập
    const { data } = await axios.get(url, { headers: browserHeaders });

    const $ = load(data);
    const host = new URL(url).hostname.replace(/^www\./, "");

    const PARA_SELECTOR = {
      "vnexpress.net": ".fck_detail p",
      "cafef.vn": ".detail-content p, .main-content-body p, .t-text-justify p",
      "tuoitre.vn": ".detail-content p, .main-content-body p, .content-detail p",
      "dantri.com.vn": ".dt-news__content p, .singular-content p",
      "thanhnien.vn": ".details__content p, .detail-content p",
      "vietnamnet.vn": ".maincontent p, .main-content p",
      "24h.com.vn": ".text-conent p, .cate-24h-foot p",
    };

    const sel = PARA_SELECTOR[host] || "article p, .main-content p, .fck_detail p";
    const textArray = $(sel)
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((t) => t.length > 50);

    return textArray.join("\n\n");
  } catch (err) {
    console.error(`❌ fetchArticleContent: ${err.message}`);
    return "";
  }
}
// Hàm lấy tất cả ảnh từ nội dung chi tiết
export async function fetchArticleImages(url) {
    try {
        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36',
        };
        const { data } = await axios.get(url, { headers: browserHeaders });
        const $ = load(data);
        const images = [];

        // Tìm tất cả các thẻ <img> trong nội dung bài viết
        const foundImages = $('article img, .content-detail img, .detail-content img, .fck_detail img, .maincontent img')
            .map((_, el) => {
                const imgUrl = $(el).attr('src') || $(el).attr('data-src');
                if (imgUrl) {
                    return normalizeUrl(imgUrl, url);
                }
            })
            .get();

        // Lọc và chỉ giữ lại ảnh chất lượng cao
        const filteredImages = await Promise.all(
            foundImages.map(async (imgUrl) => {
                const isValid = await isHighResImage(imgUrl);
                return isValid ? imgUrl : null;
            })
        );
        
        return filteredImages.filter(Boolean); // Lọc các giá trị null
    } catch (err) {
        console.error(`❌ Lỗi khi lấy ảnh từ nội dung bài viết: ${err.message}`);
        return [];
    }
}
async function isHighResImage(url, minSizeInBytes = 50000) { // Ví dụ: 50KB
  try {
    const res = await axios.head(url, { timeout: 5000 });
    const contentType = res.headers['content-type'];
    const contentLength = parseInt(res.headers['content-length'], 10);
    
    // Bỏ qua nếu không phải ảnh hoặc dung lượng quá nhỏ
    if (!contentType || !contentType.startsWith('image/') || contentLength < minSizeInBytes) {
      return false;
    }
    
    // Nếu là ảnh, kiểm tra định dạng và bỏ qua GIF
    const extension = url.split('.').pop().toLowerCase();
    if (extension === 'gif') {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}