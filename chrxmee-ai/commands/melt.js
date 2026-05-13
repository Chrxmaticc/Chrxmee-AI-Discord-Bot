const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

module.exports = new ChrxCommandBuilder({
  name: "profile-melt",
  description: "Melt someone's avatar like wax",
  cooldown: 12,
  options: [
    { name: "target", description: "Who's melting?", type: "user", required: false }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target") || interaction.user;
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 512 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 512, frames = 20;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);
        const progress = i / frames;
        const meltStretch = 1 + progress * 0.5;
        const shrinkWidth = 1 - progress * 0.3;
        const dw = size * shrinkWidth;
        const dh = size * meltStretch;
        const dx = (size - dw) / 2;
        const dy = progress * 40;

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, size, size);
        ctx.clip();
        ctx.drawImage(avatar, dx, dy, dw, dh);
        ctx.restore();

        if (progress > 0.3) {
          for (let d = 0; d < 6; d++) {
            const dripX = 120 + d * 60 + Math.sin(d * 2.1 + i * 0.3) * 20;
            const dripLen = progress * 100 + Math.sin(d) * 20;
            ctx.fillStyle = "#333333";
            ctx.beginPath();
            ctx.moveTo(dripX, size - 20);
            ctx.lineTo(dripX + 8, size - 20 + dripLen);
            ctx.lineTo(dripX - 8, size - 20 + dripLen);
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
