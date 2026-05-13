const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

module.exports = new ChrxCommandBuilder({
  name: "profile-globe",
  description: "Turn someone's avatar into a cursed spinning globe 🌍",
  cooldown: 15,
  options: [
    { name: "target", description: "Who's becoming spherical?", type: "user", required: false }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target") || interaction.user;
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 512 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 512, frames = 32, delay = 3;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const cx = size / 2, cy = size / 2, radius = size / 2;
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        const squash = Math.cos(angle);
        const width = Math.max(16, size * Math.abs(squash));
        const x = cx - width / 2;

        ctx.save();
        ctx.globalAlpha = 0.92;
        if (squash < 0) { ctx.translate(size, 0); ctx.scale(-1, 1); }
        ctx.drawImage(avatar, x, 0, width, size);
        ctx.restore();

        const gradient = ctx.createRadialGradient(cx - 80, cy - 80, 40, cx, cy, radius);
        gradient.addColorStop(0, "rgba(255,255,255,0.12)");
        gradient.addColorStop(0.5, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.35)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        ctx.restore();

        const { data, width: w, height: h } = ctx.getImageData(0, 0, size, size);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay });
      }

      gif.finish();
      const attachment = new AttachmentBuilder(Buffer.from(gif.bytes()), { name: `${target.username}-globe.gif` });
      await interaction.editReply({ content: `🌍 **${target.displayName}** has been globified.`, files: [attachment] });
    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: "❌ globe machine exploded" });
    }
  }
});
