const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  agree: "<:agreed:1525639597135237131>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  lock: "<:lock:1530377198324945056>",
  unlock: "<:unlock:1530377714995826831>",
  channel: "<:Channel:1531901854361849929>",
  forum: "<:Forum:1531902590315397190>",
  threads: "<:Threads:1531902029113327678>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("channel")
    .setDescription("manage chat channels (and limited forum support)")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("create a channel")
        .addStringOption((opt) =>
          opt.setName("type").setDescription("channel type").setRequired(true)
            .addChoices(
              { name: "text", value: "text" },
              { name: "voice", value: "voice" },
              { name: "category", value: "category" },
              { name: "stage", value: "stage" },
              { name: "forum", value: "forum" }
            )
        )
        .addStringOption((opt) => opt.setName("name").setDescription("channel name").setRequired(true))
        .addChannelOption((opt) => opt.setName("parent").setDescription("parent category").setRequired(false))
        .addStringOption((opt) => opt.setName("topic").setDescription("channel topic (text/forum)").setRequired(false))
        .addBooleanOption((opt) => opt.setName("nsfw").setDescription("age-restricted?").setRequired(false))
        .addIntegerOption((opt) => opt.setName("slowmode").setDescription("slowmode in seconds (text only)").setRequired(false).setMinValue(0).setMaxValue(21600))
        .addIntegerOption((opt) => opt.setName("position").setDescription("position in list").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("delete")
        .setDescription("delete a channel")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel to delete").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("rename")
        .setDescription("rename a channel")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel to rename").setRequired(true))
        .addStringOption((opt) => opt.setName("name").setDescription("new name").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("topic")
        .setDescription("set channel topic (text/forum)")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel").setRequired(true))
        .addStringOption((opt) => opt.setName("text").setDescription("new topic").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("nsfw")
        .setDescription("toggle nsfw on a channel")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel").setRequired(true))
        .addBooleanOption((opt) => opt.setName("enabled").setDescription("enable or disable").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("slowmode")
        .setDescription("set slowmode on a text channel")
        .addChannelOption((opt) => opt.setName("channel").setDescription("text channel").setRequired(true))
        .addIntegerOption((opt) => opt.setName("seconds").setDescription("seconds (0 to disable)").setRequired(true).setMinValue(0).setMaxValue(21600))
    )
    .addSubcommand((sub) =>
      sub
        .setName("lock")
        .setDescription("lock a channel (blocks @everyone sending messages)")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("unlock")
        .setDescription("unlock a channel")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel").setRequired(true))
        .addStringOption((opt) => opt.setName("reason").setDescription("reason").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("clone")
        .setDescription("clone a channel")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel to clone").setRequired(true))
        .addStringOption((opt) => opt.setName("name").setDescription("new name (optional)").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("view channel info")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel").setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName("parent")
        .setDescription("move channel to a category")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel to move").setRequired(true))
        .addChannelOption((opt) => opt.setName("parent").setDescription("new parent category").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("position")
        .setDescription("set channel position")
        .addChannelOption((opt) => opt.setName("channel").setDescription("channel").setRequired(true))
        .addIntegerOption((opt) => opt.setName("position").setDescription("position number").setRequired(true).setMinValue(0))
    )
    // Limited forum commands
    .addSubcommand((sub) =>
      sub
        .setName("forum-delete")
        .setDescription("delete a forum channel")
        .addChannelOption((opt) => opt.setName("forum").setDescription("forum to delete").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("forum-rename")
        .setDescription("rename a forum channel")
        .addChannelOption((opt) => opt.setName("forum").setDescription("forum to rename").setRequired(true))
        .addStringOption((opt) => opt.setName("name").setDescription("new name").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("forum-lock")
        .setDescription("lock a forum channel")
        .addChannelOption((opt) => opt.setName("forum").setDescription("forum to lock").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName("forum-unlock")
        .setDescription("unlock a forum channel")
        .addChannelOption((opt) => opt.setName("forum").setDescription("forum to unlock").setRequired(true))
    ),
  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const member = interaction.member;

    const sendEmbed = async (title, description, color = 0x7c7ce0) => {
      const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
      return interaction.editReply({ embeds: [embed] }).catch(() => interaction.followUp({ embeds: [embed] }));
    };

    if (sub !== "info" && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return sendEmbed(`${E.error} permission denied`, `${E.angry} you need **manage channels** permission.`, 0xff0000);
    }

    try {
      // CREATE (includes forum)
      if (sub === "create") {
        const type = interaction.options.getString("type");
        const name = interaction.options.getString("name");
        const parent = interaction.options.getChannel("parent") || null;
        const topic = interaction.options.getString("topic") || null;
        const nsfw = interaction.options.getBoolean("nsfw") || false;
        const slowmode = interaction.options.getInteger("slowmode") || 0;
        const position = interaction.options.getInteger("position") || null;

        const createOptions = {
          name,
          type: type === "text" ? ChannelType.GuildText :
                type === "voice" ? ChannelType.GuildVoice :
                type === "category" ? ChannelType.GuildCategory :
                type === "stage" ? ChannelType.GuildStageVoice :
                type === "forum" ? ChannelType.GuildForum : ChannelType.GuildText,
          parent: parent ? parent.id : null,
          nsfw: nsfw,
          reason: "chromed channel create",
        };
        if (topic) createOptions.topic = topic;
        if (type === "text" && slowmode) createOptions.rateLimitPerUser = slowmode;
        if (position !== null) createOptions.position = position;

        const created = await guild.channels.create(createOptions);
        return sendEmbed(`${type === "forum" ? E.forum : E.channel} channel created`, `${E.success} created **${created.name}** (${created.type}).`);
      }

      // DELETE
      if (sub === "delete") {
        const channel = interaction.options.getChannel("channel");
        const reason = interaction.options.getString("reason") || "chromed channel delete";
        await channel.delete(reason);
        return sendEmbed(`${E.channel} channel deleted`, `${E.success} deleted **#${channel.name}**.`);
      }

      // RENAME
      if (sub === "rename") {
        const channel = interaction.options.getChannel("channel");
        const newName = interaction.options.getString("name");
        const reason = interaction.options.getString("reason") || "chromed rename";
        await channel.setName(newName, reason);
        return sendEmbed(`${E.channel} channel renamed`, `${E.success} renamed to **#${newName}**.`);
      }

      // TOPIC
      if (sub === "topic") {
        const channel = interaction.options.getChannel("channel");
        const text = interaction.options.getString("text");
        const reason = interaction.options.getString("reason") || "chromed topic";
        await channel.setTopic(text, reason);
        return sendEmbed(`${E.channel} topic set`, `${E.success} topic updated to: ${text}`);
      }

      // NSFW
      if (sub === "nsfw") {
        const channel = interaction.options.getChannel("channel");
        const enabled = interaction.options.getBoolean("enabled");
        await channel.setNSFW(enabled);
        return sendEmbed(`${E.channel} nsfw ${enabled ? "enabled" : "disabled"}`, `${E.success} ${channel} is now ${enabled ? "age-restricted" : "not age-restricted"}.`);
      }

      // SLOWMODE
      if (sub === "slowmode") {
        const channel = interaction.options.getChannel("channel");
        const seconds = interaction.options.getInteger("seconds");
        if (channel.type !== ChannelType.GuildText) {
          return sendEmbed(`${E.error} wrong type`, `${E.angry} slowmode only works on text channels.`, 0xff0000);
        }
        await channel.setRateLimitPerUser(seconds);
        return sendEmbed(`${E.channel} slowmode set`, `${E.success} slowmode set to **${seconds} seconds**.`);
      }

      // LOCK
      if (sub === "lock") {
        const channel = interaction.options.getChannel("channel");
        const reason = interaction.options.getString("reason") || "chromed lock";
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason });
        return sendEmbed(`${E.lock} channel locked`, `${E.success} ${channel} is now locked.`);
      }

      // UNLOCK
      if (sub === "unlock") {
        const channel = interaction.options.getChannel("channel");
        const reason = interaction.options.getString("reason") || "chromed unlock";
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }, { reason });
        return sendEmbed(`${E.unlock} channel unlocked`, `${E.success} ${channel} is now unlocked.`);
      }

      // CLONE
      if (sub === "clone") {
        const channel = interaction.options.getChannel("channel");
        const newName = interaction.options.getString("name") || `${channel.name}-clone`;
        const cloned = await channel.clone({ name: newName });
        return sendEmbed(`${E.channel} channel cloned`, `${E.success} cloned to **#${cloned.name}**.`);
      }

      // INFO
      if (sub === "info") {
        const channel = interaction.options.getChannel("channel") || interaction.channel;
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${channel.type === ChannelType.GuildForum ? E.forum : E.channel} channel info`)
          .addFields(
            { name: "name", value: `#${channel.name}`, inline: true },
            { name: "id", value: channel.id, inline: true },
            { name: "type", value: channel.type.toString(), inline: true },
            { name: "position", value: channel.position.toString(), inline: true },
            { name: "parent", value: channel.parent ? channel.parent.name : "none", inline: true },
            { name: "nsfw", value: channel.nsfw ? "yes" : "no", inline: true },
            { name: "topic", value: channel.topic || "none", inline: false }
          )
          .setFooter({ text: "chromed" })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      // PARENT
      if (sub === "parent") {
        const channel = interaction.options.getChannel("channel");
        const parent = interaction.options.getChannel("parent");
        if (parent.type !== ChannelType.GuildCategory) {
          return sendEmbed(`${E.error} not category`, `${E.angry} parent must be a category.`, 0xff0000);
        }
        await channel.setParent(parent.id);
        return sendEmbed(`${E.channel} parent updated`, `${E.success} moved ${channel} to **${parent.name}**.`);
      }

      // POSITION
      if (sub === "position") {
        const channel = interaction.options.getChannel("channel");
        const position = interaction.options.getInteger("position");
        await channel.setPosition(position);
        return sendEmbed(`${E.channel} position set`, `${E.success} moved ${channel} to position **${position}**.`);
      }

      // ─── LIMITED FORUM COMMANDS ───
      if (sub === "forum-delete") {
        const forum = interaction.options.getChannel("forum");
        await forum.delete("chromed forum delete");
        return sendEmbed(`${E.forum} forum deleted`, `${E.success} deleted forum **${forum.name}**.`);
      }

      if (sub === "forum-rename") {
        const forum = interaction.options.getChannel("forum");
        const newName = interaction.options.getString("name");
        await forum.setName(newName);
        return sendEmbed(`${E.forum} forum renamed`, `${E.success} renamed forum to **${newName}**.`);
      }

      if (sub === "forum-lock") {
        const forum = interaction.options.getChannel("forum");
        await forum.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        return sendEmbed(`${E.lock} forum locked`, `${E.success} forum is now locked.`);
      }

      if (sub === "forum-unlock") {
        const forum = interaction.options.getChannel("forum");
        await forum.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        return sendEmbed(`${E.unlock} forum unlocked`, `${E.success} forum is now unlocked.`);
      }

      return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
    } catch (err) {
      console.error("channel command error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
