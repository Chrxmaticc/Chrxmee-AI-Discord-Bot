/* cogs/verification/captcha/math.js — math problem captcha */

const { createCanvas } = require('@napi-rs/canvas');
const { drawNoiseDots, drawNoiseLines, randomRotation } = require('./noise');
const fonts = require('./fonts');

function makeProblem(difficulty = 'medium') {
  let a, b, op, answer;
  if (difficulty === 'easy') {
    a = 1 + Math.floor(Math.random() * 9);
    b = 1 + Math.floor(Math.random() * 9);
    op = '+';
    answer = a + b;
  } else if (difficulty === 'hard') {
    a = 2 + Math.floor(Math.random() * 11);
    b = 2 + Math.floor(Math.random() * 11);
    op = '×';
    answer = a * b;
  } else {
    a = 5 + Math.floor(Math.random() * 40);
    b = 5 + Math.floor(Math.random() * 40);
    op = Math.random() > 0.5 ? '+' : '-';
    if (op === '-' && b > a) [a, b] = [b, a];
    answer = op === '+' ? a + b : a - b;
  }
  return { display: `${a} ${op} ${b}`, answer: String(answer) };
}

async function generate(opts = {}) {
  const difficulty = opts.difficulty || 'medium';
  const color = opts.color || '#5b7fd4';
  const { display, answer } = makeProblem(difficulty);

  const width = 420;
  const height = 160;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#f4f6fb');
  grad.addColorStop(1, '#e6ecf7');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  drawNoiseDots(ctx, width, height, 250, 0.2);

  const family = fonts.getFamily();
  ctx.font = `700 56px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(randomRotation(-6, 6));
  const cgrad = ctx.createLinearGradient(0, -30, 0, 30);
  cgrad.addColorStop(0, '#5b7fd4');
  cgrad.addColorStop(1, '#2b4a8a');
  ctx.fillStyle = cgrad;
  ctx.fillText(display, 0, 0);
  ctx.restore();

  drawNoiseLines(ctx, width, height, 3, color);
  drawNoiseDots(ctx, width, height, 60, 0.35);

  const blurred = createCanvas(width, height);
  const bctx = blurred.getContext('2d');
  bctx.filter = 'blur(0.4px)';
  bctx.drawImage(canvas, 0, 0);

  return {
    buffer: blurred.toBuffer('image/png'),
    answer,
    display,
  };
}

module.exports = { generate };
