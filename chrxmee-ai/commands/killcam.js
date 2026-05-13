const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

module.exports = new ChrxCommandBuilder({
  name: "profile-killcam",
  description: "CoD style killcam on someone's avatar",
  cooldown: 12,
  options: [
    { name: "target", description: "Who got eliminated?", type: "user", required: true },
    { name: "weapon", description: "What took them out?", type: "string", required: false }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target");
    const weapon = interaction.options.getString("weapon") || "💀 Unknown Weapon";
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 256 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 256, frames = 16;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);

        // Just the avatar
        const zoom = 1 + (i / frames) * 0.08;
        const as = size * zoom;
        const ax = (size - as) / 2;
        const ay = (size - as) / 2;
        ctx.drawImage(avatar, ax, ay, as, as);

        // Red tint
        ctx.fillStyle = "rgba(255, 0, 0, 0.25)";
        ctx.fillRect(0, 0, size, size);

        // Crosshair
        const cx = size / 2, cy = size / 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 30, cy); ctx.lineTo(cx - 10, cy);
        ctx.moveTo(cx + 10, cy); ctx.lineTo(cx + 30, cy);
        ctx.moveTo(cx, cy - 30); ctx.lineTo(cx, cy - 10);
        ctx.moveTo(cx, cy + 10); ctx.lineTo(cx, cy + 30);
        ctx.stroke();

        // ELIMINATED text
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, 5, size, 40);
        ctx.fillStyle = "#ff1a1a";
        ctx.font = "bold 22px Impact, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ELIMINATED", cx, 32);

        // Name
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(target.displayName, cx, 52);

        // Weapon at bottom
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, size - 30, size, 30);
        ctx.fillStyle = "#cccccc";
        ctx.font = "12px monospace";
        ctx.fillText(weapon, cx, size - 10);

        // Recording dot
        const dotAlpha = Math.sin(i * 0.8) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 0, 0, ${dotAlpha})`;
        ctx.beginPath();
        ctx.arc(size - 15, 18, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "9px monospace";
        ctx.textAlign = "right";
        ctx.fillText("● REC", size - 28, 22);

        const { data, width, height } = ctx.getImageData(0, 0, size, size);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: 8 });
      }

      gif.finish();
      const attachment = new AttachmentBuilder(Buffer.from(gif.bytes()), { name: `${target.username}-killcam.gif` });
      await interaction.editReply({ content: `🎯 **${target.displayName}** got ELIMINATED!\n> ${weapon}`, files: [attachment] });
    } catch (err) {
      console.error("Killcam error:", err);
      await interaction.editReply("❌ Failed to generate killcam.");
    }
  }
});
