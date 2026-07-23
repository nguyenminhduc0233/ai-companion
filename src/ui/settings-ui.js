// Settings modal — AI Gateway (any model), persona, I/O mode, voice, memory
// permission, avatar (VRM), and token budget.
import { el, clear } from './dom.js';
import { toast } from './confirm.js';
import { PROVIDER_LIST, getProvider } from '../core/ai-gateway/providers.js';
import { idbSet, idbDel } from '../core/local/idb.js';

function field(label, control, hint) {
  return el('div', { class: 'set-field' }, [
    el('label', { class: 'set-label' }, label),
    control,
    hint ? el('div', { class: 'muted small' }, hint) : null
  ]);
}

export function openSettings({ settings, gateway, tokenTracker, tts, memory, onChanged }) {
  const s = settings.all();
  const overlay = el('div', { class: 'modal-overlay' });
  const body = el('div', { class: 'modal settings' });

  // ---- AI Gateway ----
  const providerSel = el('select', { class: 'field' },
    PROVIDER_LIST.map((p) => el('option', { value: p.id, selected: p.id === s.providerId }, p.label)));
  const apiKey = el('input', { class: 'field', type: 'password', value: s.apiKey || '', placeholder: 'Dán API key…' });
  const showKey = el('button', { class: 'btn ghost small', onClick: () => { apiKey.type = apiKey.type === 'password' ? 'text' : 'password'; } }, '👁');
  const modelList = el('datalist', { id: 'model-list' });
  const model = el('input', { class: 'field', list: 'model-list', value: s.model || '', placeholder: 'Tên model…' });
  const baseUrl = el('input', { class: 'field', type: 'text', value: s.baseUrl || '', placeholder: 'Base URL (tuỳ chọn / bắt buộc cho Custom)' });
  const temp = el('input', { class: 'field', type: 'number', min: '0', max: '2', step: '0.1', value: s.temperature });
  const maxTok = el('input', { class: 'field', type: 'number', min: '64', max: '32000', step: '64', value: s.maxTokens });
  const testStatus = el('div', { class: 'muted small' });
  const balanceOut = el('div', { class: 'muted small' });

  function syncProviderMeta(resetModel) {
    const p = getProvider(providerSel.value);
    clear(modelList);
    (p.models || []).forEach((m) => modelList.appendChild(el('option', { value: m })));
    model.placeholder = p.defaultModel || 'Tên model…';
    baseUrl.placeholder = p.requiresBaseUrl ? 'Base URL (bắt buộc)' : `Base URL (mặc định: ${p.defaultBaseUrl || '—'})`;
    if (resetModel) { model.value = p.defaultModel || ''; baseUrl.value = p.requiresBaseUrl ? '' : ''; }
  }
  providerSel.addEventListener('change', () => { syncProviderMeta(true); });
  syncProviderMeta(false);

  const testBtn = el('button', { class: 'btn', onClick: async () => {
    persist();
    testStatus.textContent = 'Đang kiểm tra…';
    const r = await gateway.testConnection();
    testStatus.textContent = r.ok ? `✅ OK — "${(r.content || '').slice(0, 40)}"` : `❌ ${r.error}`;
    gateway.refreshBalance().then((b) => { if (b) balanceOut.textContent = `${b.text}`; });
  } }, 'Kiểm tra kết nối');

  const balanceBtn = el('button', { class: 'btn ghost', onClick: async () => {
    persist();
    balanceOut.textContent = 'Đang tải số dư…';
    const b = await gateway.refreshBalance();
    balanceOut.textContent = b ? `${b.text}` : 'Nhà cung cấp này không cung cấp số dư qua API.';
  } }, 'Xem số dư / tín dụng');

  // ---- Persona ----
  const nameInput = el('input', { class: 'field', type: 'text', value: s.assistantName, placeholder: 'Tên trợ lý' });
  const genderInput = el('input', { class: 'field', type: 'text', value: s.gender, placeholder: 'Giới tính (tuỳ chọn)' });

  // ---- I/O ----
  const modeSel = el('select', { class: 'field' }, [
    el('option', { value: 'text', selected: s.mode === 'text' }, 'Text'),
    el('option', { value: 'voice', selected: s.mode === 'voice' }, 'Voice'),
    el('option', { value: 'both', selected: s.mode === 'both' }, 'Cả hai')
  ]);
  const ttsChk = el('input', { type: 'checkbox' }); ttsChk.checked = !!s.ttsEnabled;
  const sttLang = el('input', { class: 'field', type: 'text', value: s.sttLang, placeholder: 'vi-VN' });
  const voiceSel = el('select', { class: 'field' }, [el('option', { value: '' }, '(giọng mặc định)')]);
  (tts.listVoices() || []).forEach((v) => voiceSel.appendChild(el('option', { value: v.name, selected: v.name === s.voiceName }, `${v.name} — ${v.lang}`)));

  // ---- Memory ----
  const memChk = el('input', { type: 'checkbox' }); memChk.checked = !!s.memoryAllowed;
  const memList = el('div', { class: 'mem-list' });
  function renderMem() {
    clear(memList);
    const items = memory.all();
    if (!items.length) { memList.appendChild(el('div', { class: 'muted small' }, 'Chưa có ghi nhớ.')); return; }
    items.forEach((m) => memList.appendChild(el('div', { class: 'row-card small' }, [
      el('div', {}, `(${m.category}) ${m.text}`),
      el('button', { class: 'btn ghost', onClick: () => { memory.remove(m.id); renderMem(); } }, '✕')
    ])));
  }
  renderMem();

  // ---- Avatar ----
  let modelName = s.avatarModelName || '';
  const avatarModeSel = el('select', { class: 'field' }, [
    el('option', { value: '3d', selected: s.avatarMode === '3d' }, 'Nhân vật 3D tạm thời (dựng sẵn — placeholder)'),
    el('option', { value: 'vrm', selected: s.avatarMode === 'vrm' }, 'Nhân vật 3D của bạn (.vrm / .glb)'),
    el('option', { value: '2d', selected: s.avatarMode === '2d' }, 'Ảnh 2D (chân dung)')
  ]);
  const vrmUrl = el('input', { class: 'field', type: 'text', value: s.vrmUrl || '', placeholder: 'hoặc dán URL tới file .vrm / .glb' });
  const modelStatus = el('div', { class: 'muted small' }, modelName ? `Đã nạp: ${modelName}` : '(chưa có file 3D — đang dùng nhân vật tạm)');
  const modelFile = el('input', { class: 'field', type: 'file', accept: '.vrm,.glb,.gltf' });
  modelFile.addEventListener('change', async () => {
    const f = modelFile.files && modelFile.files[0];
    if (!f) return;
    modelStatus.textContent = 'Đang lưu file…';
    try {
      const buf = await f.arrayBuffer();
      await idbSet('avatarModel', new Blob([buf]));
      modelName = f.name;
      avatarModeSel.value = 'vrm';
      vrmUrl.value = '';
      modelStatus.textContent = `Đã nạp: ${f.name} — bấm Lưu để hiển thị.`;
    } catch (e) {
      modelStatus.textContent = 'Lỗi lưu file: ' + (e.message || e);
    }
  });
  const removeModelBtn = el('button', { class: 'btn ghost small', onClick: async () => {
    await idbDel('avatarModel'); modelName = '';
    if (avatarModeSel.value === 'vrm') avatarModeSel.value = '3d';
    modelStatus.textContent = '(đã xoá file 3D)';
  } }, 'Xoá file 3D');
  const reqs = el('details', { class: 'set-req' }, [
    el('summary', {}, '📐 Yêu cầu file nhân vật 3D (bấm để xem)'),
    el('div', { class: 'muted small', html:
      '<b>Định dạng:</b> VRM 1.0 (khuyến nghị) hoặc VRM 0.x — chuẩn nhân vật 3D nhân hoá. GLB/glTF cũng nạp được nhưng chỉ hiển thị tĩnh (không có biểu cảm).<br>' +
      '<b>Xương (rig):</b> humanoid — hips, spine, chest, neck, head, hai vai/cánh tay/cẳng tay, hai chân.<br>' +
      '<b>Biểu cảm (BlendShape/Expression):</b> happy, angry, sad, relaxed, surprised, neutral; khẩu hình aa, ih, ou, ee, oh; blink; hướng nhìn lookUp/Down/Left/Right.<br>' +
      '<b>Tư thế & hệ toạ độ:</b> T-pose, mặt hướng +Z, đứng ở gốc toạ độ, cao ~1.5m, đơn vị mét.<br>' +
      '<b>Tối ưu:</b> ≤ ~50k tam giác, 1–4 texture (≤2048px), dung lượng ≤ ~30MB.<br>' +
      '<b>Công cụ tạo:</b> VRoid Studio (xuất .vrm), Blender + add-on VRM, hoặc Ready Player Me.'
    })
  ]);

  // ---- Tokens ----
  const budget = el('input', { class: 'field', type: 'number', min: '0', step: '1000', value: tokenTracker.budget || '', placeholder: 'Ngân sách token (tuỳ chọn)' });

  function persist() {
    settings.update({
      providerId: providerSel.value,
      apiKey: apiKey.value.trim(),
      model: model.value.trim(),
      baseUrl: baseUrl.value.trim(),
      temperature: Number(temp.value) || 0.7,
      maxTokens: Number(maxTok.value) || 1024,
      assistantName: nameInput.value.trim() || 'Trợ lý',
      gender: genderInput.value.trim(),
      mode: modeSel.value,
      ttsEnabled: ttsChk.checked,
      sttLang: sttLang.value.trim() || 'vi-VN',
      voiceName: voiceSel.value,
      memoryAllowed: memChk.checked,
      avatarMode: avatarModeSel.value,
      vrmUrl: vrmUrl.value.trim(),
      avatarModelName: modelName
    });
    tokenTracker.setBudget(budget.value ? Number(budget.value) : null);
  }

  const saveBtn = el('button', { class: 'btn primary', onClick: () => { persist(); onChanged && onChanged(); toast('Đã lưu cài đặt.', 'ok'); overlay.remove(); } }, 'Lưu & đóng');

  body.appendChild(el('div', { class: 'modal-title' }, '⚙️ Cài đặt'));
  const scroll = el('div', { class: 'modal-scroll' });

  scroll.appendChild(el('h4', { class: 'set-h' }, '🔌 AI Gateway — dùng API key của bất kỳ model chat nào'));
  scroll.appendChild(field('Nhà cung cấp', providerSel));
  scroll.appendChild(field('API Key', el('div', { class: 'form-row' }, [apiKey, showKey]), 'Lưu cục bộ trên máy, chỉ gửi tới nhà cung cấp bạn chọn.'));
  scroll.appendChild(field('Model', model, 'Với Custom/OpenRouter bạn có thể gõ bất kỳ tên model nào.'));
  scroll.appendChild(field('Base URL', baseUrl, 'Cho phép trỏ tới mọi endpoint tương thích OpenAI.'));
  scroll.appendChild(el('div', { class: 'form-row' }, [field('Temperature', temp), field('Max tokens', maxTok)]));
  scroll.appendChild(el('div', { class: 'form-row' }, [testBtn, balanceBtn]));
  scroll.appendChild(testStatus);
  scroll.appendChild(balanceOut);
  scroll.appendChild(modelList);

  scroll.appendChild(el('h4', { class: 'set-h' }, '🧬 Nhân vật'));
  scroll.appendChild(el('div', { class: 'form-row' }, [field('Tên', nameInput), field('Giới tính', genderInput)]));

  scroll.appendChild(el('h4', { class: 'set-h' }, '🗣️ Đầu vào / Đầu ra'));
  scroll.appendChild(field('Chế độ phản hồi', modeSel));
  scroll.appendChild(field('Đọc phản hồi (TTS)', ttsChk));
  scroll.appendChild(el('div', { class: 'form-row' }, [field('Ngôn ngữ nhận giọng', sttLang), field('Giọng đọc', voiceSel)]));

  scroll.appendChild(el('h4', { class: 'set-h' }, '🧠 Bộ nhớ (chỉ lưu khi được phép)'));
  scroll.appendChild(field('Cho phép ghi nhớ lâu dài', memChk, 'Không bao giờ lưu mật khẩu, OTP hay thông tin nhạy cảm.'));
  scroll.appendChild(memList);

  scroll.appendChild(el('h4', { class: 'set-h' }, '👤 Nhân vật (Avatar)'));
  scroll.appendChild(field('Kiểu hiển thị', avatarModeSel));
  scroll.appendChild(field('Nhập file nhân vật 3D (.vrm / .glb)', modelFile, 'Sau khi chọn file, hệ thống tự chuyển sang chế độ "Nhân vật 3D của bạn".'));
  scroll.appendChild(el('div', { class: 'form-row' }, [modelStatus, removeModelBtn]));
  scroll.appendChild(field('Hoặc URL model 3D', vrmUrl, 'Đổi xong bấm Lưu để tải lại nhân vật.'));
  scroll.appendChild(reqs);

  scroll.appendChild(el('h4', { class: 'set-h' }, '📊 Token'));
  scroll.appendChild(field('Ngân sách token (để tính "còn lại")', budget));

  body.appendChild(scroll);
  body.appendChild(el('div', { class: 'modal-actions' }, [
    el('button', { class: 'btn ghost', onClick: () => overlay.remove() }, 'Đóng'),
    saveBtn
  ]));

  overlay.appendChild(body);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}
