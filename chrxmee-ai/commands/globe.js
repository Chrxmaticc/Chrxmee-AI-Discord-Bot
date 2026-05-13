const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const GIFEncoder = require("gif-encoder-2");

module.exports = new ChrxCommandBuilder({
  name: "profile-globe",
  description: "Turn someone's avatar into a spinning globe!",
  cooldown: 15,

  options: [
    {
      name: "target",
      description: "Who's getting globed?",
      type: "user",
      required: true,
    },
    {
      name: "sides",
      description: "Avatar on all sides or just the front?",
      type: "string",
      required: false,
      choices: [
        { name: "🌍 All Sides", value: "all" },
        { name: "🌎 Front Only", value: "front" },
      ],
    },
  ],

  async run(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("target");
    const sides = interaction.options.getString("sides") || "all";

    const avatarURL = target.displayAvatarURL({
      extension: "png",
      size: 256,
    });

    try {
      const avatar = await loadImage(avatarURL);

      const size = 256;
      const frames = 24;
      const delay = 50; // gif-encoder-2 uses ms (50ms = 20fps)

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 2;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      // Initialize gif-encoder-2
      const encoder = new GIFEncoder(size, size);
      encoder.start();
      encoder.setRepeat(0);
      encoder.setDelay(delay);
      encoder.setTransparent(0x00000000); // Handle transparency if needed

      for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;

        ctx.clearRect(0, 0, size, size);

        ctx.save();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        const frontScale = Math.cos(angle);

        if (sides === "all") {
          const frontWidth = size * Math.abs(frontScale);
          const frontX = cx - frontWidth / 2;

          if (frontWidth > 2) {
            ctx.save();
            ctx.globalAlpha = Math.abs(frontScale);

            if (frontScale < 0) {
              ctx.translate(size, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(avatar, frontX, 0, frontWidth, size);
            } else {
              ctx.drawImage(avatar, frontX, 0, frontWidth, size);
            }
            ctx.restore();
          }
        } else {
          if (frontScale > 0) {
            const frontWidth = size * frontScale;
            const frontX = cx - frontWidth / 2;
            ctx.drawImage(avatar, frontX, 0, frontWidth, size);
          }
        }

        ctx.restore();

        // Add the current canvas frame to the encoder
        encoder.addFrame(ctx);
      }

      encoder.finish();
      const gifBuffer = encoder.out.getData();

      const attachment = new AttachmentBuilder(gifBuffer, {
        name: `${target.username}-globe.gif`,
      });

      const sidesLabels = {
        all: "🌍 all sides",
        front: "🌎 front only",
      };

      await interaction.editReply({
        content: `${sidesLabels[sides]} **${target.displayName}** is now a GLOBE!`,
        files: [attachment],
      });

    } catch (err) {
      console.error("Globe error:", err);
      await interaction.editReply("❌ Failed to generate globe GIF.");
    }
  },
});
