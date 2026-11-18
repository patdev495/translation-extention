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

Trong một thư mục có thư mục con, bấm **Mở tất cả danh sách** để xem chung Từ / cụm từ, Câu, Ngữ pháp và Ghi chú của thư mục đó cùng toàn bộ các cấp bên dưới. Danh sách dùng cùng thẻ, bộ lọc, sắp xếp, phân trang và nút phát âm như thư mục thường; bấm **Về thư mục** để trở lại cấp hiện tại. Chọn/xóa trong danh sách gộp áp dụng cho phạm vi đang xem; dọn sạch giữ nguyên cấu trúc thư mục và yêu cầu xác nhận trước khi chuyển các mục vào thùng rác.

Ở màn hình thư viện, mỗi mục **Từ / cụm từ** và **Câu** có nút loa để nghe trực tiếp, kể cả khi ẩn chữ Trung hoặc Pinyin. Nút cũng có trong cửa sổ mục liên kết. Bấm lại để dừng; bấm mục khác để chuyển sang đọc mục đó. Giọng đọc dùng cùng thiết lập tiếng Trung phổ thông của thiết bị như phần ôn tập. Trên iPhone, nếu không nghe được, kiểm tra chế độ Im lặng và âm lượng.

Mở website bằng Safari trên iPhone, đăng nhập cùng Learning Account và chọn **Ôn tập**. Chọn thư mục, **Từ/cụm**, **Câu** hoặc **Cả hai**, rồi dùng flashcard thường, **Nghe và nói theo** hoặc **Nhìn nghĩa và tự nói**. Thiết lập tự thu gọn khi bắt đầu; ô nháp có thể mở khi cần.

**Ôn theo lịch** dùng FSRS 6 với mục tiêu ghi nhớ 90%, bước học 1 và 10 phút, và bước học lại 10 phút. Khi lật thẻ, các nút **Quên**, **Khó nhớ**, **Nhớ được** và **Nhớ ngay** (phím `1` đến `4`) hiển thị khoảng ôn dự kiến. Sau khi chấm, lịch được lưu theo thẻ trong Learning Account. Buổi mới lấy thẻ đến hạn trước, rồi thêm tối đa 5 thẻ mới mỗi ngày theo UTC. Cuối buổi, bấm **Kiểm tra thẻ đến hạn** để lấy các thẻ vừa đến lượt. Lần đánh giá đầu tiên trong chế độ này bắt đầu lịch FSRS cho thẻ.

**Ôn tự do** cho phép luyện mọi thẻ trong phạm vi đã chọn mà không làm thay đổi lịch FSRS. **Lùi / Tiếp** chỉ chuyển thẻ. **Tiếp tục bài dở** khôi phục đúng thứ tự, vị trí và kết quả. Phần nghe mẫu dùng giọng tiếng Trung phổ thông của thiết bị. Nếu chưa có giọng hoặc trình duyệt chặn tự phát, trang hướng dẫn thử lại bằng nút Nghe mẫu.

Nếu iPhone báo chưa có giọng tiếng Trung phổ thông: vào **Cài đặt → Trợ năng → Đọc & Nói** (hoặc **Nội dung được đọc** trên iOS cũ) **→ Giọng nói → Tiếng Trung**, chọn và tải một giọng **Mandarin**. Mở lại trình duyệt rồi bấm **Nghe mẫu**. Website kiểm tra lại danh sách giọng mỗi lần bấm; nếu danh sách còn rỗng, website yêu cầu đọc bằng `zh-CN` ngay trong thao tác bấm để trình duyệt tự chọn giọng. Đây vẫn là giọng của thiết bị; website chưa cung cấp giọng đọc từ server.

Thu âm yêu cầu HTTPS và quyền micro. Mỗi thẻ giữ một bản thu mới nhất trong bộ nhớ trang, không tải âm thanh lên server hoặc lưu vào bộ nhớ bền vững. Chuyển ứng dụng/khóa màn hình dừng micro; kết thúc luyện, rời trang hoặc tải lại sẽ xóa các bản thu. Tiếp tục bài dở không khôi phục bản thu.

Kiểm tra luồng trình duyệt với API và SQLite tạm riêng:

```powershell
cd web
npx playwright install chromium webkit
npm run test:e2e
```

Tests chạy bản build production, không dùng dữ liệu học thật. WebKit trên Windows không cung cấp các API media nên luồng media ở đó dùng test double tại ranh giới thiết bị; Chromium kiểm tra thu, encode và playback native với thiết bị micro giả của trình duyệt. Kiểm tra này không thay thế việc thử micro/loa trên iPhone thật.

`e2e/production-smoke.mjs` là kiểm tra site thật chỉ chạy khi được yêu cầu rõ ràng, không được thu thập bởi các lệnh test trên. Script cần URL production và thư mục lưu kết quả, tạo tài khoản kiểm thử riêng và ghi ID tài khoản vào report; phải dọn đúng tài khoản kiểm thử này sau khi chạy. Script không ghi mật khẩu hoặc cookie vào report.

## Production trên VPS

Stack ở `deploy/learning/compose.yml`: Vue được build thành static site trong Nginx, FastAPI chỉ nằm trong mạng Compose, và host chỉ bind frontend vào `127.0.0.1:8070`. Nginx của VPS dùng `deploy/learning/host-nginx.conf` để phục vụ `https://learning.peebot.shop`. File SQLite nằm ở `/var/lib/polytranslate-learning/learning.sqlite3`, tách khỏi container.

Sau khi đồng bộ source vào `/opt/polytranslate-learning`, tạo `/var/lib/polytranslate-learning` với UID 10001, rồi chạy `docker compose -f deploy/learning/compose.yml up -d --build`. Nếu xuất source bằng `git archive` trên Windows, dùng `git -c core.autocrlf=false archive` để giữ LF cho shell script. Cài backup service/timer trong `deploy/learning/` vào systemd dưới tên `polytranslate-learning-backup.service` và `.timer`. Backup được giữ 14 ngày tại `/var/backups/polytranslate-learning`; chạy `systemctl start polytranslate-learning-backup.service` để kiểm tra ngay. Bản sao này vẫn nằm trên cùng VPS, nên không bảo vệ trước sự cố mất toàn bộ máy.

Để build extension cài thủ công, chạy `npm run build` ở thư mục gốc. Đóng gói nội dung `dist/` thành ZIP hoặc nạp `dist/` vào Chrome. Sau khi cập nhật extension, thử liên kết tài khoản với website thật.

Trước mỗi lần cập nhật backend, tạo backup và kiểm tra `GET /api/health`. Nếu cần quay về bản cũ, triển khai lại source/ảnh Docker trước đó nhưng giữ nguyên volume; nếu schema đã đổi, khôi phục bản SQLite tương ứng từ bản sao đã kiểm tra.

Phạm vi hiện tại: tài khoản, liên kết extension, cây thư mục có thể xổ từng cấp, lưu từ/câu từ tooltip, thêm Từ / cụm từ hoặc Câu trên web, liên kết câu ví dụ, Ngữ pháp và Ghi chú.
