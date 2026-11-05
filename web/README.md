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

Để thử liên kết extension: chạy script, build extension bằng `npm run build` ở thư mục gốc, nạp `dist/` vào Chrome, rồi bấm **Liên kết tài khoản** trong popup. Đăng ký hoặc đăng nhập trên trang web và bấm **Xác nhận liên kết**. Sau tối đa khoảng 30 giây, popup sẽ hiển thị email đã liên kết.

Khi dùng API khác địa chỉ dev, build extension với `LEARNING_API_BASE` và `LEARNING_WEB_BASE` trỏ tới URL HTTPS của website. Đặt `POLY_WEB_ORIGIN` thành origin HTTPS của frontend và `POLY_SECURE_COOKIES=1` khi chạy trên HTTPS. Mặc định dev chỉ lắng nghe `127.0.0.1`.

## Kiểm tra

```powershell
uv run --project web python -m pytest web/tests -q
cd web
npm test
npm run build
```

## Production trên VPS

Stack ở `deploy/learning/compose.yml`: Vue được build thành static site trong Nginx, FastAPI chỉ nằm trong mạng Compose, và host chỉ bind frontend vào `127.0.0.1:8070`. Nginx của VPS dùng `deploy/learning/host-nginx.conf` để phục vụ `https://learning.peebot.shop`. File SQLite nằm ở `/var/lib/polytranslate-learning/learning.sqlite3`, tách khỏi container.

Sau khi đồng bộ source vào `/opt/polytranslate-learning`, tạo `/var/lib/polytranslate-learning` với UID 10001, rồi chạy `docker compose -f deploy/learning/compose.yml up -d --build`. Nếu xuất source bằng `git archive` trên Windows, dùng `git -c core.autocrlf=false archive` để giữ LF cho shell script. Cài backup service/timer trong `deploy/learning/` vào systemd dưới tên `polytranslate-learning-backup.service` và `.timer`. Backup được giữ 14 ngày tại `/var/backups/polytranslate-learning`; chạy `systemctl start polytranslate-learning-backup.service` để kiểm tra ngay. Bản sao này vẫn nằm trên cùng VPS, nên không bảo vệ trước sự cố mất toàn bộ máy.

Để build extension cài thủ công, đặt cả `LEARNING_API_BASE` và `LEARNING_WEB_BASE` thành `https://learning.peebot.shop`, rồi chạy `npm run build` ở thư mục gốc. Đóng gói nội dung `dist/` thành ZIP hoặc nạp `dist/` vào Chrome. Sau khi cập nhật extension, thử liên kết tài khoản với website thật.

Trước mỗi lần cập nhật backend, tạo backup và kiểm tra `GET /api/health`. Nếu cần quay về bản cũ, triển khai lại source/ảnh Docker trước đó nhưng giữ nguyên volume; nếu schema đã đổi, khôi phục bản SQLite tương ứng từ bản sao đã kiểm tra.

Phạm vi hiện tại: tài khoản, liên kết extension, cây thư mục. Lưu từ/câu từ tooltip thuộc các issue tiếp theo.
