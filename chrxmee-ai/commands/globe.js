const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");

module.exports = new ChrxCommandBuilder({
  name: "profile-globe",
  description: "Turn someone's avatar into a cursed spinning globe 🌍",
  cooldown: 15,
  options: [
    { name: "target", description: "Who's becoming spherical?", type: "user", required: false }
  ],
  async run(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser("target") || interaction.user;
    const avatarURL = target.displayAvatarURL({ extension: "png", size: 512 });

    try {
      const avatar = await loadImage(avatarURL);
      const size = 256;
      const frames = 30; // Smooth rotation
      const delay = 40; 

      const encoder = new GIFEncoder(size, size, "octree", true);
      encoder.setQuality(10);
      encoder.setRepeat(0);
      encoder.setDelay(delay);
      encoder.setTransparent(0x000000); // Sets black as transparent
      encoder.start();

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");
      const radius = size / 2;

      for (let i = 0; i < frames; i++) {
        // Clear with true black for the transparency to work
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, size, size);
        
        const angle = (i / frames) * Math.PI * 2;

        ctx.save();
        // Create the circular mask
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.clip();

        // SPHERIZE LOGIC: Draw slices to create the bulge effect
        const progress = Math.cos(angle);
        const direction = Math.sin(angle) > 0 ? 1 : -1;

        // Determine actual width based on rotation
        const currentWidth = size * Math.abs(progress);
        const xOffset = (size - currentWidth) / 2;

        ctx.save();
        // Flip image logic for the "back" of the spin
        if (progress < 0) {
          ctx.translate(size, 0);
          ctx.scale(-1, 1);
        }

        // Draw the warped image
        // To get that exact look, we use the standard scaling but keep globalAlpha high
        ctx.globalAlpha = 1.0;
        ctx.drawImage(avatar, xOffset, 0, currentWidth, size);
        ctx.restore();

        // Add shading/overlay to match the reference
        const gradient = ctx.createRadialGradient(
          radius - 30, radius - 30, 10, 
          radius, radius, radius
        );
        gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
        gradient.addColorStop(0.6, "rgba(0, 0, 0, 0)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0.5)");
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        ctx.restore();

        encoder.addFrame(ctx);
      }

      encoder.finish();
      const gifBuffer = encoder.out.getData();
      const attachment = new AttachmentBuilder(gifBuffer, { name: `globe.gif` });
      
      await interaction.editReply({ 
        content: `🌍 **${target.displayName}** has been globified.`, 
        files: [attachment] 
      });

    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: "❌ globe machine exploded" });
    }
  }
});
