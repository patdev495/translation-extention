# Phát hành flashcard nghe và nói trên iPhone

Trạng thái: Đã triển khai và kiểm chứng ngày 2026-11-06.

- Production: https://learning.peebot.shop
- Code commit: `9e8a0180cfd121595d8c22507a93f34ef4bf5275`
- Nhánh đã push: `codex/mobile-flashcard-practice`
- Source trên VPS: `/opt/polytranslate-learning`, file `RELEASE` chứa đúng code commit trên.

## Kiểm chứng

| Ranh giới | Bằng chứng |
| --- | --- |
| HTTP API và SQLite test thật | 44 pytest tests qua, gồm lọc từ/câu theo cây thư mục, resume sau khởi động lại, không cộng trùng kết quả, cách ly tài khoản, vị trí sai và nội dung bị xóa. |
| Giao diện web | 53 Vitest tests qua. Test mới dùng HTTP và API thiết bị ở ranh giới, không mock module nội bộ. |
| Extension | 153 tests qua; kiểm tra TypeScript qua. Hai test đóng gói build được extension và kiểm tra dữ liệu Hanzi. |
| Trình duyệt | 6 Playwright tests qua trên WebKit mô phỏng iPhone và Chromium điện thoại, gồm vùng chạm >=44px, câu dài, thu theo thẻ, chuyển nền và tải lại buổi dở. |
| Build | `vue-tsc --noEmit` và Vite build qua; Docker build production qua. |
| Site thật | Production smoke qua trên HTTPS: từ/câu, đánh giá, thu và phát native, không upload âm thanh, resume cùng session/thứ tự/kết quả, bản thu mất sau reload và kết thúc buổi. |

Production smoke chạy lúc `2026-11-06T10:11:39.644Z`. Bản thu kiểm thử native là WebM/Opus, 9,667 bytes. Micro đầu vào là thiết bị giả của Chromium; capture, encode và playback dùng API native. Tài khoản và dữ liệu kiểm thử riêng đã được xóa sau khi kiểm chứng.

## Đối chiếu PRD

1. Thẻ, bộ chọn từ/câu, thao tác lật và điều khiển độc lập: UI tests và browser layout tests qua.
2. Tự phát đúng chế độ và nhớ lựa chọn: UI test Speech Synthesis qua; thiếu giọng phổ thông có hướng dẫn và không dùng nhầm giọng Quảng Đông.
3. Bản thu theo từng thẻ, thu lại thay bản cũ: UI và browser tests qua.
4. Ẩn trang dừng micro, giữ bản thu khi trang còn nguyên: UI và browser tests qua; trường hợp quyền micro phản hồi muộn không làm thu ở thẻ khác.
5. Tự đánh giá tách khỏi điều hướng: API/UI tests và smoke production qua; Space trên điều khiển không chuyển thẻ thêm lần nữa.
6. Reload và resume giữ vị trí/thứ tự/kết quả, không giữ bản thu: API, UI, browser và production smoke qua.
7. Kết thúc hoặc tạo buổi mới xóa bản thu: UI/browser tests qua; tạo buổi mới thất bại không xóa bản thu đang có.
8. Lỗi micro, giọng đọc, mạng không làm hỏng flashcard hoặc kết quả đã lưu: UI tests qua.

## Backup và xác minh mã đang chạy

Trước deploy đã backup source, giữ image cũ và kiểm tra SQLite bằng `PRAGMA quick_check`.

Thư mục rollback: `/var/backups/polytranslate-learning/releases/9e8a0180cfd121595d8c22507a93f34ef4bf5275/`.

| Tệp đang chạy | SHA-256 đã đối chiếu |
| --- | --- |
| Backend `/app/server/main.py` | `c3c966cf9ace88afca5cbde13094f8f304ba8a11ace340609293aa544c38b97d` |
| Backend `/app/server/database.py` | `e7aecdc8058e9daa675bda50c3dc176044f0e58ec2a330363a796ba6ba9ec026` |
| Frontend `index-BN10_d0T.js` | `660a76871a6b8f1a8700bc41b167e198d81daae131f24beef60e3be9f03f3d6e` |
| Frontend `index-O-4q337W.css` | `d993142cfe00f79864d576b540d8b15c1bc3887bd6434bd4cc7b257bcb74146b` |

Backend hash khớp commit; asset hash khớp bản build local được browser tests kiểm tra. `/api/health` trả `{"status":"ok"}` trên HTTPS sau deploy.

## Giới hạn kiểm chứng thiết bị

Chưa thử micro/loa trên iPhone vật lý. WebKit trên Windows không cung cấp API media, nên test lifecycle media ở WebKit dùng double tại seam thiết bị; luồng encode/playback native được kiểm tra ở Chromium. Giọng mẫu là giọng phổ thông có trên thiết bị người học.
