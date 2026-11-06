# Kế hoạch triển khai flashcard nghe và nói trên iPhone

## Phạm vi và ranh giới test đã xác nhận

Người dùng đã duyệt PRD và đồng ý ba ranh giới test:

1. HTTP API với SQLite test thật: chọn từ/câu, kết quả tự đánh giá, tiếp tục buổi và cách ly tài khoản.
2. Giao diện qua thao tác người dùng: chỉ giả lập HTTP và API thiết bị của trình duyệt, không mock module nội bộ trong test mới.
3. Trình duyệt ở kích thước iPhone: lật thẻ, nghe/thu/nghe lại, chuyển nền và tải lại. WebKit mô phỏng không được coi là bằng chứng đã thử phần cứng iPhone thật.

Mỗi lát cắt: viết một test hành vi, chạy đỏ, triển khai tối thiểu, chạy xanh. Giữ các test hồi quy hiện tại, sửa kỳ vọng đã được PRD mới thay thế.

## Các lát cắt

- [x] API: lọc word / sentence / all trong phạm vi thư mục và thống kê kết quả cho câu.
- [x] API: lưu và khôi phục cùng Review Session, vị trí, tùy chọn, thứ tự và kết quả; không nhân đôi thống kê; bảo vệ tài khoản, dữ liệu sai và mục đã xóa.
- [x] UI: tách Nhớ / Chưa nhớ khỏi Lùi / Tiếp, giữ flashcard thường và ô nháp.
- [x] UI: chọn nội dung, chọn cách luyện, tự phát phù hợp và nhớ lựa chọn.
- [x] UI: thu và phát lại bản thu tạm từng thẻ, thay bản cũ, dừng/giải phóng micro khi ẩn/rời trang; xử lý từ chối hoặc lỗi thiết bị.
- [x] UI: tiếp tục bài dở sau tải lại, không khôi phục âm thanh và không ghi trùng kết quả.
- [x] Giao diện iPhone: vùng chạm rõ, thẻ cuộn được, bộ chọn bài thu gọn, nút nghe/thu/đánh giá dễ chạm, không tràn ngang.
- [x] Kiểm chứng tích hợp trên trình duyệt, hồi quy API/web/extension, build.
- [x] Review diff và đối chiếu toàn bộ tiêu chí PRD.
- [x] Commit chỉ thay đổi thuộc tính năng, push nhánh codex/mobile-flashcard-practice.
- [x] Backup production đã kiểm tra, deploy đúng commit, kiểm tra health và luồng thật, ghi bằng chứng phát hành.

## Thiết kế triển khai

- Mở rộng API review hiện tại với tùy chọn flashcard và progress; tiếp tục dùng cùng session id khi resume. Thay đổi SQLite theo kiểu thêm cột để giữ dữ liệu hiện có.
- Chỉ lưu tiến độ và kết quả ở máy chủ; mọi Blob/object URL bản thu nằm trong bộ nhớ trang, không đi qua HTTP hoặc lưu trình duyệt bền vững.
- Dùng Speech Synthesis cho mẫu tiếng Trung phổ thông, không dùng nhầm giọng Quảng Đông. MediaRecorder ưu tiên WebM/Opus khi được hỗ trợ, fallback MP4 cho Safari cũ; kiểm tra trình duyệt đã phát hiện MP4/AAC ở Chromium Windows có thể tạo Blob rỗng dù báo hỗ trợ.
- Kết quả tự đánh giá và vị trí sau đánh giá được ghi cùng giao dịch; điều hướng chỉ lưu vị trí. Hủy/hoàn thành buổi sẽ loại khỏi mục Tiếp tục bài dở.
- Giữ hoạt động Grammar Review hiện tại; phần flashcard bổ sung Sentence và hai cách luyện nghe/nói.
- Bắt đầu buổi mới thay thế buổi dở của cùng hoạt động, vẫn giữ các kết quả đã ghi.

## Phát hành

- Remote: origin, repo patdev495/translation-extention. Nhánh gốc hiện tại: develop.
- Production: learning.peebot.shop, VPS 107.175.144.245, source /opt/polytranslate-learning, Compose deploy/learning/compose.yml.
- SSH đã kiểm tra kết nối bằng key hiện có, không thay đổi xác thực.
- Không đưa file scratch/model và thay đổi Hanzi không liên quan vào commit.
- Trước deploy: ghi nhận image/source đang chạy, backup SQLite bằng công cụ hiện có và kiểm tra backup. Chuẩn bị image cũ để rollback nếu smoke test thất bại.

## Nhật ký TDD và kiểm chứng

- API category: test đỏ vì câu bị loại khỏi flashcard; xanh sau khi hỗ trợ category và thống kê câu.
- API resume: test đỏ ở endpoint progress chưa tồn tại; xanh sau migration thêm cột và lưu/khôi phục cùng session. Test xóa nội dung phát hiện resume còn lộ snapshot; đã thêm kiểm tra nội dung còn hoạt động.
- UI điều hướng: test đỏ vì Tiếp ghi Nhớ; xanh khi chỉ nút đánh giá ghi kết quả.
- UI nội dung/cách luyện: test đỏ vì thiếu bộ chọn; xanh với Word or Phrase / Sentence và giữ ba kiểu mặt trước.
- UI âm thanh: test đỏ vì chưa tự phát; xanh sau khi nối Speech Synthesis và bật/tắt theo chế độ.
- UI thu âm: test đỏ vì thiếu điều khiển; xanh với bản thu theo thẻ, thu lại thay bản cũ và dừng khi ẩn trang.
- UI resume: test đỏ vì thiếu Tiếp tục bài dở; xanh khi giữ vị trí/thứ tự/kết quả và bỏ âm thanh sau mở lại.
- Browser layout: test đỏ vì chưa có thiết lập thu gọn; xanh trên WebKit mô phỏng iPhone với vùng chạm >=44px và không tràn ngang.
- Review mạng lỗi: test đỏ vì tạo buổi mới thất bại làm mất bản thu; xanh khi chỉ xóa sau khi tạo buổi mới thành công.
- Review giọng đọc: test đỏ vì giọng zh-HK bị dùng cho mẫu Mandarin; xanh khi chỉ chọn giọng phổ thông phù hợp.
- Hồi quy trước sửa lỗi bàn phím cuối: 44 API tests, 52 web tests, 153 extension tests đều xanh. Extension packaging tests chạy tuần tự, chỉ trong tests/ để tránh gom web hoặc worktree khác.
- Browser: 6 tests qua trên WebKit ở kích thước iPhone và Chromium ở kích thước điện thoại, gồm nội dung dài, thu/nghe theo thẻ, chuyển nền, mở lại và kết thúc buổi. Thu/encode/playback native chạy trên Chromium; WebKit Windows dùng double tại ranh giới thiết bị.
- Review bàn phím: test đỏ vì Space trên nút thu âm đồng thời chuyển thẻ; xử lý shortcut được giới hạn ngoài các điều khiển tương tác.
- Kiểm chứng cuối sau sửa bàn phím: 53 web tests và 6 browser tests qua; web build kèm vue-tsc qua; TypeScript của extension qua. API 44 tests và extension 153 tests đã qua, không có thay đổi source API/extension sau các lượt đó.
- Code commit 9e8a0180cfd121595d8c22507a93f34ef4bf5275 đã push và deploy lên learning.peebot.shop. Backup SQLite quick_check qua trước triển khai; giữ image/source trước phát hành để rollback.
- Production smoke qua trên HTTPS với tài khoản kiểm thử riêng: Word or Phrase và Sentence, đánh giá, thu/encode/phát native bằng micro giả trình duyệt, resume sau tải lại, kết thúc buổi. Đã xóa đúng tài khoản kiểm thử cùng dữ liệu thuộc tài khoản đó.
- Hash hai file backend trong container khớp commit; JS/CSS production khớp từng byte với bản build local đã chạy browser tests. Xem RELEASE.md.
- Kiểm tra media native dùng Chromium với thiết bị micro giả của trình duyệt. WebKit Windows dùng double tại seam thiết bị do không có MediaRecorder/mediaDevices/AudioContext; không tuyên bố đã thử phần cứng iPhone thật.
