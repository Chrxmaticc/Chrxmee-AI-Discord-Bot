const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("@zorner/gifencoder");

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
      const size = 300, frames = 25, delay = 60;

      const encoder = new GIFEncoder(size, size);
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      const chunks = [];
      encoder.createReadStream().on("data", chunk => chunks.push(chunk));
      const gifPromise = new Promise(resolve => {
        encoder.createReadStream().on("end", () => resolve(Buffer.concat(chunks)));
      });

      encoder.start(); encoder.setRepeat(0); encoder.setDelay(delay); encoder.setQuality(10);

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, size, size);

        const progress = i / frames;
        const meltHeight = size * (1 - progress * 0.85);
        const puddleSize = progress * 50;

        // Original (top portion)
        if (meltHeight > 10) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(25, 25, size-50, meltHeight);
          ctx.clip();
          ctx.drawImage(avatar, 25, 25, size-50, size-50);
          ctx.restore();
        }

        // Melted drips
        ctx.fillStyle = "#333333";
        for (let d = 0; d < 6; d++) {
          const dx = 50 + d * 35 + Math.sin(d*1.3 + i*0.2)*10;
          const dripLen = 20 + progress * 80 + Math.sin(d)*15;
          ctx.beginPath();
          ctx.moveTo(dx, 25 + meltHeight);
          ctx.lineTo(dx + 8, 25 + meltHeight + dripLen);
          ctx.lineTo(dx - 8, 25 + meltHeight + dripLen);
          ctx.closePath();
          ctx.fill();
        }

        // Puddle at bottom
        if (progress > 0.2) {
          ctx.fillStyle = `rgba(60,60,60,${progress})`;
          ctx.beginPath();
          ctx.ellipse(size/2, size-30, 80 + puddleSize, 10 + puddleSize*0.3, 0, 0, Math.PI*2);
          ctx.fill();
        }

        // Text
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 24px Impact, sans-serif"; ctx.textAlign = "center";
        if (progress > 0.7) ctx.fillText("MELTED.", size/2, 35);
        else ctx.fillText("MELTING...", size/2, 35);

        encoder.addFrame(ctx);
      }

      encoder.finish();
      const gifBuffer = await gifPromise;
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-melt.gif` });
      await interaction.editReply({ content: `🫠 **${target.displayName}** melted into a puddle.`, files: [attachment] });
    } catch (err) {
      console.error("Melt error:", err);
      await interaction.editReply("❌ Failed to melt avatar.");
    }
  }
});
