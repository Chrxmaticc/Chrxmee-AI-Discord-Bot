/* cogs/verification/captcha/noise.js — shared drawing helpers */

function drawNoiseDots(ctx, width, height, count, alpha = 0.3) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const r = Math.random() * 1.6 + 0.3;
    const gray = Math.floor(Math.random() * 120) + 60;
    ctx.fillStyle = `rgba(${gray},${gray},${gray},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNoiseLines(ctx, width, height, count, brandColor = '#5b7fd4') {
  ctx.save();
  ctx.strokeStyle = brandColor + '55';
  ctx.lineWidth = 1 + Math.random();
  for (let i = 0; i < count; i++) {
    ctx.beginPath();
    const startX = Math.random() * width * 0.3;
    const endX = width * 0.7 + Math.random() * width * 0.3;
    ctx.moveTo(startX, Math.random() * height);
    ctx.bezierCurveTo(
      width * 0.35, Math.random() * height,
      width * 0.65, Math.random() * height,
      endX, Math.random() * height
    );
    ctx.stroke();
  }
  ctx.restore();
}

function randomRotation(min = -25, max = 25) {
  return (min + Math.random() * (max - min)) * (Math.PI / 180);
}

module.exports = { drawNoiseDots, drawNoiseLines, randomRotation };
