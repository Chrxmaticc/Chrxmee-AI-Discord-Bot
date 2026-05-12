const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder");

module.exports = new ChrxCommandBuilder({
  name: "profile-killcam",
  description: "Call of Duty style killcam with someone's avatar",
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

      const width = 500;
      const height = 300;
      const frames = 20;
      const delay = 80;

      const encoder = new GIFEncoder(width, height);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      const chunks = [];
      encoder.createReadStream().on("data", chunk => chunks.push(chunk));
      const gifPromise = new Promise(resolve => {
        encoder.createReadStream().on("end", () => resolve(Buffer.concat(chunks)));
      });

      encoder.start();
      encoder.setRepeat(0);
      encoder.setDelay(delay);
      encoder.setQuality(10);

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, width, height);

        // Dark background
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, width, height);

        // Scanlines
        for (let y = 0; y < height; y += 3) {
          ctx.fillStyle = "rgba(255,255,255,0.02)";
          ctx.fillRect(0, y, width, 1);
        }

        // Vignette
        const gradient = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 400);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.6)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Static noise effect
        if (Math.random() > 0.7) {
          ctx.fillStyle = "rgba(255,255,255,0.03)";
          ctx.fillRect(0, 0, width, height);
        }

        // Glitch line occasionally
        if (Math.random() > 0.8) {
          const glitchY = Math.random() * height;
          ctx.fillStyle = "rgba(0,255,0,0.15)";
          ctx.fillRect(0, glitchY, width, Math.random() * 5 + 2);
        }

        // Avatar (slightly zoomed in over time)
        const zoom = 1 + (i / frames) * 0.1;
        const avatarSize = 180 * zoom;
        const ax = width / 2 - avatarSize / 2;
        const ay = height / 2 - avatarSize / 2;

        // Red tint overlay for "eliminated" feel
        ctx.save();
        ctx.drawImage(avatar, ax, ay, avatarSize, avatarSize);
        ctx.fillStyle = "rgba(255,0,0,0.2)";
        ctx.fillRect(ax, ay, avatarSize, avatarSize);
        ctx.restore();

        // Crosshair
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(width / 2 - 30, height / 2);
        ctx.lineTo(width / 2 - 10, height / 2);
        ctx.moveTo(width / 2 + 10, height / 2);
        ctx.lineTo(width / 2 + 30, height / 2);
        ctx.stroke();
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(width / 2, height / 2 - 30);
        ctx.lineTo(width / 2, height / 2 - 10);
        ctx.moveTo(width / 2, height / 2 + 10);
        ctx.lineTo(width / 2, height / 2 + 30);
        ctx.stroke();

        // "ELIMINATED" text
        ctx.fillStyle = "#ff1a1a";
        ctx.font = "bold 40px Impact, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ELIMINATED", width / 2, 50);

        // Name
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 25px sans-serif";
        ctx.fillText(target.displayName, width / 2, 85);

        // Weapon
        ctx.fillStyle = "#cccccc";
        ctx.font = "18px monospace";
        ctx.fillText(weapon, width / 2, height - 40);

        // Bottom bar
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, height - 25, width, 25);
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "left";
        ctx.fillText("KILLCAM", 15, height - 7);

        // Flashing red dot
        const dotAlpha = Math.sin(i * 0.8) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,0,0,${dotAlpha})`;
        ctx.beginPath();
        ctx.arc(width - 20, 15, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.font = "10px monospace";
        ctx.textAlign = "right";
        ctx.fillText("● REC", width - 35, 19);

        encoder.addFrame(ctx);
      }

      encoder.finish();

      const gifBuffer = await gifPromise;
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-killcam.gif` });

      await interaction.editReply({
        content: `🎯 **${target.displayName}** got ELIMINATED!\n> ${weapon}`,
        files: [attachment],
      });

    } catch (err) {
      console.error("Killcam error:", err);
      await interaction.editReply("❌ Failed to generate killcam.");
    }
  }
});
