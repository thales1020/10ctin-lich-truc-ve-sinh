# Lịch trực vệ sinh — Lớp 10 CTin, THPT Thoại Ngọc Hầu

Web tĩnh cho 5 tổ đăng ký ngày trực vệ sinh (Thứ 2 – Thứ 6), up ảnh minh chứng công khai.
Backend: Google Sheets (lưu dữ liệu) + Google Apps Script (API) + Google Drive (lưu ảnh).
Frontend: HTML/CSS/JS thuần, deploy bằng GitHub Pages.

## 1. Tạo Google Sheet + Drive folder

1. Vào [Google Drive](https://drive.google.com), tạo:
   - Một **Google Sheet** mới, đặt tên tuỳ ý (ví dụ "Lich truc ve sinh - Data"). Không cần tạo sẵn cột, script sẽ tự tạo.
   - Một **thư mục (folder)** mới để chứa ảnh trực nhật (ví dụ "Anh truc ve sinh").
2. Mở Sheet vừa tạo, copy **Sheet ID** từ URL:
   `https://docs.google.com/spreadsheets/d/`**`ĐÂY_LÀ_SHEET_ID`**`/edit`
3. Mở folder vừa tạo, copy **Folder ID** từ URL:
   `https://drive.google.com/drive/folders/`**`ĐÂY_LÀ_FOLDER_ID`**

## 2. Tạo Apps Script

1. Trong Google Sheet vừa tạo: menu **Extensions → Apps Script** (Tiện ích mở rộng → Apps Script).
2. Xoá hết code mẫu trong `Code.gs`, dán toàn bộ nội dung file [`apps-script/Code.gs`](apps-script/Code.gs) của repo này vào.
3. Sửa 2 dòng đầu:
   ```js
   var SHEET_ID = 'ĐÂY_LÀ_SHEET_ID';
   var FOLDER_ID = 'ĐÂY_LÀ_FOLDER_ID';
   ```
4. Lưu (Ctrl+S), đặt tên project tuỳ ý (ví dụ "Lich truc API").

## 3. Deploy làm Web App

1. Trong Apps Script Editor: nút **Deploy → New deployment**.
2. Chọn loại: **Web app**.
3. Cấu hình:
   - **Execute as**: Me (tài khoản của bạn)
   - **Who has access**: Anyone
4. Nhấn **Deploy**, cấp quyền khi được hỏi (Authorize access → chọn tài khoản Google → Advanced → Go to (project name) → Allow).
5. Copy **Web app URL** (dạng `https://script.google.com/macros/s/AKfycb.../exec`).
6. Mở file `app.js` trong repo, dán URL này vào dòng đầu:
   ```js
   const API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```

> Mỗi khi bạn sửa `Code.gs`, phải **Deploy → Manage deployments → sửa (edit) → New version** thì thay đổi mới có hiệu lực trên URL đã deploy.

## 4. Thiết lập trigger tự động random slot trống

1. Trong Apps Script Editor, chọn menu bên trái: **Triggers** (biểu tượng đồng hồ).
2. **Add Trigger**:
   - Function: `assignRandomSlots`
   - Deployment: Head
   - Event source: **Time-driven**
   - Type: **Week timer**
   - Day of week: **Every Monday**
   - Time of day: **Midnight to 1am**
3. Lưu.

Từ giờ, mỗi Thứ Hai, script sẽ tự động: khóa tuần hiện tại (random gán tổ còn thiếu vào ngày trống) và đảm bảo tuần kế tiếp được mở đăng ký.

**Test thủ công**: chọn function `assignRandomSlots` trong thanh công cụ Apps Script rồi bấm nút Run — kiểm tra Sheet cập nhật đúng.

## 5. Deploy frontend lên GitHub Pages

1. Tạo repo GitHub mới (hoặc dùng repo hiện tại), push toàn bộ nội dung thư mục này (`index.html`, `style.css`, `app.js`, thư mục `apps-script/`).
2. Vào **Settings → Pages** của repo:
   - Source: **Deploy from a branch**
   - Branch: `main`, folder: `/ (root)`
3. Sau vài phút, trang sẽ có ở `https://<username>.github.io/<repo>/`.

## 6. Kiểm tra hoạt động

- Mở trực tiếp URL Apps Script kèm `?weeks=2026-08-10,2026-08-17` trên trình duyệt — phải thấy JSON trả về.
- Mở trang GitHub Pages, thử đăng ký 1 ngày cho 1 tổ, kiểm tra Google Sheet có cập nhật cột tương ứng.
- Thử up ảnh cho 1 ngày (ở tuần đã "locked") — kiểm tra ảnh xuất hiện trong Drive folder và hiển thị trên web.
- Chạy thử `assignRandomSlots` thủ công để xác nhận cơ chế random hoạt động đúng, không ghi đè slot đã có tổ đăng ký.

## Cấu trúc dữ liệu (Sheet `Schedule`)

| WeekStart | Status | Mon_To | Mon_PhotoUrl | Mon_UploadedAt | ... (Tue, Wed, Thu, Fri tương tự) |
|---|---|---|---|---|---|

- `Status`: `open` (đang nhận đăng ký) hoặc `locked` (đã chốt, chỉ còn up được ảnh).
- Có thể sửa trực tiếp trên Sheet nếu cần điều chỉnh thủ công (ví dụ đổi tổ trực do có sự cố).
