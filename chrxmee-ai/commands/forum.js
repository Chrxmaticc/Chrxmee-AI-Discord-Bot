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
  forum: "<:Forum:1531902590315397190>",
  threads: "<:Threads:1531902029113327678>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("forum")
    .setDescription("manage forum channels with basic and advanced features")
    // Basic
    .addSubcommand(sub => sub.setName("create").setDescription("create a forum channel")
      .addStringOption(opt => opt.setName("name").setDescription("forum name").setRequired(true))
      .addChannelOption(opt => opt.setName("parent").setDescription("parent category").setRequired(false))
      .addStringOption(opt => opt.setName("topic").setDescription("forum topic/guidelines").setRequired(false))
      .addBooleanOption(opt => opt.setName("nsfw").setDescription("age-restricted?").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("delete").setDescription("delete a forum channel")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum to delete").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("rename").setDescription("rename a forum channel")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum to rename").setRequired(true))
      .addStringOption(opt => opt.setName("name").setDescription("new name").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("lock").setDescription("lock a forum channel")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum to lock").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("unlock").setDescription("unlock a forum channel")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum to unlock").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("info").setDescription("view forum channel info")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum channel").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("parent").setDescription("move forum to a category")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum to move").setRequired(true))
      .addChannelOption(opt => opt.setName("parent").setDescription("new parent category").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("topic").setDescription("set forum topic/guidelines")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum channel").setRequired(true))
      .addStringOption(opt => opt.setName("text").setDescription("new topic").setRequired(true))
    )
    // Advanced
    .addSubcommand(sub => sub.setName("set-slowmode").setDescription("set post slowmode (seconds)")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum channel").setRequired(true))
      .addIntegerOption(opt => opt.setName("seconds").setDescription("seconds (0 to disable)").setRequired(true).setMinValue(0).setMaxValue(21600))
    )
    .addSubcommand(sub => sub.setName("auto-archive").setDescription("set auto archive duration (minutes)")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum channel").setRequired(true))
      .addIntegerOption(opt => opt.setName("minutes").setDescription("minutes (60, 1440, 4320, 10080)").setRequired(true)
        .addChoices({ name: "1 hour", value: 60 }, { name: "1 day", value: 1440 }, { name: "3 days", value: 4320 }, { name: "1 week", value: 10080 }))
    )
    .addSubcommand(sub => sub.setName("default-reaction").setDescription("set default reaction emoji for posts")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum channel").setRequired(true))
      .addStringOption(opt => opt.setName("emoji").setDescription("emoji (unicode or custom)").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("add-tag").setDescription("add a tag to forum")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum channel").setRequired(true))
      .addStringOption(opt => opt.setName("name").setDescription("tag name").setRequired(true))
      .addStringOption(opt => opt.setName("emoji").setDescription("tag emoji").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("remove-tag").setDescription("remove a tag from forum")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum channel").setRequired(true))
      .addStringOption(opt => opt.setName("name").setDescription("tag name").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("list-tags").setDescription("list all tags on forum")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum channel").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("set-nsfw").setDescription("toggle nsfw on forum")
      .addChannelOption(opt => opt.setName("forum").setDescription("forum channel").setRequired(true))
      .addBooleanOption(opt => opt.setName("enabled").setDescription("enable or disable").setRequired(true))
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
      // BASIC: create
      if (sub === "create") {
        const name = interaction.options.getString("name");
        const parent = interaction.options.getChannel("parent") || null;
        const topic = interaction.options.getString("topic") || null;
        const nsfw = interaction.options.getBoolean("nsfw") || false;

        const createOptions = {
          name,
          type: ChannelType.GuildForum,
          parent: parent ? parent.id : null,
          nsfw,
          reason: "chromed forum create",
        };
        if (topic) createOptions.topic = topic;

        const forum = await guild.channels.create(createOptions);
        return sendEmbed(`${E.forum} forum created`, `${E.success} created forum **${forum.name}**.`);
      }

      // BASIC: delete
      if (sub === "delete") {
        const forum = interaction.options.getChannel("forum");
        await forum.delete("chromed forum delete");
        return sendEmbed(`${E.forum} forum deleted`, `${E.success} deleted forum **${forum.name}**.`);
      }

      // BASIC: rename
      if (sub === "rename") {
        const forum = interaction.options.getChannel("forum");
        const newName = interaction.options.getString("name");
        await forum.setName(newName, "chromed forum rename");
        return sendEmbed(`${E.forum} forum renamed`, `${E.success} renamed to **${newName}**.`);
      }

      // BASIC: lock
      if (sub === "lock") {
        const forum = interaction.options.getChannel("forum");
        await forum.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
        return sendEmbed(`${E.lock} forum locked`, `${E.success} forum is now locked.`);
      }

      // BASIC: unlock
      if (sub === "unlock") {
        const forum = interaction.options.getChannel("forum");
        await forum.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null });
        return sendEmbed(`${E.unlock} forum unlocked`, `${E.success} forum is now unlocked.`);
      }

      // BASIC: info
      if (sub === "info") {
        const forum = interaction.options.getChannel("forum") || interaction.channel;
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.forum} forum info`)
          .addFields(
            { name: "name", value: forum.name, inline: true },
            { name: "id", value: forum.id, inline: true },
            { name: "parent", value: forum.parent ? forum.parent.name : "none", inline: true },
            { name: "nsfw", value: forum.nsfw ? "yes" : "no", inline: true },
            { name: "topic", value: forum.topic || "none", inline: false },
            { name: "default auto archive", value: forum.defaultAutoArchiveDuration ? `${forum.defaultAutoArchiveDuration} minutes` : "default", inline: true },
            { name: "default slowmode", value: forum.defaultThreadRateLimitPerUser ? `${forum.defaultThreadRateLimitPerUser}s` : "none", inline: true }
          )
          .setFooter({ text: "chromed" })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      // BASIC: parent
      if (sub === "parent") {
        const forum = interaction.options.getChannel("forum");
        const parent = interaction.options.getChannel("parent");
        if (parent.type !== ChannelType.GuildCategory) {
          return sendEmbed(`${E.error} not category`, `${E.angry} parent must be a category.`, 0xff0000);
        }
        await forum.setParent(parent.id);
        return sendEmbed(`${E.forum} parent updated`, `${E.success} moved forum to **${parent.name}**.`);
      }

      // BASIC: topic
      if (sub === "topic") {
        const forum = interaction.options.getChannel("forum");
        const text = interaction.options.getString("text");
        await forum.setTopic(text);
        return sendEmbed(`${E.forum} topic set`, `${E.success} topic updated.`);
      }

      // ADVANCED: set slowmode
      if (sub === "set-slowmode") {
        const forum = interaction.options.getChannel("forum");
        const seconds = interaction.options.getInteger("seconds");
        await forum.setDefaultThreadRateLimitPerUser(seconds);
        return sendEmbed(`${E.forum} slowmode set`, `${E.success} post slowmode set to **${seconds} seconds**.`);
      }

      // ADVANCED: auto archive
      if (sub === "auto-archive") {
        const forum = interaction.options.getChannel("forum");
        const minutes = interaction.options.getInteger("minutes");
        await forum.setDefaultAutoArchiveDuration(minutes);
        return sendEmbed(`${E.forum} auto archive set`, `${E.success} auto archive duration set to **${minutes} minutes**.`);
      }

      // ADVANCED: default reaction
      if (sub === "default-reaction") {
        const forum = interaction.options.getChannel("forum");
        const emoji = interaction.options.getString("emoji");
        await forum.setDefaultReactionEmoji(emoji);
        return sendEmbed(`${E.forum} default reaction set`, `${E.success} default reaction set to ${emoji}.`);
      }

      // ADVANCED: add tag
      if (sub === "add-tag") {
        const forum = interaction.options.getChannel("forum");
        const name = interaction.options.getString("name");
        const emoji = interaction.options.getString("emoji") || null;
        const currentTags = forum.availableTags || [];
        const newTag = { name, emoji: emoji || null, moderated: false };
        const updatedTags = [...currentTags, newTag];
        await forum.setAvailableTags(updatedTags);
        return sendEmbed(`${E.forum} tag added`, `${E.success} added tag **${name}**.`);
      }

      // ADVANCED: remove tag
      if (sub === "remove-tag") {
        const forum = interaction.options.getChannel("forum");
        const name = interaction.options.getString("name");
        const currentTags = forum.availableTags || [];
        const updatedTags = currentTags.filter(t => t.name.toLowerCase() !== name.toLowerCase());
        if (updatedTags.length === currentTags.length) {
          return sendEmbed(`${E.error} tag not found`, `${E.angry} no tag named **${name}**.`, 0xff0000);
        }
        await forum.setAvailableTags(updatedTags);
        return sendEmbed(`${E.forum} tag removed`, `${E.success} removed tag **${name}**.`);
      }

      // ADVANCED: list tags
      if (sub === "list-tags") {
        const forum = interaction.options.getChannel("forum");
        const tags = forum.availableTags || [];
        if (!tags.length) {
          return sendEmbed(`${E.forum} no tags`, "this forum has no tags configured.");
        }
        const tagList = tags.map(t => `${t.emoji ? t.emoji + " " : ""}**${t.name}**`).join("\n");
        return sendEmbed(`${E.forum} forum tags`, tagList);
      }

      // ADVANCED: set nsfw
      if (sub === "set-nsfw") {
        const forum = interaction.options.getChannel("forum");
        const enabled = interaction.options.getBoolean("enabled");
        await forum.setNSFW(enabled);
        return sendEmbed(`${E.forum} nsfw ${enabled ? "enabled" : "disabled"}`, `${E.success} forum nsfw set to **${enabled}**.`);
      }

      return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
    } catch (err) {
      console.error("forum command error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
