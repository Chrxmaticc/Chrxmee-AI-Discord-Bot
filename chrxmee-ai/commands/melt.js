const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

module.exports = new ChrxCommandBuilder({
  name: "profile-melt",
  description: "Melt someone's avatar like wax",
  cooldown: 12,
  options: [
    { name: "target", description: "Who's melting?", type: "user", required: true }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target");
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 256 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 256, frames = 20;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);

        const progress = i / frames;

        // Draw avatar stretched downward (melting)
        const meltStretch = 1 + progress * 0.5;
        const shrinkWidth = 1 - progress * 0.3;
        const dw = size * shrinkWidth;
        const dh = size * meltStretch;
        const dx = (size - dw) / 2;
        const dy = progress * 20;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, size, size);
        ctx.clip();
        ctx.drawImage(avatar, dx, dy, dw, dh);
        ctx.restore();

        // Drips at bottom
        if (progress > 0.3) {
          ctx.fillStyle = "#333333";
          for (let d = 0; d < 4; d++) {
            const dripX = 60 + d * 40 + Math.sin(d * 2.1 + i * 0.3) * 10;
            const dripLen = progress * 50 + Math.sin(d) * 10;
            ctx.beginPath();
            ctx.moveTo(dripX, size - 10);
            ctx.lineTo(dripX + 5, size - 10 + dripLen);
            ctx.lineTo(dripX - 5, size - 10 + dripLen);
            ctx.closePath();
            ctx.fill();
          }
        }

        const { data, width, height } = ctx.getImageData(0, 0, size, size);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: 6 });
      }

      gif.finish();
      const attachment = new AttachmentBuilder(Buffer.from(gif.bytes()), { name: `${target.username}-melt.gif` });
      await interaction.editReply({ content: `🫠 **${target.displayName}** melted into a puddle.`, files: [attachment] });
    } catch (err) {
      console.error("Melt error:", err);
      await interaction.editReply("❌ Failed to melt avatar.");
    }
  }
});
