/* cogs/verification/captcha/fonts.js — ttf loading with system fallback */

const { GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');

const FONT_DIR = path.join(__dirname, 'fonts');
let loadedFamily = 'sans-serif';

function load() {
  try {
    if (!fs.existsSync(FONT_DIR)) {
      console.log('[captcha] no fonts/ folder — using system font');
      loadedFamily = pickSystemFont();
      return loadedFamily;
    }
    const files = fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.ttf') || f.endsWith('.otf'));
    if (!files.length) {
      loadedFamily = pickSystemFont();
      return loadedFamily;
    }
    for (const file of files) {
      const family = 'chromed-captcha-' + file.replace(/\.(ttf|otf)$/i, '');
      GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
      loadedFamily = family;
      console.log(`[captcha] loaded font: ${file} as ${family}`);
    }
  } catch (e) {
    console.log('[captcha] font load failed, using system:', e.message);
    loadedFamily = pickSystemFont();
  }
  return loadedFamily;
}

function pickSystemFont() {
  try {
    const families = GlobalFonts.families.map(f => f.family);
    const mono = families.find(f => /mono/i.test(f));
    const sans = families.find(f => /dejavu|liberation|noto/i.test(f));
    return mono || sans || 'sans-serif';
  } catch {
    return 'sans-serif';
  }
}

module.exports = { load, getFamily: () => loadedFamily };
