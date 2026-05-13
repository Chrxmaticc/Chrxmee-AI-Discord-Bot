const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

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
      const w = 280, h = 320, frames = 20;

      const canvas = createCanvas(w, h);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, w, h);
        const counterGrad = ctx.createLinearGradient(0, 0, 0, h);
        counterGrad.addColorStop(0, "#3a2a1a"); counterGrad.addColorStop(1, "#1a0a00");
        ctx.fillStyle = counterGrad; ctx.fillRect(0, 0, w, h);

        const toasterY = 200, toasterH = 100;
        ctx.fillStyle = "#c0c0c0"; ctx.fillRect(35, toasterY, 210, toasterH);
        ctx.fillStyle = "#a0a0a0"; ctx.fillRect(40, toasterY+5, 200, toasterH-10);
        ctx.fillStyle = "#888888"; ctx.fillRect(45, toasterY, 190, toasterH);
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(75, toasterY-5, 130, 12);

        const progress = i/frames;
        const popHeight = Math.sin(progress*Math.PI)*90;
        const toastY = toasterY-60-popHeight;
        const burn = i > frames*0.4 ? (i-frames*0.4)/(frames*0.6) : 0;

        ctx.fillStyle = `rgb(${200+burn*55},${180-burn*100},${100-burn*80})`;
        ctx.fillRect(70, toastY, 140, 90);
        ctx.drawImage(avatar, 78, toastY+8, 124, 74);

        if (burn > 0) {
          ctx.fillStyle = `rgba(${Math.floor(burn*139)},${Math.floor(burn*69)},${Math.floor(burn*19)},${burn*0.6})`;
          ctx.fillRect(70, toastY, 140, 90);
        }

        ctx.fillStyle = "#666666"; ctx.fillRect(255, toasterY+40, 12, 24);
        ctx.fillStyle = "#ff4444"; ctx.beginPath(); ctx.arc(261, toasterY+36, 10, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Impact, sans-serif"; ctx.textAlign = "center";
        if (burn > 0.7) ctx.fillText("BURNT!", w/2, 25);
        else if (burn > 0.3) ctx.fillText("TOASTING...", w/2, 25);
        else ctx.fillText("FRESH TOAST!", w/2, 25);
        ctx.fillStyle = "#cccccc"; ctx.font = "12px monospace"; ctx.fillText(target.displayName, w/2, 45);

        const { data, width, height } = ctx.getImageData(0, 0, w, h);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: 6 });
      }

      gif.finish();
      const attachment = new AttachmentBuilder(Buffer.from(gif.bytes()), { name: `${target.username}-toast.gif` });
      await interaction.editReply({ content: `🍞 **${target.displayName}** is now BURNT TOAST!`, files: [attachment] });
    } catch (err) {
      console.error("Toast error:", err);
      await interaction.editReply("❌ Failed to make toast.");
    }
  }
});
