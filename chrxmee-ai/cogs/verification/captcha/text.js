/* cogs/verification/captcha/text.js — distorted text captcha */

const { createCanvas } = require('@napi-rs/canvas');
const { drawNoiseDots, drawNoiseLines, randomRotation } = require('./noise');
const fonts = require('./fonts');

const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function randomCode(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return out;
}

async function generate(opts = {}) {
  const length = opts.length || 5;
  const color = opts.color || '#5b7fd4';
  const code = randomCode(length);

  const width = 420;
  const height = 160;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#f4f6fb');
  grad.addColorStop(1, '#e6ecf7');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  drawNoiseDots(ctx, width, height, 320, 0.25);

  const family = fonts.getFamily();
  const fontSize = 62;
  ctx.font = `700 ${fontSize}px ${family}`;
  ctx.textBaseline = 'middle';

  const charWidths = [];
  let totalWidth = 0;
  for (const ch of code) {
    const w = ctx.measureText(ch).width;
    charWidths.push(w);
    totalWidth += w;
  }
  const spacing = (width - totalWidth) / (length + 1);

  let x = spacing;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i];

    ctx.save();
    const y = height / 2 + (Math.random() - 0.5) * 24;
    const rot = randomRotation(-22, 22);
    const scaleY = 0.85 + Math.random() * 0.3;

    ctx.translate(x + charWidths[i] / 2, y);
    ctx.rotate(rot);
    ctx.scale(1, scaleY);

    const cgrad = ctx.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2);
    const hue = 210 + (Math.random() - 0.5) * 30;
    cgrad.addColorStop(0, `hsl(${hue}, 55%, 45%)`);
    cgrad.addColorStop(1, `hsl(${hue}, 55%, 28%)`);
    ctx.fillStyle = cgrad;

    ctx.fillText(ch, -charWidths[i] / 2, 0);
    ctx.restore();

    x += charWidths[i] + spacing;
  }

  drawNoiseLines(ctx, width, height, 4, color);
  drawNoiseDots(ctx, width, height, 80, 0.4);

  const blurred = createCanvas(width, height);
  const bctx = blurred.getContext('2d');
  bctx.filter = 'blur(0.5px)';
  bctx.drawImage(canvas, 0, 0);

  return {
    buffer: blurred.toBuffer('image/png'),
    answer: opts.caseSensitive ? code : code.toLowerCase(),
    display: code,
  };
}

module.exports = { generate };
