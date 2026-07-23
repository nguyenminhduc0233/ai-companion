import { el, clear } from '../../ui/dom.js';
import { platformFetch } from '../ai-gateway/gateway.js';

const WCODE = {
  0: '☀️ Trời quang', 1: '🌤️ Ít mây', 2: '⛅ Có mây', 3: '☁️ Nhiều mây',
  45: '🌫️ Sương mù', 48: '🌫️ Sương giá', 51: '🌦️ Mưa phùn nhẹ', 61: '🌧️ Mưa nhẹ',
  63: '🌧️ Mưa vừa', 65: '🌧️ Mưa to', 71: '🌨️ Tuyết nhẹ', 80: '🌦️ Mưa rào',
  95: '⛈️ Dông', 96: '⛈️ Dông kèm mưa đá'
};

export const weatherPlugin = {
  id: 'weather',
  name: 'Thời tiết',
  icon: '🌤️',
  category: 'plugin',
  description: 'Thời tiết hiện tại (Open-Meteo, không cần API key).',

  render() {
    const root = el('div', { class: 'plugin-panel' });
    const out = el('div', { class: 'weather-out' });
    const cityInput = el('input', { class: 'field', type: 'text', placeholder: 'Nhập thành phố (vd: Hanoi)…' });

    async function fetchWeather(lat, lon, label) {
      clear(out);
      out.appendChild(el('div', { class: 'muted' }, 'Đang tải…'));
      try {
        const res = await platformFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`);
        const j = await res.json();
        const c = j.current || {};
        clear(out);
        out.appendChild(el('div', { class: 'weather-card' }, [
          el('div', { class: 'weather-city' }, label || `${lat.toFixed(2)}, ${lon.toFixed(2)}`),
          el('div', { class: 'weather-temp' }, `${Math.round(c.temperature_2m)}°C`),
          el('div', { class: 'weather-desc' }, WCODE[c.weather_code] || 'Không rõ'),
          el('div', { class: 'muted small' }, `Độ ẩm ${c.relative_humidity_2m}% · Gió ${c.wind_speed_10m} km/h`)
        ]));
      } catch (err) {
        clear(out);
        out.appendChild(el('div', { class: 'error' }, 'Không lấy được thời tiết: ' + (err.message || err)));
      }
    }

    async function searchCity() {
      const name = cityInput.value.trim();
      if (!name) return;
      clear(out); out.appendChild(el('div', { class: 'muted' }, 'Đang tìm…'));
      try {
        const res = await platformFetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=vi`);
        const j = await res.json();
        const g = j.results && j.results[0];
        if (!g) { clear(out); out.appendChild(el('div', { class: 'muted' }, 'Không tìm thấy thành phố.')); return; }
        fetchWeather(g.latitude, g.longitude, `${g.name}, ${g.country || ''}`);
      } catch (err) {
        clear(out); out.appendChild(el('div', { class: 'error' }, 'Lỗi tìm kiếm: ' + (err.message || err)));
      }
    }

    root.appendChild(el('div', { class: 'form-row' }, [
      cityInput,
      el('button', { class: 'btn primary', onClick: searchCity }, 'Tìm')
    ]));
    root.appendChild(el('button', { class: 'btn ghost', onClick: () => {
      if (!navigator.geolocation) { clear(out); out.appendChild(el('div', { class: 'muted' }, 'Thiết bị không hỗ trợ định vị.')); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, 'Vị trí của bạn'),
        () => { clear(out); out.appendChild(el('div', { class: 'muted' }, 'Không lấy được vị trí.')); }
      );
    } }, '📍 Dùng vị trí hiện tại'));
    root.appendChild(out);
    return root;
  }
};
