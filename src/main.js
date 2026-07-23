import './styles/main.css';

import { el } from './ui/dom.js';
import { toast, confirmAction } from './ui/confirm.js';

import { AIGateway } from './core/ai-gateway/gateway.js';
import { tokenTracker } from './core/ai-gateway/token-tracker.js';
import { AssistantCore } from './core/assistant-core.js';
import { settings } from './core/memory/settings.js';
import { memory } from './core/memory/memory.js';
import { notifier, scheduler } from './core/local/local-functions.js';
import { stt } from './core/voice/stt.js';
import { tts } from './core/voice/tts.js';

import { pluginManager } from './core/plugins/plugin-manager.js';
import { chatPlugin } from './core/plugins/chat-plugin.js';
import { pdfPlugin } from './core/plugins/pdf-plugin.js';
import { cameraPlugin } from './core/plugins/camera-plugin.js';
import { calendarPlugin } from './core/plugins/calendar-plugin.js';
import { weatherPlugin } from './core/plugins/weather-plugin.js';
import { emailPlugin } from './core/plugins/email-plugin.js';
import { browserPlugin } from './core/plugins/browser-plugin.js';

import { Avatar3D } from './avatar/avatar-3d.js';
import { Avatar2D } from './avatar/avatar-2d.js';
import { ChatUI } from './ui/chat-ui.js';

// Character frames (the reference artwork + AI expression variants of the SAME
// character). Served from public/avatar via Vite (relative to index.html).
const AVATAR_FRAMES = {
  normal: 'avatar/normal.png',
  happy: 'avatar/happy.jpg',
  thinking: 'avatar/thinking.jpg',
  surprise: 'avatar/surprise.jpg',
  sympathy: 'avatar/sympathy.jpg',
  celebrate: 'avatar/celebrate.jpg',
  blink: 'avatar/blink.jpg'
};
import { ToolsUI } from './ui/tools-ui.js';
import { openSettings } from './ui/settings-ui.js';
import { DialogueBox } from './ui/dialogue-box.js';
import { idbGet } from './core/local/idb.js';

// --- Register plugins (extension point: add more here) ---
[chatPlugin, pdfPlugin, cameraPlugin, calendarPlugin, weatherPlugin, emailPlugin, browserPlugin]
  .forEach((p) => pluginManager.register(p));

// --- Core services ---
const gateway = new AIGateway(() => settings.gatewaySettings());
const assistant = new AssistantCore(gateway);

let avatar = null;
let avatarKey = '';
let listening = false;

// --- Build shell ---
const app = document.getElementById('app');

const nameLabel = el('div', { class: 'brand-name' }, settings.get('assistantName') || 'AI Companion');
const statusLabel = el('div', { class: 'avatar-status' }, 'Sẵn sàng');

function modeBtn(id, label) {
  const b = el('button', { class: 'mode-btn', dataset: { mode: id }, onClick: () => setMode(id) }, label);
  return b;
}
const modeBtns = [modeBtn('text', 'Text'), modeBtn('voice', 'Voice'), modeBtn('both', 'Cả hai')];

const header = el('header', { class: 'app-header' }, [
  el('div', { class: 'brand' }, [
    el('div', { class: 'brand-orb' }),
    el('div', {}, [el('div', { class: 'brand-title' }, 'AI Companion'), nameLabel])
  ]),
  el('div', { class: 'mode-toggle' }, modeBtns),
  el('button', { class: 'icon-btn gear', title: 'Cài đặt', onClick: openSettingsModal }, '⚙️')
]);

const stage = el('div', { id: 'avatar-stage', class: 'avatar-stage' });
const leftCol = el('div', { class: 'col-left' }, [
  stage,
  el('div', { class: 'avatar-caption' }, [nameLabel.cloneNode(true), statusLabel])
]);

const centerCol = el('div', { class: 'col-center' });
const rightCol = el('div', { class: 'col-right' });

const grid = el('div', { class: 'app-grid' }, [leftCol, centerCol, rightCol]);
app.innerHTML = '';
app.appendChild(header);
app.appendChild(grid);

// --- RPG / visual-novel dialogue box over the avatar stage ---
const dialogue = new DialogueBox(stage, settings.get('assistantName') || 'Trợ lý');

// --- Shared context for plugins/tools ---
const ctx = {
  assistant, settings, memory, notifier,
  toast, confirmAction,
  sendUserMessage,
  refreshChat: () => chat.clearMessages()
};

// --- Chat ---
const chat = new ChatUI({
  onSend: sendUserMessage,
  onMicToggle: toggleMic,
  micSupported: stt.supported
});
centerCol.appendChild(chat.root);

// --- Tools ---
const tools = new ToolsUI(ctx, { pluginManager, tokenTracker });
rightCol.appendChild(tools.root);

// --- Assistant state → avatar + chat ---
assistant.on('state', (st) => {
  if (st === 'thinking') { avatar && avatar.setActivity('thinking'); chat.showTyping(); dialogue.thinking(); statusLabel.textContent = 'Đang suy nghĩ…'; }
  else if (st === 'talking') { avatar && avatar.setActivity('talking'); chat.hideTyping(); statusLabel.textContent = 'Đang trả lời…'; }
  else { avatar && avatar.setActivity('idle'); chat.hideTyping(); statusLabel.textContent = 'Sẵn sàng'; }
});
assistant.on('mood', (m) => { avatar && avatar.setMood(m); });

// --- Notifications from scheduler → toast + avatar reaction ---
notifier.on((n) => {
  toast(`${n.title} — ${n.body}`, 'ok', 5000);
  if (avatar) { avatar.setMood('surprise'); setTimeout(() => avatar.setMood('normal'), 2600); }
});

// --- Core flows ---
async function sendUserMessage(text) {
  if (!text || !text.trim()) return;
  chat.addMessage('user', text, { isMarkdown: false });
  try {
    const { text: reply } = await assistant.ask(text);
    if (reply) { chat.addMessage('assistant', reply); dialogue.say(reply); }
    const s = settings.all();
    if (reply && s.ttsEnabled && s.mode !== 'text') {
      tts.speak(reply, {
        lang: s.sttLang, voiceName: s.voiceName,
        onStart: () => avatar && avatar.setActivity('talking'),
        onEnd: () => assistant.finishedSpeaking()
      });
    } else {
      setTimeout(() => assistant.finishedSpeaking(), Math.min(4000, 700 + (reply ? reply.length : 0) * 16));
    }
  } catch (err) {
    chat.addMessage('assistant', '⚠️ ' + (err.message || err), { error: true });
  }
}

function toggleMic() {
  if (listening) { stt.stop(); return; }
  const s = settings.all();
  listening = true;
  chat.setMicActive(true);
  avatar && avatar.setActivity('listening');
  statusLabel.textContent = 'Đang nghe…';
  stt.start({
    lang: s.sttLang,
    onResult: (t) => chat.setInputValue(t),
    onFinal: (t) => { chat.setInputValue(''); sendUserMessage(t); },
    onEnd: () => {
      listening = false; chat.setMicActive(false);
      if (assistant.state !== 'thinking' && assistant.state !== 'talking') { avatar && avatar.setActivity('idle'); statusLabel.textContent = 'Sẵn sàng'; }
    },
    onError: (e) => { toast('Không nghe được: ' + (e && e.message ? e.message : e), 'warn'); }
  });
}

function setMode(mode) {
  settings.set('mode', mode);
  modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
}
setMode(settings.get('mode'));

function openSettingsModal() {
  openSettings({
    settings, gateway, tokenTracker, tts, memory,
    onChanged: async () => {
      nameLabel.textContent = settings.get('assistantName') || 'AI Companion';
      document.querySelectorAll('.brand-name').forEach((n) => { n.textContent = settings.get('assistantName'); });
      dialogue.setName(settings.get('assistantName'));
      setMode(settings.get('mode'));
      await maybeRemountAvatar();
    }
  });
}

// --- Avatar mount / remount ---
async function maybeRemountAvatar() {
  const s = settings.all();
  const key = `${s.avatarMode}|${s.vrmUrl}|${s.avatarModelName}`;
  if (key === avatarKey && avatar) return;
  avatarKey = key;
  if (avatar) { avatar.dispose(); avatar = null; }
  try {
    if (s.avatarMode === '2d') {
      // 2D living portrait — uses image artwork in public/avatar.
      avatar = new Avatar2D(stage);
      await avatar.init({ frames: AVATAR_FRAMES, baseName: 'normal' });
    } else if (s.avatarMode === 'vrm') {
      // Your own 3D character: a hosted URL, or an uploaded file from IndexedDB.
      avatar = new Avatar3D(stage);
      let url = (s.vrmUrl || '').trim();
      if (!url) {
        try { const blob = await idbGet('avatarModel'); if (blob) url = URL.createObjectURL(blob); } catch (_) {}
      }
      if (!url) {
        await avatar.init({ vrmUrl: '', mode: 'procedural' });
        toast('Chưa có file 3D — đang dùng nhân vật tạm. Vào ⚙️ để nhập file .vrm/.glb.', 'warn');
      } else {
        const kind = await avatar.init({ vrmUrl: url, mode: 'vrm' });
        if (kind === 'procedural') toast('Không tải được file 3D — dùng nhân vật tạm.', 'warn');
        else if (kind === 'glb') toast('Đã nạp mô hình GLB (hiển thị tĩnh, chưa có biểu cảm).', 'ok');
        else toast('Đã nạp nhân vật 3D của bạn.', 'ok');
      }
    } else {
      // '3d' (default): procedural 3D placeholder until the user adds their model.
      avatar = new Avatar3D(stage);
      await avatar.init({ vrmUrl: '', mode: 'procedural' });
    }
    statusLabel.textContent = 'Sẵn sàng';
  } catch (err) {
    console.error(err);
    toast('Lỗi khởi tạo avatar.', 'warn');
  }
}

// --- Boot ---
async function boot() {
  await maybeRemountAvatar();
  scheduler.start();
  await notifier.ensurePermission();
  const nm = settings.get('assistantName') || 'trợ lý';
  dialogue.setName(nm);
  dialogue.say(`Xin chào! Mình là ${nm}. Mở ⚙️ Cài đặt → AI Gateway để nhập API key cho model bất kỳ, rồi bắt đầu trò chuyện nhé.`);
  if (!settings.get('apiKey')) {
    setTimeout(() => toast('Mở ⚙️ Cài đặt để nhập API key cho model AI.', 'ok', 6000), 800);
  }
}
boot();
