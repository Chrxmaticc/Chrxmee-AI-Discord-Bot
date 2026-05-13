const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

module.exports = new ChrxCommandBuilder({
  name: "profile-globe",
  description: "Turn someone's avatar into a spinning globe!",
  cooldown: 15,
  options: [
    { name: "target", description: "Who's getting globed?", type: "user", required: true },
    { name: "sides", description: "Avatar on all sides or just the front?", type: "string", required: false,
      choices: [{ name: "🌍 All Sides", value: "all" }, { name: "🌎 Front Only", value: "front" }] },
    { name: "speed", description: "How fast should it spin?", type: "string", required: false,
      choices: [{ name: "🐢 Slow", value: "slow" }, { name: "🚶 Normal", value: "normal" }, { name: "🏃 Fast", value: "fast" }] }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target");
    const sides = interaction.options.getString("sides") || "all";
    const speed = interaction.options.getString("speed") || "normal";
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 256 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 256, frames = 30;
      const delays = { slow: 8, normal: 5, fast: 3 };
      const delay = delays[speed];
      const cx = size / 2, cy = size / 2, radius = size / 2;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;
        
        // Clear with transparency
        ctx.clearRect(0, 0, size, size);

        // Clip EVERYTHING to the circle (globe shape)
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
        ctx.clip();

        if (sides === "all") {
          // === ALL SIDES: avatar wraps around as sphere rotates ===
          
          // Front face (when facing camera)
          const frontScale = Math.cos(angle);
          const frontWidth = size * Math.abs(frontScale);
          const frontX = cx - frontWidth / 2;
          
          if (frontWidth > 2) {
            ctx.save();
            if (frontScale < 0) {
              // Back of sphere - flip horizontally
              ctx.translate(cx * 2, 0);
              ctx.scale(-1, 1);
              ctx.globalAlpha = Math.abs(frontScale);
              ctx.drawImage(avatar, cx * 2 - frontX - frontWidth, 0, frontWidth, size);
            } else {
              ctx.globalAlpha = frontScale;
              ctx.drawImage(avatar, frontX, 0, frontWidth, size);
            }
            ctx.restore();
          }

          // Back face visible through (when semi-transparent sides)
          const backScale = Math.cos(angle + Math.PI);
          const backWidth = size * Math.abs(backScale);
          const backX = cx - backWidth / 2;
          
          if (backWidth > 2 && Math.abs(frontScale) < 0.95) {
            ctx.save();
            ctx.globalAlpha = Math.abs(backScale) * 0.5;
            if (backScale < 0) {
              ctx.translate(cx * 2, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(avatar, cx * 2 - backX - backWidth, 0, backWidth, size);
            } else {
              ctx.drawImage(avatar, backX, 0, backWidth, size);
            }
            ctx.restore();
          }

        } else {
          // === FRONT ONLY: only visible when facing camera ===
          const facingCamera = Math.cos(angle) > 0;
          
          if (facingCamera) {
            const scaleX = Math.cos(angle);
            const avatarWidth = size * scaleX;
            const avatarX = cx - avatarWidth / 2;
            
            ctx.drawImage(avatar, avatarX, 0, avatarWidth, size);
          }
        }

        ctx.restore();

        // Subtle sphere outline
        ctx.beginPath();
        ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Light reflection (specular highlight)
        ctx.beginPath();
        ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fill();

        const { data, width, height } = ctx.getImageData(0, 0, size, size);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay });
      }

      gif.finish();
      const speedLabels = { slow: "🐢", normal: "🚶", fast: "🏃" };
      const sidesLabels = { all: "🌍 all sides", front: "🌎 front only" };
      const attachment = new AttachmentBuilder(Buffer.from(gif.bytes()), { name: `${target.username}-globe.gif` });
      await interaction.editReply({ content: `${sidesLabels[sides]} | ${speedLabels[speed]} **${target.displayName}** is now a GLOBE!`, files: [attachment] });
    } catch (err) {
      console.error("Globe error:", err);
      await interaction.editReply("❌ Failed to generate globe GIF.");
    }
  }
});
