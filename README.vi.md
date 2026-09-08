# Udemy Dual Subtitle Translator

[English](README.md) · **Tiếng Việt**

Extension Chrome hiện **caption gốc + bản dịch** trên bài giảng Udemy — kể cả ngôn ngữ mà khóa học không có.

Miễn phí, không chính thức, không liên kết với Udemy.

## Tính năng

- Caption kép (gốc + đích) hoặc chỉ ngôn ngữ đích
- Dịch sang ngôn ngữ mà course không cung cấp
- Tải file SRT / VTT của bạn
- Chỉnh font, cỡ chữ và độ mờ nền caption

## Cài đặt (unpacked)

1. Tải hoặc clone thư mục này.
2. Mở `chrome://extensions`.
3. Bật **Developer mode**.
4. Bấm **Load unpacked** và chọn folder project (thư mục có `manifest.json`).
5. Mở một bài giảng Udemy và dùng nút **DualSub** trên player.

Sau khi cập nhật code: reload extension, rồi hard-refresh trang lecture.

## Yêu cầu

- Chrome (Manifest V3)
- Đã đăng nhập Udemy và có quyền xem lecture
- Lecture có caption nguồn (ưu tiên English)

Nội dung caption được gửi tới endpoint dịch công khai của Google để tạo ngôn ngữ đích. Đừng dùng nếu điều đó không phù hợp với khóa học hoặc tổ chức của bạn.

## Yêu cầu thêm ngôn ngữ

Cần ngôn ngữ đích chưa có trong danh sách?  
**[Tạo issue yêu cầu ngôn ngữ](issues/new?template=language-request.yml)** — GitHub mở sẵn form cho bạn.

## Tuyên bố miễn trừ

Dự án dành cho việc học cá nhân, không thương mại. **Không** liên kết, được chứng nhận hay được hỗ trợ bởi Udemy, Inc.

Việc sử dụng có thể xung đột với điều khoản dịch vụ của Udemy. Bạn tự chịu trách nhiệm khi dùng. Phần mềm được cung cấp **nguyên trạng**, không bảo hành.

## Giấy phép

[MIT](LICENSE)
