import { el, clear } from '../../ui/dom.js';
import { ocrImage } from '../vision/ocr.js';

// Camera module: capture a frame and run OCR, then optionally ask the
// assistant about the extracted text (per TÀI LIỆU 3: OCR / đọc tài liệu).
export const cameraPlugin = {
  id: 'camera',
  name: 'Camera',
  icon: '📷',
  category: 'plugin',
  description: 'Chụp ảnh, OCR văn bản, rồi hỏi trợ lý.',

  render(ctx) {
    const root = el('div', { class: 'plugin-panel' });
    const video = el('video', { class: 'cam-video', autoplay: true, playsinline: true, muted: true });
    const canvas = el('canvas', { class: 'cam-canvas', style: { display: 'none' } });
    const status = el('div', { class: 'muted small' });
    const ocrOut = el('div', { class: 'ocr-out' });
    let stream = null;

    async function startCam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        video.srcObject = stream;
        status.textContent = 'Camera đang bật.';
      } catch (err) {
        status.textContent = 'Không mở được camera: ' + (err.message || err);
      }
    }
    function stopCam() {
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      status.textContent = 'Đã tắt camera.';
    }
    function capture() {
      if (!video.videoWidth) { status.textContent = 'Chưa có khung hình.'; return; }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.style.display = 'block';
      status.textContent = 'Đã chụp. Bấm OCR để đọc chữ.';
    }
    async function runOcr() {
      if (!canvas.width) { status.textContent = 'Hãy chụp ảnh trước.'; return; }
      clear(ocrOut);
      status.textContent = 'Đang nhận dạng chữ…';
      try {
        const { text, confidence } = await ocrImage(canvas, (p) => { status.textContent = `OCR ${Math.round(p * 100)}%`; });
        status.textContent = `Xong (độ tin cậy ~${Math.round(confidence)}%).`;
        ocrOut.appendChild(el('div', { class: 'ocr-text' }, text || '(không thấy chữ)'));
        if (text) {
          ocrOut.appendChild(el('button', { class: 'btn primary', style: { marginTop: '8px' }, onClick: () => {
            ctx.sendUserMessage(`Đây là văn bản tôi chụp được, hãy giúp tôi:\n\n${text}`);
          } }, '💬 Hỏi trợ lý về văn bản này'));
        }
      } catch (err) {
        status.textContent = 'OCR lỗi: ' + (err.message || err);
      }
    }

    root.appendChild(video);
    root.appendChild(canvas);
    root.appendChild(el('div', { class: 'form-row', style: { marginTop: '8px' } }, [
      el('button', { class: 'btn ghost', onClick: startCam }, '▶️ Bật'),
      el('button', { class: 'btn ghost', onClick: stopCam }, '⏹ Tắt'),
      el('button', { class: 'btn', onClick: capture }, '📸 Chụp'),
      el('button', { class: 'btn primary', onClick: runOcr }, '🔤 OCR')
    ]));
    root.appendChild(status);
    root.appendChild(ocrOut);
    // Best-effort cleanup when the panel is replaced.
    root._cleanup = stopCam;
    return root;
  }
};
