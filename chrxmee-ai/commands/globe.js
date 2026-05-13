const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("@zorner/gifencoder");

module.exports = new ChrxCommandBuilder({
  name: "profile-globe",
  description: "Turn someone's avatar into a spinning globe!",
  cooldown: 15,
  options: [
    { name: "target", description: "Who's getting globed?", type: "user", required: true },
    { 
      name: "sides", 
      description: "Avatar on all sides or just the front?", 
      type: "string", 
      required: false,
      choices: [
        { name: "🌍 All Sides", value: "all" },
        { name: "🌎 Front Only", value: "front" }
      ]
    },
    {
      name: "speed",
      description: "How fast should it spin?",
      type: "string",
      required: false,
      choices: [
        { name: "🐢 Slow", value: "slow" },
        { name: "🚶 Normal", value: "normal" },
        { name: "🏃 Fast", value: "fast" }
      ]
    }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target");
    const sides = interaction.options.getString("sides") || "all";
    const speed = interaction.options.getString("speed") || "normal";
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 256 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 300, frames = 30;
      const delays = { slow: 60, normal: 40, fast: 25 };
      const delay = delays[speed];

      const encoder = new GIFEncoder(size, size);
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      const chunks = [];
      encoder.createReadStream().on("data", chunk => chunks.push(chunk));
      const gifPromise = new Promise(resolve => {
        encoder.createReadStream().on("end", () => resolve(Buffer.concat(chunks)));
      });

      encoder.start(); encoder.setRepeat(0); encoder.setDelay(delay); encoder.setQuality(10);

      const centerX = size/2, centerY = size/2, radius = 110;

      for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = "#0a0a1a"; ctx.fillRect(0, 0, size, size);

        // Stars
        for (let s = 0; s < 40; s++) {
          const sx = (Math.sin(s*137.5)*0.5+0.5)*size;
          const sy = (Math.cos(s*273.1)*0.5+0.5)*size;
          const brightness = 150 + Math.floor(Math.random()*105);
          ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
          ctx.fillRect(sx, sy, 2, 2);
        }

        // Globe shadow
        ctx.beginPath(); ctx.arc(centerX+5, centerY+5, radius, 0, Math.PI*2);
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fill();

        // Globe body
        ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
        ctx.fillStyle = "#1a3a5c"; ctx.fill();

        // Longitude lines
        for (let lon = 0; lon < 6; lon++) {
          const lonAngle = (lon/6)*Math.PI*2 + angle;
          ctx.beginPath(); ctx.ellipse(centerX, centerY, radius, radius*0.35, lonAngle, 0, Math.PI*2);
          ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 1; ctx.stroke();
        }

        // Latitude lines
        for (let lat = 0; lat < 4; lat++) {
          const latOffset = (lat/4-0.5)*radius*2;
          const latRadius = Math.sqrt(radius*radius - latOffset*latOffset);
          ctx.beginPath(); ctx.ellipse(centerX, centerY+latOffset, latRadius, 4, 0, 0, Math.PI*2);
          ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.stroke();
        }

        // Avatar mapping
        const facingCamera = Math.cos(angle) > -0.2;
        if (sides === "all" || (sides === "front" && facingCamera)) {
          ctx.save();
          ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI*2); ctx.clip();

          const scaleX = Math.cos(angle);
          const avatarWidth = radius*2*Math.abs(scaleX);
          const avatarX = centerX - avatarWidth/2;

          if (avatarWidth > 5) {
            ctx.globalAlpha = sides === "all" ? 1 : Math.max(0, scaleX);
            ctx.drawImage(avatar, avatarX, centerY-radius, avatarWidth, radius*2);
            ctx.globalAlpha = 1;
          }
          ctx.restore();
        }

        // Globe outline
        ctx.beginPath(); ctx.arc(centerX, centerY, radius, 0, Math.PI*2);
        ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2; ctx.stroke();

        // Specular highlight
        ctx.beginPath(); ctx.arc(centerX-radius*0.35, centerY-radius*0.35, radius*0.25, 0, Math.PI*2);
        ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill();

        encoder.addFrame(ctx);
      }

      encoder.finish();
      const gifBuffer = await gifPromise;
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-globe.gif` });

      const speedLabels = { slow: "🐢", normal: "🚶", fast: "🏃" };
      const sidesLabels = { all: "🌍 all sides", front: "🌎 front only" };

      await interaction.editReply({
        content: `${sidesLabels[sides]} | ${speedLabels[speed]} **${target.displayName}** is now a GLOBE!`,
        files: [attachment],
      });
    } catch (err) {
      console.error("Globe error:", err);
      await interaction.editReply("❌ Failed to generate globe GIF.");
    }
  }
});
