const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

module.exports = new ChrxCommandBuilder({
  name: "profile-pixelate",
  description: "Pixelate someone's avatar into 8-bit style",
  cooldown: 8,
  options: [
    { name: "target", description: "Who's getting pixelated?", type: "user", required: true },
    { 
      name: "size", 
      description: "Pixel size (bigger = more pixelated)", 
      type: "integer", 
      required: false,
      choices: [
        { name: "🔬 Tiny (4px)", value: 4 },
        { name: "📦 Small (8px)", value: 8 },
        { name: "🟦 Medium (16px)", value: 16 },
        { name: "🟨 Large (24px)", value: 24 },
        { name: "🧱 Huge (32px)", value: 32 },
        { name: "🏗️ Massive (48px)", value: 48 }
      ]
    }
  ],
  async run(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("target");
    const pixelSize = interaction.options.getInteger("size") || 16;
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 512 });

    try {
      const avatar = await loadImage(avatarURL);

      const size = 512;
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      // Draw original avatar
      ctx.drawImage(avatar, 0, 0, size, size);

      // Get image data
      const imageData = ctx.getImageData(0, 0, size, size);
      const pixels = imageData.data;

      // Pixelate by sampling blocks
      for (let y = 0; y < size; y += pixelSize) {
        for (let x = 0; x < size; x += pixelSize) {
          // Get average color of this block
          let r = 0, g = 0, b = 0, count = 0;

          for (let dy = 0; dy < pixelSize && y + dy < size; dy++) {
            for (let dx = 0; dx < pixelSize && x + dx < size; dx++) {
              const idx = ((y + dy) * size + (x + dx)) * 4;
              r += pixels[idx];
              g += pixels[idx + 1];
              b += pixels[idx + 2];
              count++;
            }
          }

          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);

          // Fill block with average color
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, y, pixelSize, pixelSize);
        }
      }

      // Optional: add pixel grid lines for small sizes
      if (pixelSize >= 16) {
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.lineWidth = 1;
        for (let y = 0; y < size; y += pixelSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size, y);
          ctx.stroke();
        }
        for (let x = 0; x < size; x += pixelSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, size);
          ctx.stroke();
        }
      }

      const buffer = canvas.toBuffer("image/png");
      const attachment = new AttachmentBuilder(buffer, { name: `${target.username}-pixelated.png` });

      await interaction.editReply({
        content: `🟦 **${target.displayName}** got pixelated! (${pixelSize}px blocks)`,
        files: [attachment],
      });

    } catch (err) {
      console.error("Pixelate error:", err);
      await interaction.editReply("❌ Failed to pixelate avatar.");
    }
  }
});
