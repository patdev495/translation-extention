# Thêm mục học tập thủ công trên web — bản nháp

## Mục tiêu

Người học thêm Từ / cụm từ, Câu, Ngữ pháp, hoặc Ghi chú vào một thư mục trong Learning Library trên web. Từ, Câu và Ngữ pháp có thể liên kết để học theo ngữ cảnh; Ghi chú là mục độc lập. Tính năng ôn tập theo thư mục sẽ được thiết kế sau.

## Thư mục và điểm vào

- Khi mở thư viện, sidebar trái chỉ hiện các thư mục gốc. Bấm một thư mục sẽ chọn thư mục đó và xổ danh sách thư mục con trực tiếp ngay bên dưới; có thể tiếp tục xổ các cấp sâu hơn khi bấm thư mục con.
- Menu chuột phải của từng thư mục có hành động **Thêm**, với bốn loại mục: Từ / cụm từ, Câu, Ngữ pháp, Ghi chú. Nút menu hiện có của thư mục cần đưa tới cùng hành động.
- Mỗi mục thuộc trực tiếp đúng một thư mục. Liên kết tới mục trong thư mục khác không thay đổi thư mục của mục nào.
- Một thư mục có thể chứa cả thư mục con và mục học tập. Khi xem thư mục, hiện lưới thư mục con ở trên và các mục trực tiếp thuộc cả bốn loại ở dưới. Thư mục lá hiện danh sách mục.
- Chưa chốt cách chọn thẻ cho chế độ ôn tập; không suy ra từ liên kết hay cách hiển thị thư mục.

## Bốn loại mục

- **Từ / cụm từ:** cần text tiếng Trung và nghĩa đã được người học kiểm tra. Có thể gợi ý nghĩa và sửa trước khi lưu. Có thể thêm nhiều câu ngữ cảnh, chọn câu đã lưu hoặc nhập câu mới.
- **Câu:** cần text và nghĩa đã được người học kiểm tra. Có thể đứng độc lập hoặc liên kết với nhiều từ/cụm từ và ngữ pháp đã lưu, gồm cả mục ở thư mục khác.
- **Ngữ pháp:** cần cấu trúc và mô tả. Cấu trúc là ghi chú tự do, có thể trộn tiếng Trung và tiếng Việt; không tạo hoặc hiển thị Pinyin cho cấu trúc. Câu ví dụ không bắt buộc khi tạo; có thể thêm nhiều câu sau đó, chọn câu đã lưu hoặc nhập câu mới.
- **Ghi chú:** cần tiêu đề và nội dung ghi chú dạng văn bản nhiều dòng thông thường, không có định dạng Markdown. Thuộc một thư mục như các mục khác, không liên kết với Từ / cụm từ, Câu hoặc Ngữ pháp.
- Mỗi câu ngữ cảnh/ví dụ là một mục Câu độc lập, có text và nghĩa; cùng một câu có thể phục vụ nhiều từ/cụm từ và ngữ pháp.

## Liên kết và chỉnh sửa

- Người học có thể thêm hoặc gỡ liên kết từ màn hình sửa của câu, từ/cụm từ, và ngữ pháp. Gỡ liên kết không xóa mục.
- Liên kết thủ công trên web không đòi text của từ/cụm từ xuất hiện nguyên văn trong câu. Luồng lưu cả từ và câu từ extension tiếp tục kiểm tra chữ được chọn nằm trong câu.
- Chỉ cho đổi loại giữa Từ / cụm từ, Câu và Ngữ pháp khi mục chưa có liên kết. Cần gỡ liên kết trước khi đổi loại. Ghi chú không thể đổi sang ba loại kia hoặc ngược lại; người học vẫn có thể sửa tiêu đề, nội dung và thư mục của Ghi chú.
- Câu mới nhập trong form từ/cụm từ hoặc ngữ pháp thuộc trực tiếp cùng thư mục với mục chính. Câu đã lưu ở thư mục khác giữ nguyên vị trí khi được chọn làm ví dụ.

## Lưu và trùng lặp

- Các câu nhập hoặc chọn liên tiếp trong form mục chính nằm trong bản nháp. Chỉ lưu mục chính, câu mới và các liên kết khi người học bấm Lưu cuối cùng; hủy form hoặc lỗi tạo mục chính không để lại câu ví dụ mới.
- Trong cùng thư mục, Từ / cụm từ, Câu hoặc Ngữ pháp cùng loại và trùng toàn bộ text được báo trùng. Với Ngữ pháp, so toàn bộ text cấu trúc, không xét mô tả hoặc ví dụ. Ghi chú không kiểm tra trùng tiêu đề hay nội dung.
- Ngoại lệ: câu ví dụ nhập trong form mà đã có cùng text trong cùng thư mục được dùng lại để liên kết. Giữ nghĩa đã lưu và hiện nó cho người học kiểm tra; không tự ghi đè.
- Text giống nhau ở hai thư mục khác nhau là hai mục riêng. Nhập câu mới ở thư mục A không tự dùng lại câu giống text ở B; muốn dùng câu ở B thì chọn câu đã lưu.

## Tương thích hiện tại

- Extension vẫn lưu Từ / cụm từ và Câu như hiện nay; Ngữ pháp và Ghi chú là các loại mới trên web.
- Dữ liệu hiện có cho phép một thư mục chứa cả mục và thư mục con, câu đứng độc lập, và một câu liên kết nhiều từ. Thiết kế này giữ các khả năng đó.
