const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("@zorner/gifencoder");

module.exports = new ChrxCommandBuilder({
  name: "profile-toast",
  description: "Turn someone into burnt toast",
  cooldown: 12,
  options: [
    { name: "target", description: "Who's getting toasted?", type: "user", required: true }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target");
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 256 });

    try {
      const avatar = await loadImage(avatarURL);
      const width = 350, height = 400, frames = 30, delay = 60;

      const encoder = new GIFEncoder(width, height);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      const chunks = [];
      encoder.createReadStream().on("data", chunk => chunks.push(chunk));
      const gifPromise = new Promise(resolve => {
        encoder.createReadStream().on("end", () => resolve(Buffer.concat(chunks)));
      });

      encoder.start(); encoder.setRepeat(0); encoder.setDelay(delay); encoder.setQuality(10);

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, width, height);

        // Counter
        ctx.fillStyle = "#2a1a0a"; ctx.fillRect(0, 0, width, height);
        const counterGrad = ctx.createLinearGradient(0, 0, 0, height);
        counterGrad.addColorStop(0, "#3a2a1a"); counterGrad.addColorStop(1, "#1a0a00");
        ctx.fillStyle = counterGrad; ctx.fillRect(0, 0, width, height);

        // Toaster body
        const toasterY = 250, toasterH = 130;
        ctx.fillStyle = "#c0c0c0";
        ctx.fillRect(50, toasterY, 250, toasterH);
        ctx.fillStyle = "#a0a0a0";
        ctx.fillRect(55, toasterY+5, 240, toasterH-10);
        ctx.fillStyle = "#888888";
        ctx.fillRect(60, toasterY, 230, toasterH);

        // Toaster slot
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(100, toasterY-5, 150, 15);

        // Toast popping up
        const progress = i / frames;
        const popHeight = Math.sin(progress * Math.PI) * 120;
        const toastY = toasterY - 80 - popHeight;
        const burnLevel = i > frames * 0.4 ? (i - frames * 0.4) / (frames * 0.6) : 0;

        // Toast slice
        ctx.fillStyle = `rgb(${200 + burnLevel*55}, ${180 - burnLevel*100}, ${100 - burnLevel*80})`;
        ctx.fillRect(95, toastY, 160, 110);

        // Avatar as "burnt face" on toast
        ctx.drawImage(avatar, 105, toastY+10, 140, 90);

        // Burn overlay
        if (burnLevel > 0) {
          ctx.fillStyle = `rgba(${Math.floor(burnLevel*139)},${Math.floor(burnLevel*69)},${Math.floor(burnLevel*19)},${burnLevel*0.6})`;
          ctx.fillRect(95, toastY, 160, 110);
        }

        // Smoke particles
        if (burnLevel > 0.5) {
          for (let s = 0; s < 5; s++) {
            const sx = 120 + Math.sin(s*2.7 + i*0.3)*40;
            const sy = toastY - 20 - s*15 - i*2;
            ctx.fillStyle = `rgba(100,100,100,${0.3 - s*0.05})`;
            ctx.beginPath(); ctx.arc(sx, sy, 5 + s*2, 0, Math.PI*2); ctx.fill();
          }
        }

        // Lever
        ctx.fillStyle = "#666666";
        ctx.fillRect(310, toasterY+50, 15, 30);
        ctx.fillStyle = "#ff4444";
        ctx.beginPath(); ctx.arc(317, toasterY+45, 12, 0, Math.PI*2); ctx.fill();

        // Text
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 20px Impact, sans-serif"; ctx.textAlign = "center";
        if (burnLevel > 0.7) ctx.fillText("BURNT!", width/2, 30);
        else if (burnLevel > 0.3) ctx.fillText("TOASTING...", width/2, 30);
        else ctx.fillText("FRESH TOAST!", width/2, 30);

        ctx.fillStyle = "#cccccc"; ctx.font = "14px monospace";
        ctx.fillText(target.displayName, width/2, 55);

        encoder.addFrame(ctx);
      }

      encoder.finish();
      const gifBuffer = await gifPromise;
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-toast.gif` });
      await interaction.editReply({ content: `🍞 **${target.displayName}** is now BURNT TOAST!`, files: [attachment] });
    } catch (err) {
      console.error("Toast error:", err);
      await interaction.editReply("❌ Failed to make toast.");
    }
  }
});
