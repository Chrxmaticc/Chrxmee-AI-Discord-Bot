const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

module.exports = new ChrxCommandBuilder({
  name: "profile-delete",
  description: "Delete someone's avatar pixel by pixel",
  cooldown: 12,
  options: [
    { name: "target", description: "Who's getting deleted?", type: "user", required: true }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target");
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 256 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 256, grid = 16, cols = size/grid, rows = size/grid;
      const total = cols*rows, frames = 20, bpf = Math.ceil(total/frames);

      const order = Array.from({length: total}, (_, i) => i);
      for (let i = order.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [order[i], order[j]] = [order[j], order[i]]; }

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const gif = GIFEncoder();
      const colors = ["#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff","#000000","#ffffff"];

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(avatar, 0, 0, size, size);
        const del = Math.min((i+1)*bpf, total);

        for (let j = 0; j < del; j++) {
          const idx = order[j], col = idx%cols, row = Math.floor(idx/cols);
          ctx.fillStyle = colors[Math.floor(Math.random()*colors.length)];
          ctx.fillRect(col*grid, row*grid, grid, grid);
        }

        const prog = (i+1)/frames;
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0, size-20, size, 20);
        ctx.fillStyle = "#ff1a1a"; ctx.fillRect(0, size-20, size*prog, 20);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
        ctx.fillText(`DELETING... ${Math.floor(prog*100)}%`, size/2, size-5);

        const { data, width, height } = ctx.getImageData(0, 0, size, size);
        const palette = quantize(data, 256);
        gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: 5 });
      }

      ctx.clearRect(0, 0, size, size); ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#ff1a1a"; ctx.font = "bold 30px Impact, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("DELETED", size/2, size/2);
      ctx.fillStyle = "#ffffff"; ctx.font = "14px monospace"; ctx.fillText(target.displayName, size/2, size/2+30);
      const { data, width, height } = ctx.getImageData(0, 0, size, size);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay: 200 });

      gif.finish();
      const attachment = new AttachmentBuilder(Buffer.from(gif.bytes()), { name: `${target.username}-deleted.gif` });
      await interaction.editReply({ content: `🗑️ **${target.displayName}** has been DELETED.`, files: [attachment] });
    } catch (err) {
      console.error("Delete error:", err);
      await interaction.editReply("❌ Failed to delete avatar.");
    }
  }
});
