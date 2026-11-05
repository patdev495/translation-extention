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

Khi dùng API khác địa chỉ dev, build extension với biến môi trường `LEARNING_API_BASE` trỏ tới URL HTTPS của API và đặt `POLY_WEB_ORIGIN` thành origin HTTPS của frontend. Đặt `POLY_SECURE_COOKIES=1` khi chạy trên HTTPS. Mặc định dev chỉ lắng nghe `127.0.0.1`.

## Kiểm tra

```powershell
uv run --project web python -m pytest web/tests -q
cd web
npm test
npm run build
```

Phạm vi hiện tại: tài khoản, liên kết extension, cây thư mục. Lưu từ/câu từ tooltip thuộc các issue tiếp theo.
