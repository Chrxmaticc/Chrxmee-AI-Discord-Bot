const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder");

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

      const size = 256;
      const frames = 24; // 24 frames for smooth 360
      const delay = 40;  // 40ms between frames = ~25fps

      const encoder = new GIFEncoder(size, size);
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      // Collect GIF chunks
      const chunks = [];
      encoder.createReadStream().on("data", chunk => chunks.push(chunk));

      const gifPromise = new Promise(resolve => {
        encoder.createReadStream().on("end", () => {
          resolve(Buffer.concat(chunks));
        });
      });

      encoder.start();
      encoder.setRepeat(0);
      encoder.setDelay(delay);
      encoder.setQuality(10);

      // Draw each rotation frame
      for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;

        ctx.clearRect(0, 0, size, size);

        // Background
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, size, size);

        // Subtle circle behind avatar
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 100, 0, Math.PI * 2);
        ctx.fillStyle = "#2a2a2a";
        ctx.fill();

        // Draw rotated avatar
        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate(angle);
        ctx.drawImage(avatar, -100, -100, 200, 200);
        ctx.restore();

        // "SPINNING..." text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SPINNING...", size / 2, size - 15);

        encoder.addFrame(ctx);
      }

      encoder.finish();

      const gifBuffer = await gifPromise;
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-spin.gif` });

      await interaction.editReply({
        content: `🌀 **${target.displayName}** is SPINNING!`,
        files: [attachment],
      });

    } catch (err) {
      console.error("Spin error:", err);
      await interaction.editReply("❌ Failed to generate spin GIF.");
    }
  }
});
