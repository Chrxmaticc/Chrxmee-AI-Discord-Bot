const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");

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
      const w = 400, h = 240, frames = 16;

      const encoder = new GIFEncoder(w, h, "neuquant", false);
      encoder.start();
      encoder.setRepeat(0);
      encoder.setDelay(80);
      encoder.setQuality(10);

      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d");

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, w, h);

        for (let y = 0; y < h; y += 4) {
          ctx.fillStyle = "rgba(255,255,255,0.02)";
          ctx.fillRect(0, y, w, 1);
        }

        const grad = ctx.createRadialGradient(w / 2, h / 2, 80, w / 2, h / 2, 300);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.5)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const zoom = 1 + (i / frames) * 0.08;
        const as = 150 * zoom;
        const ax = w / 2 - as / 2;
        const ay = h / 2 - as / 2;
        ctx.drawImage(avatar, ax, ay, as, as);
        ctx.fillStyle = "rgba(255,0,0,0.2)";
        ctx.fillRect(ax, ay, as, as);

        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 25, h / 2); ctx.lineTo(w / 2 - 8, h / 2);
        ctx.moveTo(w / 2 + 8, h / 2); ctx.lineTo(w / 2 + 25, h / 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2 - 25); ctx.lineTo(w / 2, h / 2 - 8);
        ctx.moveTo(w / 2, h / 2 + 8); ctx.lineTo(w / 2, h / 2 + 25);
        ctx.stroke();

        ctx.fillStyle = "#ff1a1a";
        ctx.font = "bold 32px Impact, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ELIMINATED", w / 2, 40);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px sans-serif";
        ctx.fillText(target.displayName, w / 2, 66);
        ctx.fillStyle = "#cccccc";
        ctx.font = "14px monospace";
        ctx.fillText(weapon, w / 2, h - 30);

        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, h - 20, w, 20);
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "left";
        ctx.fillText("KILLCAM", 10, h - 5);

        const dotAlpha = Math.sin(i * 0.8) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,0,0,${dotAlpha})`;
        ctx.beginPath();
        ctx.arc(w - 15, 12, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "9px monospace";
        ctx.textAlign = "right";
        ctx.fillText("● REC", w - 28, 16);

        encoder.addFrame(ctx);
      }

      encoder.finish();
      const gifBuffer = encoder.out.getData();
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-killcam.gif` });
      await interaction.editReply({ content: `🎯 **${target.displayName}** got ELIMINATED!\n> ${weapon}`, files: [attachment] });
    } catch (err) {
      console.error("Killcam error:", err);
      await interaction.editReply("❌ Failed to generate killcam.");
    }
  }
});
