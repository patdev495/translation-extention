# Flashcard nghe và nói trên iPhone

Ngày: 2026-11-06

Trạng thái: Đã được người dùng duyệt và yêu cầu lập kế hoạch, triển khai theo TDD, commit, push và deploy production ngày 2026-11-06. Các mặc định thiết kế dưới đây được dùng cho bản đầu.

## Mục tiêu

Tối ưu flashcard hiện tại để người học thuận tiện luyện trên iPhone bằng nội dung đã lưu trong Learning Library. Người dùng có thể dành 30 phút mỗi ngày và muốn cải thiện nghe nhận ra từ, tự tạo câu trả lời và phát âm/thanh điệu.

30 phút là khả năng dành thời gian của người dùng, không phải thời lượng bắt buộc hoặc điều kiện hoàn thành buổi luyện. Nghe mẫu và tự nghe lại bản thu tạo cơ hội luyện tập; kết quả Nhớ / Chưa nhớ là tự đánh giá, không phải phép đo chính xác năng lực giao tiếp hoặc chất lượng phát âm.

## Yêu cầu đã chốt

### Nội dung và hình thức

- Giữ flashcard làm hình thức chính, tối ưu cho màn hình và thao tác chạm trên iPhone.
- Dùng các mục đã lưu trong Learning Library, gồm Word or Phrase và Sentence.
- Có bộ lọc Từ/cụm, Câu hoặc Cả hai.
- Hai cách luyện nghe/nói là lựa chọn bổ sung trên flashcard. Người học chọn riêng từng cách, web nhớ lựa chọn gần nhất; không bắt hoàn thành cả hai trong một buổi.
- Bản đầu dùng online.

### Nghe và nói theo

- Nghe mẫu trước khi mở chữ/Pinyin.
- Người học có thể mở chữ/Pinyin khi cần, thu âm nói lại và nghe đối chiếu.
- Khi sang thẻ, tự phát mẫu nếu tự phát đang bật. Có nút bật/tắt và nhớ lựa chọn.

### Nhìn nghĩa và tự nói

- Ban đầu hiện nghĩa tiếng Việt để người học thử nói tiếng Trung trước khi xem câu gốc.
- Cho thu âm trước khi mở đáp án, sau đó nghe mẫu và bản thu để tự đối chiếu.
- Mẫu chỉ phát khi người học chủ động bấm, không tự phát khi sang thẻ.
- Câu gốc là mẫu tham khảo; không coi mọi cách diễn đạt khác là sai.

### Tự đánh giá và điều hướng

- Nhớ / Chưa nhớ ghi kết quả rồi sang thẻ tiếp.
- Lùi / Tiếp chỉ chuyển thẻ, không tạo hoặc thay đổi kết quả.
- Mục chưa được tự đánh giá không có kết quả.
- Quy tắc trên thay thế hành vi Tiếp mặc định Đã nhớ của flashcard trong PRD ôn tập trước đây. Xem `.scratch/learning-review/PRD.md` để biết hành vi hiện tại.

### Bản thu tạm

- Bản thu chỉ giữ trong bộ nhớ trang để nghe lại; không lưu bền vững và không tải lên máy chủ.
- Mỗi thẻ có tối đa một bản thu mới nhất trong buổi. Thu lại thì thay bản cũ; quay lại thẻ vẫn nghe được bản thu tương ứng.
- Chuyển app hoặc khóa màn hình: dừng thu, giữ các bản thu tạm nếu trang vẫn còn nguyên. Không bảo đảm giữ được khi iOS hủy hoặc tải lại trang ở nền.
- Kết thúc luyện hoặc rời/đóng/tải lại trang: xóa toàn bộ bản thu.
- Bản thu không phải Saved Learning Item.

### Tiếp tục bài dở

- Khi mở lại web, có Tiếp tục bài dở và lựa chọn bắt đầu buổi mới.
- Tiếp tục đúng vị trí, thứ tự thẻ và kết quả đã đánh dấu của cùng buổi.
- Không khôi phục bản thu sau khi rời hoặc tải lại web.
- Khôi phục buổi cũ không được tạo một buổi mới làm tăng số lần tự đánh giá đã lưu.

## Mặc định thiết kế đề xuất để xem lại

- Giữ flashcard thường và ba lựa chọn mặt trước hiện tại: nghĩa tiếng Việt, chữ Trung, Pinyin.
- Chọn thư mục hoặc toàn bộ thư viện theo cách chọn phạm vi ôn hiện tại; phần chọn bài thu gọn trong lúc luyện.
- Thẻ nằm giữa màn hình, chạm để lật. Thanh Nghe mẫu / Thu âm hoặc Dừng / Nghe bản thu nằm ngoài vùng chạm lật thẻ; điều hướng và đánh giá nằm ở vùng dễ chạm phía dưới.
- Thu âm bằng chạm bắt đầu, chạm dừng. Bắt đầu thu thì dừng tiếng mẫu; chuyển thẻ thì dừng âm thanh của thẻ trước.
- Giữ ô nháp hiện tại dưới phần có thể thu gọn, tránh tự bật bàn phím khi mở thẻ.
- Bản đầu phát âm thanh của đúng mục đang luyện; có thể mở rộng nghe Example Sentence sau. Mục thiếu nghĩa không dùng cho Nhìn nghĩa và tự nói; chỉ rõ lý do thay vì tự tạo nghĩa.
- Nội dung dài có vùng cuộn riêng, vẫn tiếp cận được các nút điều khiển.
- Ưu tiên kiểm chứng Safari trên iPhone. Nếu trình duyệt chặn tự phát, hiện nút Nghe mẫu để tiếp tục; thiếu giọng đọc phù hợp hoặc không được cấp micro thì thông báo tại điều khiển tương ứng, vẫn dùng được flashcard.
- Khi tiếp tục buổi dở, chỉ bắt đầu âm thanh sau thao tác chủ động của người học.

## Các đề xuất chưa đưa vào phạm vi đã chốt

- Cài PWA lên màn hình chính, lịch ôn cách quãng, tự chấm phát âm, bài hội thoại theo chủ đề và tải bài offline chưa được người dùng chọn cho bản đầu này.
- Nhu cầu nghe khi khóa màn hình và nhà cung cấp/giọng đọc mẫu cần được xác định nếu triển khai các khả năng này.

## Tình huống nghiệm thu

1. Mở bài trên iPhone, chọn Từ/cụm, Câu hoặc Cả hai; lật thẻ và bấm các nút âm thanh mà không vô tình kích hoạt thao tác khác.
2. Chế độ nghe tự phát theo lựa chọn đã nhớ; chế độ nhìn nghĩa không tự đọc đáp án.
3. Thu ở thẻ 1, sang thẻ 2 rồi quay lại thẻ 1: nghe được bản thu thẻ 1. Thu lại thẻ 1 thì nghe bản mới.
4. Đang thu rồi chuyển app: micro dừng. Quay lại trang còn nguyên thì nghe được phần đã thu thành công; không tự thu tiếp.
5. Lùi / Tiếp qua thẻ chưa đánh giá không ghi Nhớ; bấm Nhớ / Chưa nhớ thì ghi kết quả và sang thẻ kế.
6. Đóng hoặc tải lại web rồi Tiếp tục bài dở: đúng vị trí, thứ tự và kết quả, không còn bản thu và không ghi trùng kết quả.
7. Bắt đầu buổi mới hoặc kết thúc luyện: không còn bản thu của buổi trước.
8. Kiểm tra luồng từ chối micro, lỗi phát mẫu và mất mạng mà không làm mất các kết quả đã lưu thành công.
