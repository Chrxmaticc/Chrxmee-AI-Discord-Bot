const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

module.exports = new ChrxCommandBuilder({
  name: "profile-spin",
  description: "Make someone's avatar do a 360° spin!",
  cooldown: 10,
  options: [
    { name: "target", description: "Who's getting spun?", type: "user", required: false }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target") || interaction.user;
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 512 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 512, frames = 24, delay = 4;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate(angle);
        ctx.drawImage(avatar, -size / 2, -size / 2, size, size);
        ctx.restore();

        const { data, width, height } = ctx.getImageData(0, 0, size, size);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay });
      }

      gif.finish();
      const attachment = new AttachmentBuilder(Buffer.from(gif.bytes()), { name: `${target.username}-spin.gif` });
      await interaction.editReply({ content: `🌀 **${target.displayName}** is SPINNING!`, files: [attachment] });
    } catch (err) {
      console.error("Spin error:", err);
      await interaction.editReply("❌ Failed to generate spin GIF.");
    }
  }
});
