const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");

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
      const size = 256, frames = 20;

      const encoder = new GIFEncoder(size, size, "octree", true);
      encoder.setQuality(5);
      encoder.setRepeat(0);
      encoder.setDelay(60);
      encoder.setTransparent(0x000000);
      encoder.start();

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);
        const progress = i / frames;
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

        if (progress > 0.3) {
          for (let d = 0; d < 4; d++) {
            const dripX = 60 + d * 40 + Math.sin(d * 2.1 + i * 0.3) * 10;
            const dripLen = progress * 50 + Math.sin(d) * 10;
            ctx.fillStyle = "#333333";
            ctx.beginPath();
            ctx.moveTo(dripX, size - 10);
            ctx.lineTo(dripX + 5, size - 10 + dripLen);
            ctx.lineTo(dripX - 5, size - 10 + dripLen);
            ctx.closePath();
            ctx.fill();
          }
        }

        encoder.addFrame(ctx);
      }

      encoder.finish();
      const gifBuffer = encoder.out.getData();
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-melt.gif` });
      await interaction.editReply({ content: `🫠 **${target.displayName}** melted into a puddle.`, files: [attachment] });
    } catch (err) {
      console.error("Melt error:", err);
      await interaction.editReply("❌ Failed to melt avatar.");
    }
  }
});
