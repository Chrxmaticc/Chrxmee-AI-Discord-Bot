const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");

module.exports = new ChrxCommandBuilder({
  name: "profile-delete",
  description: "Delete someone's avatar pixel by pixel",
  cooldown: 12,
  options: [
    { name: "target", description: "Who's getting deleted?", type: "user", required: false }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target") || interaction.user;
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 512 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 256, grid = 16, cols = size / grid, rows = size / grid;
      const total = cols * rows, frames = 20, bpf = Math.ceil(total / frames);

      const order = Array.from({ length: total }, (_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }

      const encoder = new GIFEncoder(size, size, "neuquant", true);
      encoder.start();
      encoder.setRepeat(0);
      encoder.setDelay(50);
      encoder.setQuality(10);
      encoder.setTransparent(0x00000000);

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(avatar, 0, 0, size, size);
        const deleted = Math.min((i + 1) * bpf, total);
        for (let j = 0; j < deleted; j++) {
          const idx = order[j], col = idx % cols, row = Math.floor(idx / cols);
          ctx.clearRect(col * grid, row * grid, grid, grid);
        }
        encoder.addFrame(ctx);
      }

      ctx.clearRect(0, 0, size, size);
      encoder.setDelay(2000);
      encoder.addFrame(ctx);

      encoder.finish();
      const gifBuffer = encoder.out.getData();
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-deleted.gif` });
      await interaction.editReply({ content: `🗑️ **${target.displayName}** has been DELETED.`, files: [attachment] });
    } catch (err) {
      console.error("Delete error:", err);
      await interaction.editReply("❌ Failed to delete avatar.");
    }
  }
});
