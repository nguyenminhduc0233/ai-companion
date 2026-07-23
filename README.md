# 🧝‍♀️ AI Companion

> Trợ lý cá nhân với **avatar 3D** — một lõi web dùng chung, đóng gói song song thành **APK (Android)** và **EXE (Windows)**.

Xây dựng theo 3 tài liệu thiết kế: **System Prompt (Brain)**, **Character Bible** và **Product Specification**.

![CI](https://github.com/OWNER/ai-companion/actions/workflows/build.yml/badge.svg)

---

## ✨ Tính năng

| Nhóm | Chi tiết |
|------|----------|
| 🔌 **AI Gateway phổ quát** | Nhập **API key của bất kỳ model chat nào**. Preset sẵn: OpenAI, Google Gemini, Anthropic Claude, DeepSeek, OpenRouter — cộng chế độ **Custom** (tự nhập Base URL + model) tương thích mọi endpoint OpenAI-compatible. |
| 📊 **Theo dõi token** | Sau **mỗi lần gọi API** hiển thị token đã dùng (prompt/trả lời/tổng), tổng phiên, tổng tích lũy, và **số còn lại** theo ngân sách bạn đặt — hoặc **số dư/tín dụng thật** với nhà cung cấp có hỗ trợ (OpenRouter, DeepSeek). |
| 👤 **Avatar** | Mặc định là **chân dung 2D sống động** dùng CHÍNH ảnh nhân vật bạn cung cấp + các biểu cảm do AI tạo từ ảnh gốc (giữ nguyên nhân vật): chớp mắt, thở, trôi nhẹ, đổi biểu cảm mượt, hào quang tím, hiệu ứng khi nói. Kèm 2 chế độ tuỳ chọn: **3D dựng sẵn** (Three.js) và **VRM** (nạp file `.vrm`). |
| 🗣️ **Giọng nói** | Speech-to-Text + Text-to-Speech (Web Speech API). Chọn chế độ **Voice / Text / Cả hai**. |
| 🧰 **Chức năng cục bộ (không cần AI)** | Ghi chú, Lịch, Nhắc việc, Báo thức, Hẹn giờ, Bấm giờ, Thông báo. |
| 📄 **Đọc tài liệu** | Hỏi đáp dựa trên nội dung **PDF / DOCX / TXT**. |
| 📷 **Camera + OCR** | Chụp ảnh, nhận dạng chữ (Tesseract), rồi hỏi trợ lý. |
| 🧩 **Plugin Manager** | Calendar, Document, Camera, Weather, Email*, Browser*, Chat — kèm điểm mở rộng rõ ràng. |
| 🧠 **Bộ nhớ** | Lưu cục bộ; **AI memory chỉ khi được phép**, không bao giờ lưu mật khẩu/OTP/thông tin nhạy cảm. |
| ⚠️ **An toàn** | Thao tác nguy hiểm (gửi email, xoá, thanh toán, đăng bài) luôn hỏi xác nhận. |

\* *Email và Browser là bản mẫu có điểm mở rộng sẵn.*

---

## 🏗️ Kiến trúc

```
3D Avatar  →  Animation Engine  →  Assistant Core  →  Plugin Manager  →  Local Functions  →  AI Gateway
```

Một **lõi web** duy nhất chứa toàn bộ logic + giao diện, được bọc hai lần:

```
        ┌──────────────────────────┐
        │   Shared Web Core (src)  │   ← Vite build → dist/
        └───────────┬──────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  Capacitor + Android      Electron
     → app-debug.apk         → AI-Companion-portable.exe
```

---

## 🚀 Chạy thử (dev)

```bash
npm install        # tự tải các frame avatar về public/avatar/ (postinstall) + tạo icon
npm run dev        # mở http://localhost:5173
```

> Ảnh nhân vật được tải tự động khi `npm install` (script `scripts/fetch-assets.mjs`). Muốn dùng nhân vật khác: chạy `npm run fetch:assets` sau khi đổi URL trong script, hoặc thả ảnh của bạn vào `public/avatar/` (normal.png, happy.jpg, thinking.jpg, surprise.jpg, sympathy.jpg, celebrate.jpg, blink.jpg).

Mở **⚙️ Cài đặt → AI Gateway**, chọn nhà cung cấp, dán API key, chọn model → bắt đầu trò chuyện.

---

## 📦 Build APK (Android)

**Yêu cầu:** Node 18+, **JDK 17**, **Android SDK** (biến môi trường `ANDROID_HOME`).

```bash
npm run build            # build lõi web
npx cap add android      # lần đầu: tạo project Android
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Hoặc dùng script gọn:

```bash
bash scripts/build-android.sh
```

---

## 🪟 Build EXE (Windows)

**Trên Windows** (đơn giản nhất):

```bash
npm run dist:win
# → release/AI-Companion-1.0.0-portable.exe
```

**Trên Linux/macOS:** `electron-builder` cần **wine** để đóng gói file Windows. Cài wine rồi chạy `bash scripts/build-windows.sh`. Nếu không có wine, hãy dùng CI bên dưới hoặc build trên máy Windows.

---

## 🤖 GitHub Actions — build tự động cả APK & EXE

Repo có sẵn `.github/workflows/build.yml`. Khi **push lên `main`** (hoặc tạo tag `v*`), CI sẽ:

- Build **APK** trên Ubuntu (tự cài JDK 17 + Android SDK).
- Build **EXE** trên Windows.
- Tải lên **Artifacts** (và đính kèm Release nếu là tag).

> Đây là cách **đảm bảo** nhất để có cả hai file cài đặt mà không phụ thuộc máy cá nhân.

---

## 🗂️ Cấu trúc thư mục

```
ai-companion/
├─ index.html
├─ vite.config.mjs
├─ capacitor.config.json        # cấu hình Android
├─ electron/                    # tiến trình chính Windows (main/preload)
├─ src/
│  ├─ main.js                   # ghép mọi thứ
│  ├─ avatar/                   # avatar-3d.js, animation-engine.js
│  ├─ core/
│  │  ├─ assistant-core.js
│  │  ├─ system-prompt.js       # Tài liệu 1 + 2
│  │  ├─ ai-gateway/            # providers, gateway, token-tracker
│  │  ├─ local/                 # store + 7 chức năng cục bộ
│  │  ├─ memory/                # settings + AI memory
│  │  ├─ documents/  vision/  voice/
│  │  └─ plugins/               # plugin-manager + plugins
│  ├─ ui/                       # chat, tools, settings, dom, markdown
│  └─ styles/main.css
├─ scripts/                     # build-android.sh, build-windows.sh, gen-icon.cjs
└─ .github/workflows/build.yml  # CI: APK + EXE
```

---

## 🔐 Ghi chú & giới hạn

- Đây là **bản mẫu chạy được (MVP)** của một sản phẩm lớn; Email/Browser là stub có điểm mở rộng.
- **API key lưu cục bộ** trên máy (localStorage), chỉ gửi tới nhà cung cấp bạn chọn — không gửi đi đâu khác.
- **"Token còn lại"** chính xác tuyệt đối chỉ khi nhà cung cấp cung cấp endpoint số dư; nếu không, đó là bộ đếm theo **ngân sách** bạn tự đặt.
- APK xuất ra là bản **debug (chưa ký)**; EXE là bản **portable** — phù hợp để thử nghiệm.
- Avatar mặc định (2D) dùng ảnh trong `public/avatar/` — thay ảnh của bạn vào đó để đổi nhân vật. Muốn 3D đầy đủ: chọn chế độ VRM và nạp file `.vrm` trong ⚙️ Cài đặt → Avatar.

---

## 👤 Nhân vật 3D — chèn model của bạn

Mặc định app dùng **nhân vật 3D tạm** (dựng bằng code) làm placeholder. Bạn có thể thay bằng model 3D tự thiết kế:

**Cách chèn:** mở **⚙️ Cài đặt → Nhân vật → Nhập file nhân vật 3D (.vrm / .glb)** (file được lưu cục bộ bằng IndexedDB), hoặc dán **URL model 3D**. Chọn kiểu hiển thị *"Nhân vật 3D của bạn"* rồi bấm **Lưu**.

**Yêu cầu file để chạy đúng (đầy đủ hoạt ảnh + biểu cảm):**

| Hạng mục | Yêu cầu |
|---|---|
| **Định dạng** | **VRM 1.0** (khuyến nghị) hoặc VRM 0.x. GLB/glTF cũng nạp được nhưng **hiển thị tĩnh** (không biểu cảm). |
| **Rig (xương)** | Humanoid chuẩn: hips, spine, chest, neck, head, (upper/lower) arms, hands, (upper/lower) legs. |
| **Biểu cảm (BlendShape/Expression)** | `happy`, `angry`, `sad`, `relaxed`, `surprised`, `neutral`; khẩu hình `aa`, `ih`, `ou`, `ee`, `oh`; `blink`; hướng nhìn `lookUp/Down/Left/Right`. |
| **Tư thế & toạ độ** | T-pose; mặt hướng **+Z**; đứng ở gốc toạ độ (chân ~ y=0); cao ~**1.5 m**; đơn vị **mét**. |
| **Tối ưu** | ≤ ~**50k** tam giác; **1–4** texture ≤ **2048px**; dung lượng ≤ ~**30 MB**. |
| **Công cụ tạo** | **VRoid Studio** (xuất .vrm trực tiếp), **Blender + VRM add-on**, hoặc **Ready Player Me**. |

> App dùng thư viện **three-vrm**; tên các BlendShape ở trên là chuẩn VRM để avatar tự động cười/nói/chớp mắt/nhìn theo trạng thái hội thoại.

## 🔑 Nhập API key ở đâu?

Trong app: **⚙️ Cài đặt → AI Gateway** — chọn nhà cung cấp, dán **API key**, chọn **model** (và Base URL nếu dùng Custom). Key lưu cục bộ trên máy. *(Trang preview cũng có nút ⚙️ minh hoạ đúng vị trí này.)*

## 📜 License

MIT — xem [LICENSE](./LICENSE).
