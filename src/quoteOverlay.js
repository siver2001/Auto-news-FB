// File: src/quoteOverlay.js (Đã tái cấu trúc cho môi trường web)
import axios from 'axios';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';

/**
 * Dán logo lên một hình ảnh và trả về buffer của ảnh đã xử lý.
 * @param {string} imageUrl URL của ảnh gốc.
 * @param {string} logoPath Đường dẫn tuyệt đối đến file logo trên máy chủ.
 * @returns {Promise<Buffer>} Buffer của ảnh đã được dán logo.
 */
export async function overlayLogo(imageUrl, logoPath) {
    try {
        // Tải ảnh gốc vào buffer
        let imageBuffer;
        if (/^https?:\/\//i.test(imageUrl)) {
            const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            imageBuffer = Buffer.from(res.data, 'binary');
        } else if (imageUrl.startsWith('data:image')) {
            const base64Data = imageUrl.split(';base64,').pop();
            imageBuffer = Buffer.from(base64Data, 'base64');
        } else {
            // Trường hợp này có thể xảy ra nếu ảnh đã được lưu cục bộ trên server
            imageBuffer = fs.readFileSync(imageUrl);
        }

        const originalImage = sharp(imageBuffer);
        const metadata = await originalImage.metadata();
        const originalWidth = metadata.width;

        // Giả định logoPath là đường dẫn hợp lệ trên máy chủ.
        // File logo phải được tải lên và lưu trữ trước đó.
        if (!logoPath || !fs.existsSync(logoPath)) {
            console.log("[overlayLogo] Không có logo hoặc đường dẫn sai trên server, sử dụng ảnh gốc.");
            return originalImage.toBuffer();
        }
        
        const logoExtension = path.extname(logoPath).toLowerCase();
        if (logoExtension === '.pdf') {
            console.error('❌ Lỗi: Không hỗ trợ định dạng PDF. Vui lòng chuyển đổi logo sang PNG hoặc JPG.');
            return originalImage.toBuffer();
        }
        
        console.log(`[overlayLogo] Tìm thấy logo, bắt đầu dán...`);
        
        // Tính toán kích thước logo mới dựa trên chiều rộng ảnh gốc.
        // Ví dụ: logo chiếm 10% chiều rộng ảnh gốc.
        const logoTargetWidth = Math.floor(originalWidth * 0.1);
        
        const resizedLogoBuffer = await sharp(logoPath)
            .resize({ width: logoTargetWidth, fit: sharp.fit.contain })
            .toBuffer();
        
        return originalImage
            .composite([{
                input: resizedLogoBuffer,
                gravity: 'northeast',
                top: 30,
                left: 30
            }])
            .toBuffer(); 

    } catch (err) {
        console.error('❌ Lỗi khi dán logo:', err.message || err);
        throw err;
    }
}