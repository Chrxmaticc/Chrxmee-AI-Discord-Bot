const { ChrxCommandBuilder } = require("chrxmaticc-framework");
const { AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const { encodeGif } = require("@napi-rs/canvas/gif");

module.exports = new ChrxCommandBuilder({
  name: "globe",
  description: "Turn someone's avatar into a cursed spinning globe 🌍",
  cooldown: 15,

  options: [
    {
      name: "target",
      description: "Who's becoming spherical?",
      type: "user",
      required: false,
    },
  ],

  async run(interaction) {
    await interaction.deferReply();

    const target =
      interaction.options.getUser("target") || interaction.user;

    const avatarURL = target.displayAvatarURL({
      extension: "png",
      size: 512,
    });

    try {
      const avatar = await loadImage(avatarURL);

      const size = 256;
      const frames = 32;
      const delay = 3;

      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext("2d");

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2;

      const frameBuffers = [];

      for (let i = 0; i < frames; i++) {
        const angle = (i / frames) * Math.PI * 2;

        ctx.clearRect(0, 0, size, size);

        // transparent background
        ctx.save();

        // globe clipping
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        // squish amount
        const squash = Math.cos(angle);

        // width of visible side
        const width = Math.max(8, size * Math.abs(squash));

        const x = cx - width / 2;

        ctx.save();

        // back side dimmer
        ctx.globalAlpha = 0.92;

        // flip when rotating behind
        if (squash < 0) {
          ctx.translate(size, 0);
          ctx.scale(-1, 1);
        }

        // draw stretched avatar
        ctx.drawImage(
          avatar,
          x,
          0,
          width,
          size
        );

        ctx.restore();

        // subtle shading for globe effect
        const gradient = ctx.createRadialGradient(
          cx - 40,
          cy - 40,
          20,
          cx,
          cy,
          radius
        );

        gradient.addColorStop(0, "rgba(255,255,255,0.12)");
        gradient.addColorStop(0.5, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.35)");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        ctx.restore();

        frameBuffers.push(canvas.toBuffer("image/png"));
      }

      const gifBuffer = await encodeGif(frameBuffers, {
        repeat: 0,
        delay,
      });

      const attachment = new AttachmentBuilder(gifBuffer, {
        name: `${target.username}-globe.gif`,
      });

      await interaction.editReply({
        content: `🌍 **${target.displayName}** has been globified.`,
        files: [attachment],
      });
    } catch (err) {
      console.error(err);

      await interaction.editReply({
        content: "❌ globe machine exploded",
      });
    }
  },
});
