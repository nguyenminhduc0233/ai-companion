// Fetches the character avatar frames into public/avatar/ and generates the
// app icon. Runs automatically after `npm install` (postinstall) and in CI, so
// the build always has the artwork without committing large binaries to git.
//
// Replace these URLs (or just drop your own images into public/avatar/) to use
// a different character. Files already present are left untouched.
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const FRAMES = {
  'normal.png':    'https://pub.hyperagent.com/api/published/pbf01KY240HKN_P3JSJ0EMAP6ERZ87/image-1783661603861105.png',
  'happy.jpg':     'https://pub.hyperagent.com/api/published/pbf01KY244X9M_58R66T6AXHF435PW/99ce0cb9-6724-4e8f-9f4a-dbcc3703467b.png',
  'thinking.jpg':  'https://pub.hyperagent.com/api/published/pbf01KY244XMB_ZVRYHHH5W97GHD0W/a35cfbf0-dc96-4f1c-924e-c29c71e6b61e.png',
  'surprise.jpg':  'https://pub.hyperagent.com/api/published/pbf01KY244Y4T_389D3T4HFWP0ZQAR/6c3086ea-a91f-4ac3-b204-13e9c08ec144.png',
  'sympathy.jpg':  'https://pub.hyperagent.com/api/published/pbf01KY244YK5_RPZSJ9HCQVZ7862W/629153cd-24f8-447e-be03-ce1dbc674808.png',
  'celebrate.jpg': 'https://pub.hyperagent.com/api/published/pbf01KY244Z3N_BYKZW18R5SGK7NYB/fe63ffff-a72c-420b-a603-5896e123dd8b.png',
  'blink.jpg':     'https://pub.hyperagent.com/api/published/pbf01KY244ZCJ_PCNCCT9YZ8AN1ZBB/f2de71ab-afdc-4b7e-b0e4-e239fd9b9f3a.png'
};

async function main() {
  const dir = join(ROOT, 'public', 'avatar');
  mkdirSync(dir, { recursive: true });

  for (const [name, url] of Object.entries(FRAMES)) {
    const dest = join(dir, name);
    if (existsSync(dest)) { console.log('· giữ nguyên', name); continue; }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      writeFileSync(dest, buf);
      console.log('✓ tải', name, `(${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.warn('! bỏ qua', name, '-', e.message, '(hãy tự thêm ảnh vào public/avatar/)');
    }
  }

  // App icon (offline, no network).
  try {
    mkdirSync(join(ROOT, 'public', 'icons'), { recursive: true });
    execSync('node scripts/gen-icon.cjs', { cwd: ROOT, stdio: 'ignore' });
    console.log('✓ tạo icon.png');
  } catch (_) {
    console.warn('! không tạo được icon.png');
  }
}

main().catch((e) => console.warn('fetch-assets:', e.message)).finally(() => process.exit(0));
