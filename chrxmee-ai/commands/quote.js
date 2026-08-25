const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  cringe_laugh: "<:Cringe_Laughing_Son:1526539082564374710>",
  point_laugh: "<:PointAndLaughingEmoji:1525657154567016469>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("quote")
    .setDescription("turn a message into a quote card")
    .addStringOption(opt =>
      opt.setName("text")
        .setDescription("the message to quote")
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName("user")
        .setDescription("whose pfp to use (defaults to you)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const text = interaction.options.getString("text");
    const target = interaction.options.getUser("user") || interaction.user;

    try {
      // create canvas
      const width = 800;
      const height = 400;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      // background gradient (periwinkle to black)
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, "#7c7ce0"); // periwinkle
      gradient.addColorStop(1, "#111111"); // black
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // load pfp
      const pfpUrl = target.displayAvatarURL({ extension: "png", size: 256 });
      const pfp = await loadImage(pfpUrl);

      // draw pfp circular on left
      const pfpSize = 160;
      const pfpX = 60;
      const pfpY = height / 2 - pfpSize / 2;

      ctx.save();
      ctx.beginPath();
      ctx.arc(pfpX + pfpSize / 2, pfpY + pfpSize / 2, pfpSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(pfp, pfpX, pfpY, pfpSize, pfpSize);
      ctx.restore();

      // pfp border
      ctx.beginPath();
      ctx.arc(pfpX + pfpSize / 2, pfpY + pfpSize / 2, pfpSize / 2 + 2, 0, Math.PI * 2);
      ctx.strokeStyle = "#d2b48c";
      ctx.lineWidth = 4;
      ctx.stroke();

      // quote text
      ctx.fillStyle = "#e8e8e8";
      ctx.font = "bold 28px sans-serif";
      ctx.textBaseline = "middle";

      // wrap text
      const maxWidth = width - pfpX - pfpSize - 80;
      const words = text.split(" ");
      let lines = [];
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // limit to 4 lines
      lines = lines.slice(0, 4);
      const lineHeight = 36;
      const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

      lines.forEach((line, i) => {
        ctx.fillText(line, pfpX + pfpSize + 40, startY + i * lineHeight);
      });

      // add small username
      ctx.fillStyle = "#d2b48c";
      ctx.font = "16px sans-serif";
      ctx.fillText(`— ${target.username}`, pfpX + pfpSize + 40, height - 50);

      // convert to buffer
      const buffer = canvas.toBuffer("image/png");
      const attachment = new AttachmentBuilder(buffer, { name: "quote.png" });

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} quote card`)
        .setDescription(`${E.success} here's your quote`)
        .setImage("attachment://quote.png")
        .setFooter({ text: "keep quoting." })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed], files: [attachment] }).catch(() => interaction.followUp({ embeds: [embed], files: [attachment] }));

    } catch (err) {
      console.error("quote error:", err);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${E.error} quote failed`)
        .setDescription(`${E.angry} something went wrong: ${err.message}`);
      return interaction.editReply({ embeds: [errorEmbed] }).catch(() => interaction.followUp({ embeds: [errorEmbed] }));
    }
  },
};
