const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("@zorner/gifencoder");

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
      const size = 256, gridSize = 16, cols = size/gridSize, rows = size/gridSize;
      const totalBlocks = cols * rows, frames = 25;

      const blockOrder = Array.from({length: totalBlocks}, (_, i) => i);
      for (let i = blockOrder.length-1; i > 0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [blockOrder[i], blockOrder[j]] = [blockOrder[j], blockOrder[i]];
      }

      const encoder = new GIFEncoder(size, size);
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      const chunks = [];
      encoder.createReadStream().on("data", chunk => chunks.push(chunk));
      const gifPromise = new Promise(resolve => {
        encoder.createReadStream().on("end", () => resolve(Buffer.concat(chunks)));
      });

      encoder.start(); encoder.setRepeat(0); encoder.setDelay(50); encoder.setQuality(10);
      const blocksPerFrame = Math.ceil(totalBlocks/frames);

      for (let i = 0; i < frames; i++) {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(avatar, 0, 0, size, size);

        const deletedCount = Math.min((i+1)*blocksPerFrame, totalBlocks);
        const colors = ["#ff0000","#00ff00","#0000ff","#ffff00","#ff00ff","#00ffff","#000000","#ffffff"];

        for (let j = 0; j < deletedCount; j++) {
          const blockIndex = blockOrder[j];
          const col = blockIndex % cols, row = Math.floor(blockIndex/cols);
          ctx.fillStyle = colors[Math.floor(Math.random()*colors.length)];
          ctx.fillRect(col*gridSize, row*gridSize, gridSize, gridSize);
        }

        ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 0.5;
        for (let y = 0; y < size; y += gridSize) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(size,y); ctx.stroke(); }
        for (let x = 0; x < size; x += gridSize) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,size); ctx.stroke(); }

        const progress = (i+1)/frames;
        ctx.fillStyle = "rgba(0,0,0,0.8)"; ctx.fillRect(0, size-20, size, 20);
        ctx.fillStyle = "#ff1a1a"; ctx.fillRect(0, size-20, size*progress, 20);
        ctx.fillStyle = "#ffffff"; ctx.font = "bold 12px monospace"; ctx.textAlign = "center";
        ctx.fillText(`DELETING... ${Math.floor(progress*100)}%`, size/2, size-5);

        encoder.addFrame(ctx);
      }

      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "#ff1a1a"; ctx.font = "bold 30px Impact, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("DELETED", size/2, size/2);
      ctx.fillStyle = "#ffffff"; ctx.font = "14px monospace";
      ctx.fillText(target.displayName, size/2, size/2+30);
      encoder.addFrame(ctx);

      encoder.finish();
      const gifBuffer = await gifPromise;
      const attachment = new AttachmentBuilder(gifBuffer, { name: `${target.username}-deleted.gif` });
      await interaction.editReply({ content: `🗑️ **${target.displayName}** has been DELETED.`, files: [attachment] });
    } catch (err) {
      console.error("Delete error:", err);
      await interaction.editReply("❌ Failed to delete avatar.");
    }
  }
});
