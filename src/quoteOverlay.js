// File: src/quoteOverlay.js (Hỗ trợ nhiều định dạng ảnh)
import axios from 'axios';
import fs from 'fs';
import sharp from 'sharp';
import path from 'path';

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
            imageBuffer = fs.readFileSync(imageUrl);
        }

        // Lấy metadata của ảnh gốc để biết kích thước và định dạng
        const originalImage = sharp(imageBuffer);
        const metadata = await originalImage.metadata();
        const originalWidth = metadata.width;

        if (!logoPath || !fs.existsSync(logoPath)) {
            console.log("[overlayLogo] Không có logo hoặc đường dẫn sai, sử dụng ảnh gốc.");
            return originalImage.toBuffer();
        }
        
        const logoExtension = path.extname(logoPath).toLowerCase();
        if (logoExtension === '.pdf') {
            console.error('❌ Lỗi: Không hỗ trợ định dạng PDF. Vui lòng chuyển đổi logo sang PNG hoặc JPG.');
            return originalImage.toBuffer();
        }
        
        console.log(`[overlayLogo] Tìm thấy logo, bắt đầu dán...`);
        
        // ------------------- LOGIC MỚI: TỰ ĐỘNG CHỈNH KÍCH THƯỚC LOGO -------------------
        // Tính toán kích thước logo mới dựa trên chiều rộng ảnh gốc.
        // Ví dụ: logo chiếm 10% chiều rộng ảnh gốc.
        const logoTargetWidth = Math.floor(originalWidth * 0.1); // Chiếm 10% chiều rộng
        
        // Resize logo để phù hợp với kích thước mới, không làm bể hình
        const resizedLogoBuffer = await sharp(logoPath)
            .resize({ width: logoTargetWidth, fit: sharp.fit.contain })
            .toBuffer();
        // ------------------- KẾT THÚC LOGIC MỚI -------------------
        
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
