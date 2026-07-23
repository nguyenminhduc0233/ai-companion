import { el, clear } from '../../ui/dom.js';
import { readDocument, SUPPORTED_DOC_TYPES } from '../documents/doc-reader.js';

// Document Q&A: attach a PDF/DOCX/TXT; the assistant then answers grounded in
// its content (and says so when the answer isn't in the document).
export const pdfPlugin = {
  id: 'document',
  name: 'Tài liệu',
  icon: '📄',
  category: 'plugin',
  description: 'Đính kèm PDF/DOCX/TXT và hỏi đáp theo nội dung.',

  render(ctx) {
    const root = el('div', { class: 'plugin-panel' });
    const info = el('div', { class: 'doc-info' });
    const fileInput = el('input', { class: 'field', type: 'file', accept: SUPPORTED_DOC_TYPES });
    const question = el('input', { class: 'field', type: 'text', placeholder: 'Hỏi về tài liệu…' });

    function renderInfo() {
      clear(info);
      const doc = ctx.assistant.document;
      if (!doc) { info.appendChild(el('div', { class: 'muted' }, 'Chưa đính kèm tài liệu.')); return; }
      info.appendChild(el('div', { class: 'row-card' }, [
        el('div', {}, [
          el('div', { class: 'row-title' }, `${doc.name}`),
          el('div', { class: 'muted small' }, `${doc.text.length.toLocaleString('vi-VN')} ký tự`)
        ]),
        el('button', { class: 'btn ghost', onClick: () => { ctx.assistant.clearDocument(); renderInfo(); ctx.toast('Đã bỏ tài liệu.', 'ok'); } }, 'Bỏ')
      ]));
      info.appendChild(el('div', { class: 'doc-snippet' }, doc.text.slice(0, 400) + (doc.text.length > 400 ? '…' : '')));
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      clear(info); info.appendChild(el('div', { class: 'muted' }, 'Đang đọc tài liệu…'));
      try {
        const doc = await readDocument(file);
        ctx.assistant.setDocument({ name: doc.name, text: doc.text });
        renderInfo();
        ctx.toast(`Đã nạp ${doc.name}.`, 'ok');
      } catch (err) {
        clear(info); info.appendChild(el('div', { class: 'error' }, 'Không đọc được: ' + (err.message || err)));
      }
    });

    function ask() {
      const q = question.value.trim();
      if (!q) return;
      if (!ctx.assistant.document) { ctx.toast('Hãy đính kèm tài liệu trước.', 'warn'); return; }
      question.value = '';
      ctx.sendUserMessage(q);
    }
    question.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });

    root.appendChild(el('div', { class: 'form-row' }, [fileInput]));
    root.appendChild(info);
    root.appendChild(el('div', { class: 'form-row', style: { marginTop: '8px' } }, [
      question, el('button', { class: 'btn primary', onClick: ask }, 'Hỏi')
    ]));
    renderInfo();
    return root;
  }
};
