const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  settings: "<:Settings:1525601248278216725>",
  trophy: "<:GiveawayTrophy:1546601598405447749>",
  star: "<:Star:1545563186017607732>",
};

function msToHours(seconds) {
  const s = Number(seconds) || 0;
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  return { hours, mins };
}

function formatNum(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return String(num);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── USER STATS CARD ───
async function buildUserCard(member, stats) {
  const W = 900, H = 320;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#050505");
  bg.addColorStop(0.65, "#111111");
  bg.addColorStop(1, "#1a1a1a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // tan glow corner
  const glow = ctx.createRadialGradient(W, H, 0, W, H, W * 0.7);
  glow.addColorStop(0, "rgba(210,180,140,0.22)");
  glow.addColorStop(1, "rgba(210,180,140,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // avatar
  const size = 160;
  const ax = 60, ay = (H - size) / 2;
  try {
    const avatar = await loadImage(
      member.user.displayAvatarURL({ extension: "png", size: 256 })
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, ax, ay, size, size);
    ctx.restore();

    // tan ring
    ctx.beginPath();
    ctx.arc(ax + size / 2, ay + size / 2, size / 2 + 3, 0, Math.PI * 2);
    ctx.strokeStyle = "#d2b48c";
    ctx.lineWidth = 3;
    ctx.stroke();
  } catch {}

  // name
  const nx = ax + size + 40;
  ctx.fillStyle = "#e8e8e8";
  ctx.font = "bold 40px 'Space Grotesk', 'Inter', sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(member.user.username.slice(0, 22), nx, 55);

  // subtitle
  ctx.fillStyle = "#6b6660";
  ctx.font = "500 16px 'Inter', sans-serif";
  ctx.fillText("chromed stats", nx, 105);

  // stat rows
  const stats3 = [
    { label: "messages", value: formatNum(stats.messages_sent) },
    { label: "vc hours", value: (Number(stats.vc_seconds || 0) / 3600).toFixed(1) + "h" },
    { label: "commands", value: formatNum(stats.commands_used) },
  ];

  const colWidth = (W - nx - 60) / 3;
  stats3.forEach((s, i) => {
    const x = nx + i * colWidth;
    const y = 175;

    // value
    ctx.fillStyle = "#d2b48c";
    ctx.font = "bold 42px 'Space Grotesk', 'Inter', sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(s.value, x, y);

    // label
    ctx.fillStyle = "#6b6660";
    ctx.font = "500 13px 'Inter', sans-serif";
    ctx.fillText(s.label, x, y + 55);
  });

  // watermark
  ctx.fillStyle = "rgba(232,232,232,0.25)";
  ctx.font = "500 12px 'Inter', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("chromed · stats", W - 30, H - 30);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

// ─── SERVER STATS CARD ───
async function buildServerCard(guild, stats) {
  const W = 900, H = 400;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#050505");
  bg.addColorStop(0.6, "#111111");
  bg.addColorStop(1, "#181818");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // glow
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.8);
  glow.addColorStop(0, "rgba(210,180,140,0.18)");
  glow.addColorStop(1, "rgba(210,180,140,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // grid
  ctx.strokeStyle = "rgba(255,255,255,0.025)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // server icon
  const iconSize = 110;
  const ix = 60, iy = 60;
  try {
    const url = guild.iconURL({ extension: "png", size: 256 });
    if (url) {
      const icon = await loadImage(url);
      ctx.save();
      roundedRect(ctx, ix, iy, iconSize, iconSize, 24);
      ctx.clip();
      ctx.drawImage(icon, ix, iy, iconSize, iconSize);
      ctx.restore();

      roundedRect(ctx, ix, iy, iconSize, iconSize, 24);
      ctx.strokeStyle = "#d2b48c";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  } catch {}

  // server name
  ctx.fillStyle = "#e8e8e8";
  ctx.font = "bold 44px 'Space Grotesk', 'Inter', sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText(guild.name.slice(0, 28), ix + iconSize + 30, 75);

  // subtitle
  ctx.fillStyle = "#6b6660";
  ctx.font = "500 16px 'Inter', sans-serif";
  ctx.fillText("server stats · chromed", ix + iconSize + 30, 130);

  // 2 rows of 3 stats
  const rows = [
    [
      { label: "members", value: formatNum(guild.memberCount) },
      { label: "messages", value: formatNum(stats.total_messages) },
      { label: "vc hours", value: (Number(stats.total_vc_seconds || 0) / 3600).toFixed(1) + "h" },
    ],
    [
      { label: "commands", value: formatNum(stats.total_commands) },
      { label: "total joins", value: formatNum(stats.total_joins) },
      { label: "total leaves", value: formatNum(stats.total_leaves) },
    ],
  ];

  const startX = 60;
  const startY = 220;
  const colW = (W - 120) / 3;
  const rowH = 90;

  rows.forEach((row, ri) => {
    row.forEach((s, ci) => {
      const x = startX + ci * colW;
      const y = startY + ri * rowH;

      ctx.fillStyle = "#d2b48c";
      ctx.font = "bold 34px 'Space Grotesk', 'Inter', sans-serif";
      ctx.fillText(s.value, x, y);

      ctx.fillStyle = "#6b6660";
      ctx.font = "500 13px 'Inter', sans-serif";
      ctx.fillText(s.label, x, y + 40);
    });
  });

  // watermark
  ctx.fillStyle = "rgba(232,232,232,0.25)";
  ctx.font = "500 12px 'Inter', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("chromed · stats", W - 30, H - 25);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("view server and user stats")
    .addSubcommand(sub =>
      sub.setName("user")
        .setDescription("view your stats or someone else's")
        .addUserOption(opt => opt.setName("user").setDescription("target user").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("server")
        .setDescription("view server stats")
    )
    .addSubcommand(sub =>
      sub.setName("leaderboard")
        .setDescription("top users by messages or vc hours")
        .addStringOption(opt =>
          opt.setName("sort").setDescription("sort by").setRequired(false)
            .addChoices(
              { name: "messages", value: "messages" },
              { name: "vc hours", value: "vc" }
            )
        )
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const pool = interaction.client.pool;
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    const sendEmbed = async (title, description, color = 0x7c7ce0) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    };

    try {
      // ── USER ──
      if (sub === "user") {
        const target = interaction.options.getUser("user") || interaction.user;
        const member = await guild.members.fetch(target.id).catch(() => null);
        if (!member) return sendEmbed(`${E.error} not in server`, "i can't find that user.", 0xff0000);

        const res = await pool.query(
          `SELECT messages_sent, vc_seconds, commands_used, voice_sessions, first_seen
           FROM user_stats WHERE user_id = $1 AND guild_id = $2`,
          [target.id, guild.id]
        );
        const stats = res.rows[0] || {
          messages_sent: 0, vc_seconds: 0, commands_used: 0, voice_sessions: 0,
        };

        const buffer = await buildUserCard(member, stats);
        const attachment = new AttachmentBuilder(buffer, { name: "stats.png" });

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.star} ${target.username}'s stats`)
          .setImage("attachment://stats.png")
          .setFooter({ text: "chromed stats" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed], files: [attachment] }).catch(() => interaction.followUp({ embeds: [embed], files: [attachment] }));
      }

      // ── SERVER ──
      if (sub === "server") {
        const res = await pool.query(
          `SELECT * FROM guild_stats WHERE guild_id = $1`,
          [guild.id]
        );
        const stats = res.rows[0] || {
          total_messages: 0, total_vc_seconds: 0, total_commands: 0,
          total_joins: 0, total_leaves: 0,
        };

        const buffer = await buildServerCard(guild, stats);
        const attachment = new AttachmentBuilder(buffer, { name: "server-stats.png" });

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.settings} ${guild.name} stats`)
          .setImage("attachment://server-stats.png")
          .setFooter({ text: "chromed stats" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed], files: [attachment] }).catch(() => interaction.followUp({ embeds: [embed], files: [attachment] }));
      }

      // ── LEADERBOARD ──
      if (sub === "leaderboard") {
        const sort = interaction.options.getString("sort") || "messages";
        const column = sort === "vc" ? "vc_seconds" : "messages_sent";
        const label = sort === "vc" ? "vc hours" : "messages";

        const res = await pool.query(
          `SELECT user_id, messages_sent, vc_seconds FROM user_stats
           WHERE guild_id = $1
           ORDER BY ${column} DESC LIMIT 10`,
          [guild.id]
        );

        if (!res.rows.length) {
          return sendEmbed(`${E.trophy} no data`, "no stats yet.", 0xff0000);
        }

        const lines = await Promise.all(res.rows.map(async (r, i) => {
          const user = await interaction.client.users.fetch(r.user_id).catch(() => null);
          const name = user ? user.username : "unknown";
          const value = sort === "vc"
            ? (Number(r.vc_seconds) / 3600).toFixed(1) + "h"
            : formatNum(r.messages_sent);
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
          return `${medal} ${name} — **${value}** ${label}`;
        }));

        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.trophy} ${guild.name} leaderboard — ${label}`)
          .setDescription(lines.join("\n"))
          .setFooter({ text: "chromed stats" })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
      }

      return sendEmbed(`${E.error} unknown`, "unknown subcommand.", 0xff0000);
    } catch (err) {
      console.error("stats error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
