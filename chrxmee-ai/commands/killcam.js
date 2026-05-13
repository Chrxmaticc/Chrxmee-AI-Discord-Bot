const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

module.exports = new ChrxCommandBuilder({
  name: "profile-killcam",
  description: "CoD style killcam with someone's avatar",
  cooldown: 12,
  options: [
    { name: "target", description: "Who got eliminated?", type: "user", required: false },
    { name: "weapon", description: "What took them out?", type: "string", required: false }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target") || interaction.user;
    const weapon = interaction.options.getString("weapon") || "💀 Unknown Weapon";
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 512 });

    try {
      const avatar = await loadImage(avatarURL);
      const w = 800, h = 480, frames = 16;

      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, w, h);

        for (let y = 0; y < h; y += 4) {
          ctx.fillStyle = "rgba(255,255,255,0.02)";
          ctx.fillRect(0, y, w, 1);
        }

        const grad = ctx.createRadialGradient(w / 2, h / 2, 160, w / 2, h / 2, 600);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const zoom = 1 + (i / frames) * 0.08;
        const as = 300 * zoom;
        const ax = w / 2 - as / 2;
        const ay = h / 2 - as / 2;
        ctx.drawImage(avatar, ax, ay, as, as);
        ctx.fillStyle = "rgba(255,0,0,0.2)";
        ctx.fillRect(ax, ay, as, as);

        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 50, h / 2); ctx.lineTo(w / 2 - 16, h / 2);
        ctx.moveTo(w / 2 + 16, h / 2); ctx.lineTo(w / 2 + 50, h / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2 - 50); ctx.lineTo(w / 2, h / 2 - 16);
        ctx.moveTo(w / 2, h / 2 + 16); ctx.lineTo(w / 2, h / 2 + 50);
        ctx.stroke();

        ctx.fillStyle = "#ff1a1a";
        ctx.font = "bold 64px Impact, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ELIMINATED", w / 2, 80);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 40px sans-serif";
        ctx.fillText(target.displayName, w / 2, 135);
        ctx.fillStyle = "#cccccc";
        ctx.font = "28px monospace";
        ctx.fillText(weapon, w / 2, h - 60);

        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, h - 40, w, 40);
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 24px monospace";
        ctx.textAlign = "left";
        ctx.fillText("KILLCAM", 20, h - 10);

        const dotAlpha = Math.sin(i * 0.8) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,0,0,${dotAlpha})`;
        ctx.beginPath();
        ctx.arc(w - 30, 25, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "18px monospace";
        ctx.textAlign = "right";
        ctx.fillText("● REC", w - 55, 32);

        const { data, width, height } = ctx.getImageData(0, 0, w, h);
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
