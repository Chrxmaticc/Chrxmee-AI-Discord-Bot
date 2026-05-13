const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

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
      const size = 256, frames = 20;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, 0, size, size);

        const progress = i/frames;
        const meltH = size*(1-progress*0.85);
        const puddleS = progress*40;

        if (meltH > 10) {
          ctx.save(); ctx.beginPath(); ctx.rect(20, 20, size-40, meltH); ctx.clip();
          ctx.drawImage(avatar, 20, 20, size-40, size-40); ctx.restore();
        }

        ctx.fillStyle = "#333333";
        for (let d = 0; d < 5; d++) {
          const dx = 45+d*35+Math.sin(d*1.3+i*0.2)*8;
          const dripLen = 15+progress*70+Math.sin(d)*12;
          ctx.beginPath(); ctx.moveTo(dx, 20+meltH); ctx.lineTo(dx+6, 20+meltH+dripLen);
          ctx.lineTo(dx-6, 20+meltH+dripLen); ctx.closePath(); ctx.fill();
        }

        if (progress > 0.2) {
          ctx.fillStyle = `rgba(60,60,60,${progress})`;
          ctx.beginPath(); ctx.ellipse(size/2, size-25, 65+puddleS, 8+puddleS*0.3, 0, 0, Math.PI*2); ctx.fill();
        }

        ctx.fillStyle = "#ffffff"; ctx.font = "bold 20px Impact, sans-serif"; ctx.textAlign = "center";
        if (progress > 0.7) ctx.fillText("MELTED.", size/2, 30);
        else ctx.fillText("MELTING...", size/2, 30);

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
