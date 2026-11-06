# PolyTranslate Learning

Website học tiếng Trung, nằm riêng trong `web/`. Frontend dùng Vue + TypeScript + Tailwind CSS; API dùng FastAPI với Python type hints; dữ liệu dev lưu trong SQLite.

## Chạy dev trên Windows

Từ thư mục gốc repo:

```powershell
uv sync --project web
cd web
npm ci
cd ..
python web/dev.py
```

Script cuối chạy cả API (`http://127.0.0.1:8000`) lẫn web (`http://127.0.0.1:5173`) trong một terminal. Nhấn Ctrl+C để dừng cả hai.

Để thử liên kết extension với máy chủ dev: chạy script, đặt `$env:LEARNING_API_BASE='http://127.0.0.1:8000'` và `$env:LEARNING_WEB_BASE='http://127.0.0.1:5173'` trong terminal build, rồi chạy `npm run build` ở thư mục gốc và nạp `dist/` vào Chrome. Bấm **Liên kết tài khoản** trong popup, đăng ký hoặc đăng nhập trên trang web và bấm **Xác nhận liên kết**. Sau tối đa khoảng 30 giây, popup sẽ hiển thị tên đăng nhập đã liên kết.

Mặc định extension build kết nối `https://learning.peebot.shop`. Khi dùng máy chủ khác, đặt `LEARNING_API_BASE` và `LEARNING_WEB_BASE` trước khi build. Đặt `POLY_WEB_ORIGIN` thành origin HTTPS của frontend và `POLY_SECURE_COOKIES=1` khi chạy trên HTTPS. Máy chủ dev chỉ lắng nghe `127.0.0.1`.

## Kiểm tra

```powershell
uv run --project web python -m pytest web/tests -q
cd web
npm test
npm run build
```

## Flashcard trên điện thoại

Mở website bằng Safari trên iPhone, đăng nhập cùng Learning Account và chọn **Ôn tập**. Chọn thư mục, **Từ/cụm**, **Câu** hoặc **Cả hai**, rồi dùng flashcard thường, **Nghe và nói theo** hoặc **Nhìn nghĩa và tự nói**. Thiết lập tự thu gọn khi bắt đầu; ô nháp có thể mở khi cần.

**Nhớ / Chưa nhớ** ghi kết quả và sang thẻ kế; **Lùi / Tiếp** chỉ chuyển thẻ. **Tiếp tục bài dở** khôi phục đúng thứ tự, vị trí và kết quả. Phần nghe mẫu dùng giọng tiếng Trung phổ thông của thiết bị; nếu chưa có giọng hoặc trình duyệt chặn tự phát, trang hướng dẫn thử lại bằng nút Nghe mẫu.

Thu âm yêu cầu HTTPS và quyền micro. Mỗi thẻ giữ một bản thu mới nhất trong bộ nhớ trang, không tải âm thanh lên server hoặc lưu vào bộ nhớ bền vững. Chuyển ứng dụng/khóa màn hình dừng micro; kết thúc luyện, rời trang hoặc tải lại sẽ xóa các bản thu. Tiếp tục bài dở không khôi phục bản thu.

Kiểm tra luồng trình duyệt với API và SQLite tạm riêng:

```powershell
cd web
npx playwright install chromium webkit
npm run test:e2e
```

Tests chạy bản build production, không dùng dữ liệu học thật. WebKit trên Windows không cung cấp các API media nên luồng media ở đó dùng test double tại ranh giới thiết bị; Chromium kiểm tra thu, encode và playback native với thiết bị micro giả của trình duyệt. Kiểm tra này không thay thế việc thử micro/loa trên iPhone thật.

## Production trên VPS

Stack ở `deploy/learning/compose.yml`: Vue được build thành static site trong Nginx, FastAPI chỉ nằm trong mạng Compose, và host chỉ bind frontend vào `127.0.0.1:8070`. Nginx của VPS dùng `deploy/learning/host-nginx.conf` để phục vụ `https://learning.peebot.shop`. File SQLite nằm ở `/var/lib/polytranslate-learning/learning.sqlite3`, tách khỏi container.

Sau khi đồng bộ source vào `/opt/polytranslate-learning`, tạo `/var/lib/polytranslate-learning` với UID 10001, rồi chạy `docker compose -f deploy/learning/compose.yml up -d --build`. Nếu xuất source bằng `git archive` trên Windows, dùng `git -c core.autocrlf=false archive` để giữ LF cho shell script. Cài backup service/timer trong `deploy/learning/` vào systemd dưới tên `polytranslate-learning-backup.service` và `.timer`. Backup được giữ 14 ngày tại `/var/backups/polytranslate-learning`; chạy `systemctl start polytranslate-learning-backup.service` để kiểm tra ngay. Bản sao này vẫn nằm trên cùng VPS, nên không bảo vệ trước sự cố mất toàn bộ máy.

Để build extension cài thủ công, chạy `npm run build` ở thư mục gốc. Đóng gói nội dung `dist/` thành ZIP hoặc nạp `dist/` vào Chrome. Sau khi cập nhật extension, thử liên kết tài khoản với website thật.

Trước mỗi lần cập nhật backend, tạo backup và kiểm tra `GET /api/health`. Nếu cần quay về bản cũ, triển khai lại source/ảnh Docker trước đó nhưng giữ nguyên volume; nếu schema đã đổi, khôi phục bản SQLite tương ứng từ bản sao đã kiểm tra.

Phạm vi hiện tại: tài khoản, liên kết extension, cây thư mục có thể xổ từng cấp, lưu từ/câu từ tooltip, thêm Từ / cụm từ hoặc Câu trên web, liên kết câu ví dụ, Ngữ pháp và Ghi chú.
