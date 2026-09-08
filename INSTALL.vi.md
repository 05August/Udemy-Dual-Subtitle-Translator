# Cài DualSub (không cần biết GitHub)

[English](INSTALL.md) · **Tiếng Việt**

Bạn **không** cần Git, tài khoản GitHub, hay Chrome Web Store. Chỉ tải file zip rồi nạp vào Chrome.

## 1. Tải extension

1. Mở trang project: [Udemy-Dual-Subtitle-Translator](https://github.com/05August/Udemy-Dual-Subtitle-Translator).
2. Bấm nút xanh **Code**.
3. Bấm **Download ZIP**.

Tải thẳng: [Download ZIP](https://github.com/05August/Udemy-Dual-Subtitle-Translator/archive/refs/heads/main.zip)

## 2. Giải nén folder

1. Tìm file `Udemy-Dual-Subtitle-Translator-main.zip` trong Downloads.
2. Bấm đúp để giải nén (hoặc chuột phải → Extract).
3. Sẽ có folder tên `Udemy-Dual-Subtitle-Translator-main`.
4. Mở folder đó. Bên trong **phải thấy** file `manifest.json`.  
   Nếu chỉ thấy thêm một folder cùng tên, hãy mở folder bên trong.

Giữ folder này. Đừng xóa sau khi cài. Chrome đọc file từ đây.

## 3. Nạp vào Chrome

1. Mở Chrome, gõ `chrome://extensions` vào thanh địa chỉ rồi Enter.
2. Bật **Developer mode** (góc trên bên phải).
3. Bấm **Load unpacked**.
4. Chọn đúng folder có `manifest.json` (folder ở bước 2).
5. DualSub hiện trong danh sách. Có thể ghim icon bằng nút mảnh ghép trên thanh công cụ Chrome.

## 4. Dùng trên Udemy

1. Đăng nhập Udemy và mở một **bài giảng video** (không chỉ trang khóa học).
2. Tìm nút **DualSub** trên player.
3. Bật **On**, chọn ngôn ngữ đích, chọn Dual hoặc Target only.

Nếu không thấy caption: hard-refresh lecture (`Ctrl+Shift+R` / `Cmd+Shift+R`). Lecture phải có caption nguồn (ưu tiên English).

## Cập nhật sau này

1. Tải ZIP mới từ cùng trang.
2. Giải nén đè folder cũ, **hoặc** giải nén ra folder mới.
3. Vào `chrome://extensions` rồi bấm **Reload** trên DualSub.  
   Nếu đã đổi chỗ folder, bấm **Load unpacked** lại và chọn folder mới.
4. Hard-refresh trang lecture Udemy.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| “Manifest file is missing or unreadable” | Chọn nhầm folder. Phải chọn folder **trực tiếp** chứa `manifest.json`. |
| Không thấy nút DualSub trên video | Chưa vào URL lecture, hoặc cần hard-refresh sau khi nạp extension. |
| Không có caption | Lecture không có caption gốc. Tải SRT/VTT trong panel DualSub, hoặc thử bài khác. |
| Mất extension sau khi tắt máy | Chrome vẫn cần folder trên đĩa. Đừng xóa hoặc chuyển folder. |

Không cần “clone”, “fork”, hay “commit” gì để dùng DualSub.
