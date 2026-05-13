const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

module.exports = new ChrxCommandBuilder({
  name: "profile-toast",
  description: "Slowly burn someone's avatar to a crisp",
  cooldown: 12,
  options: [
    { name: "target", description: "Who's getting toasted?", type: "user", required: false }
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
        const burnLevel = i > frames * 0.3 ? (i - frames * 0.3) / (frames * 0.7) : 0;

        ctx.drawImage(avatar, 0, 0, size, size);

        if (burnLevel > 0) {
          ctx.fillStyle = `rgba(0, 0, 0, ${burnLevel * 0.7})`;
          ctx.fillRect(0, 0, size, size);

          const burnHeight = size * burnLevel;
          const gradient = ctx.createLinearGradient(0, size - burnHeight, 0, size);
          gradient.addColorStop(0, "rgba(139, 69, 19, 0)");
          gradient.addColorStop(0.5, `rgba(139, 69, 19, ${burnLevel})`);
          gradient.addColorStop(1, `rgba(30, 10, 0, ${burnLevel})`);
          ctx.fillStyle = gradient;
          ctx.fillRect(0, size - burnHeight, size, burnHeight);

          if (burnLevel > 0.5) {
            for (let c = 0; c < 16; c++) {
              const crumbleX = Math.random() * size;
              const crumbleY = size - Math.random() * burnHeight;
              ctx.clearRect(crumbleX, crumbleY, Math.random() * 20 + 5, Math.random() * 20 + 5);
            }
          }
        }

        const { data, width, height } = ctx.getImageData(0, 0, size, size);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: 8 });
      }

      gif.finish();
      const attachment = new AttachmentBuilder(Buffer.from(gif.bytes()), { name: `${target.username}-toast.gif` });
      await interaction.editReply({ content: `🍞 **${target.displayName}** got BURNT to a crisp!`, files: [attachment] });
    } catch (err) {
      console.error("Toast error:", err);
      await interaction.editReply("❌ Failed to burn avatar.");
    }
  }
});
