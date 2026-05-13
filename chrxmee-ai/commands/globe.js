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
      const size = 256, frames = 24;
      const delays = { slow: 8, normal: 5, fast: 3 };
      const delay = delays[speed];
      const cx = size/2, cy = size/2, radius = 90;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "#0a0a1a"; ctx.fillRect(0, 0, size, size);

        for (let s = 0; s < 15; s++) {
          const sx = (Math.sin(s*137.5)*0.5+0.5)*size;
          const sy = (Math.cos(s*273.1)*0.5+0.5)*size;
          ctx.fillStyle = `rgb(${180},${180},${180})`; ctx.fillRect(sx, sy, 1.5, 1.5);
        }

        ctx.beginPath(); ctx.arc(cx+4, cy+4, radius, 0, Math.PI*2);
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2);
        ctx.fillStyle = "#1a3a5c"; ctx.fill();

        for (let lon = 0; lon < 4; lon++) {
          ctx.beginPath(); ctx.ellipse(cx, cy, radius, radius*0.3, (lon/4)*Math.PI*2+angle, 0, Math.PI*2);
          ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.stroke();
        }
        for (let lat = 0; lat < 3; lat++) {
          const lo = (lat/3-0.5)*radius*2;
          const lr = Math.sqrt(radius*radius-lo*lo);
          ctx.beginPath(); ctx.ellipse(cx, cy+lo, lr, 3, 0, 0, Math.PI*2);
          ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; ctx.stroke();
        }

        const facing = Math.cos(angle) > -0.2;
        if (sides === "all" || (sides === "front" && facing)) {
          ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.clip();
          const sx = Math.cos(angle), aw = radius*2*Math.abs(sx), ax = cx-aw/2;
          if (aw > 5) { ctx.globalAlpha = sides==="all"?1:Math.max(0,sx); ctx.drawImage(avatar, ax, cy-radius, aw, radius*2); ctx.globalAlpha=1; }
          ctx.restore();
        }

        ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2);
        ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx-radius*0.3, cy-radius*0.3, radius*0.2, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fill();

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
