const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { encodeGif } = require("@napi-rs/canvas/gif");

module.exports = new ChrxCommandBuilder({
  name: "profile-spin",
  description: "Make someone's avatar do a 360° spin!",
  cooldown: 10,
  options: [
    { name: "target", description: "Who's getting spun?", type: "user", required: true }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target");
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 256 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 256, frames = 24, delay = 4;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const frameBuffers = [];

      for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;
        ctx.clearRect(0, 0, size, size);

        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate(angle);
        ctx.drawImage(avatar, -size / 2, -size / 2, size, size);
        ctx.restore();

        frameBuffers.push(canvas.toBuffer("image/png"));
      }

      const gifBuffer = await encodeGif(frameBuffers, { delay, repeat: 0 });
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-spin.gif` });
      await interaction.editReply({ content: `🌀 **${target.displayName}** is SPINNING!`, files: [attachment] });
    } catch (err) {
      console.error("Spin error:", err);
      await interaction.editReply("❌ Failed to generate spin GIF.");
    }
  }
});
