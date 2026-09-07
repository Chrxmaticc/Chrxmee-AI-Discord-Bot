const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { Pool } = require("pg");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
};

function replaceVariables(str, member, guild) {
  const replacements = {
    "{user}": member.user.username,
    "{mention}": `<@${member.id}>`,
    "{server}": guild.name,
    "{membercount}": guild.memberCount,
    "{joindate}": member.joinedAt ? member.joinedAt.toLocaleDateString() : "unknown",
    "{accountage}": member.user.createdAt ? Math.floor((Date.now() - member.user.createdAt) / (1000 * 60 * 60 * 24)) + " days" : "unknown",
  };
  return Object.entries(replacements).reduce((acc, [key, val]) => acc.replaceAll(key, String(val)), str);
}

async function generateWelcomeCard(member, settings) {
  const width = 800;
  const height = 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  if (settings.background_url) {
    try {
      const bg = await loadImage(settings.background_url);
      ctx.drawImage(bg, 0, 0, width, height);
    } catch {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, "#111111");
      grad.addColorStop(1, "#d2b48c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#111111");
    grad.addColorStop(1, "#d2b48c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // Server icon
  try {
    const iconUrl = member.guild.iconURL({ extension: "png", size: 128 });
    if (iconUrl) {
      const icon = await loadImage(iconUrl);
      ctx.drawImage(icon, 20, 20, 80, 80);
    }
  } catch {}

  // Avatar
  const avatarUrl = member.user.displayAvatarURL({ extension: "png", size: 256 });
  const avatar = await loadImage(avatarUrl);
  ctx.save();
  ctx.beginPath();
  ctx.arc(400, 160, 80, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatar, 320, 80, 160, 160);
  ctx.restore();

  // Username
  ctx.fillStyle = "#e8e8e8";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(member.user.username, 400, 290);

  // Message
  ctx.fillStyle = "#d2b48c";
  ctx.font = "24px sans-serif";
  ctx.fillText("welcome!", 400, 340);

  return canvas.toBuffer("image/png");
}

module.exports = {
  name: "guildMemberAdd",
  async execute(member) {
    const guild = member.guild;
    try {
      const settingsRes = await pool.query(
        `SELECT * FROM welcome_settings WHERE guild_id = $1`,
        [guild.id]
      );
      if (!settingsRes.rows[0] || !settingsRes.rows[0].enabled) return;

      const settings = settingsRes.rows[0];
      const channel = guild.channels.cache.get(settings.channel_id);
      if (!channel) return;

      // Auto role
      if (settings.auto_role_id) {
        const role = guild.roles.cache.get(settings.auto_role_id);
        if (role) await member.roles.add(role, "welcome auto role").catch(() => {});
      }

      // Select message
      let messageText = settings.message_template;
      if (settings.random_messages_enabled) {
        const randomRes = await pool.query(
          `SELECT message FROM welcome_random_messages WHERE guild_id = $1 ORDER BY random() LIMIT 1`,
          [guild.id]
        );
        if (randomRes.rows.length > 0) {
          messageText = randomRes.rows[0].message;
        }
      }
      const finalMessage = replaceVariables(messageText, member, guild);

      // Build embed if enabled
      let embed = null;
      if (settings.embed_enabled) {
        embed = new EmbedBuilder()
          .setColor(parseInt(settings.embed_color || "7c7ce0", 16))
          .setTitle(settings.embed_title || null)
          .setDescription(finalMessage)
          .setFooter({ text: settings.embed_footer || "chromed" })
          .setTimestamp();
      }

      // Button row if enabled
      let components = [];
      if (settings.button_enabled && settings.button_url) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel(settings.button_label || "click here")
            .setStyle(ButtonStyle.Link)
            .setURL(settings.button_url)
        );
        components.push(row);
      }

      // Image card if enabled
      let files = [];
      if (settings.image_enabled) {
        const buffer = await generateWelcomeCard(member, settings);
        files.push({ attachment: buffer, name: "welcome.png" });
      }

      // Attachments from DB
      const attRes = await pool.query(
        `SELECT url FROM welcome_attachments WHERE guild_id = $1`,
        [guild.id]
      );
      for (const row of attRes.rows) {
        files.push({ attachment: row.url, name: "attachment.png" });
      }

      const payload = {};
      if (embed) payload.embeds = [embed];
      else payload.content = finalMessage;
      if (files.length) payload.files = files;
      if (components.length) payload.components = components;

      await channel.send(payload).catch(() => {});
    } catch (err) {
      console.error("welcome event error:", err.message);
    }
  },
};
