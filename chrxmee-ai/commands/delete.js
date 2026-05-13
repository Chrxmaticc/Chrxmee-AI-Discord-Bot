const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { encodeGif } = require("@napi-rs/canvas/gif");

module.exports = new ChrxCommandBuilder({
  name: "profile-delete",
  description: "Delete someone's avatar pixel by pixel",
  cooldown: 12,
  options: [
    { name: "target", description: "Who's getting deleted?", type: "user", required: true }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target");
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 256 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 256, grid = 16, cols = size / grid, rows = size / grid;
      const total = cols * rows, frames = 20, bpf = Math.ceil(total / frames);

      const order = Array.from({ length: total }, (_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const frameBuffers = [];

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(avatar, 0, 0, size, size);

        const deleted = Math.min((i + 1) * bpf, total);
        for (let j = 0; j < deleted; j++) {
          const idx = order[j], col = idx % cols, row = Math.floor(idx / cols);
          ctx.clearRect(col * grid, row * grid, grid, grid);
        }

        frameBuffers.push(canvas.toBuffer("image/png"));
      }

      // Final frame: fully deleted
      ctx.clearRect(0, 0, size, size);
      frameBuffers.push(canvas.toBuffer("image/png"));

      const gifBuffer = await encodeGif(frameBuffers, { delay: 5, repeat: 0 });
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-deleted.gif` });
      await interaction.editReply({ content: `🗑️ **${target.displayName}** has been DELETED.`, files: [attachment] });
    } catch (err) {
      console.error("Delete error:", err);
      await interaction.editReply("❌ Failed to delete avatar.");
    }
  }
});
