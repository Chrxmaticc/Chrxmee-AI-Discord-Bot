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
  threads: "<:Threads:1531902029113327678>",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("thread")
    .setDescription("manage thread channels")
    .addSubcommand(sub =>
      sub.setName("create").setDescription("create a thread in a channel")
        .addChannelOption(opt => opt.setName("channel").setDescription("channel to create thread in (text/announcement)").setRequired(true))
        .addStringOption(opt => opt.setName("name").setDescription("thread name").setRequired(true))
        .addStringOption(opt => opt.setName("type").setDescription("thread type").setRequired(false)
          .addChoices(
            { name: "public", value: "public" },
            { name: "private", value: "private" }
          ))
        .addIntegerOption(opt => opt.setName("auto_archive").setDescription("auto archive minutes (default 1440)").setRequired(false)
          .addChoices({ name: "1 hour", value: 60 }, { name: "1 day", value: 1440 }, { name: "3 days", value: 4320 }, { name: "1 week", value: 10080 }))
        .addBooleanOption(opt => opt.setName("invitable").setDescription("allow non-mods to invite others? (private only)").setRequired(false))
    )
    .addSubcommand(sub => sub.setName("delete").setDescription("delete a thread")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("rename").setDescription("rename a thread")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
      .addStringOption(opt => opt.setName("name").setDescription("new name").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("lock").setDescription("lock a thread")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("unlock").setDescription("unlock a thread")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("archive").setDescription("archive a thread")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("unarchive").setDescription("unarchive a thread")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("slowmode").setDescription("set slowmode in a thread (seconds)")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
      .addIntegerOption(opt => opt.setName("seconds").setDescription("seconds (0 to disable)").setRequired(true).setMinValue(0).setMaxValue(21600))
    )
    .addSubcommand(sub => sub.setName("auto-archive").setDescription("set auto archive duration")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
      .addIntegerOption(opt => opt.setName("minutes").setDescription("minutes").setRequired(true)
        .addChoices({ name: "1 hour", value: 60 }, { name: "1 day", value: 1440 }, { name: "3 days", value: 4320 }, { name: "1 week", value: 10080 }))
    )
    .addSubcommand(sub => sub.setName("info").setDescription("view thread info")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("add-member").setDescription("add a member to a private thread")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
      .addUserOption(opt => opt.setName("user").setDescription("user to add").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("remove-member").setDescription("remove a member from a private thread")
      .addStringOption(opt => opt.setName("thread_id").setDescription("thread id or mention").setRequired(true))
      .addUserOption(opt => opt.setName("user").setDescription("user to remove").setRequired(true))
    )
    .addSubcommand(sub => sub.setName("list").setDescription("list active threads in a channel")
      .addChannelOption(opt => opt.setName("channel").setDescription("channel").setRequired(true))
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

    // permission check
    if (!member.permissions.has(PermissionFlagsBits.ManageThreads)) {
      return sendEmbed(`${E.error} permission denied`, `${E.angry} you need **manage threads** permission.`, 0xff0000);
    }

    // helper to fetch thread from id or mention
    const resolveThread = async (input) => {
      let thread = guild.channels.cache.get(input);
      if (thread && thread.isThread?.()) return thread;

      // try mention
      const mentionMatch = input.match(/^<#(\d+)>$/);
      if (mentionMatch) {
        thread = guild.channels.cache.get(mentionMatch[1]);
        if (thread && thread.isThread?.()) return thread;
      }

      // try to fetch from API
      try {
        const fetched = await guild.channels.fetch(input);
        if (fetched && fetched.isThread?.()) return fetched;
      } catch {}

      throw new Error("thread not found");
    };

    try {
      // CREATE
      if (sub === "create") {
        const channel = interaction.options.getChannel("channel");
        const name = interaction.options.getString("name");
        const type = interaction.options.getString("type") || "public";
        const autoArchive = interaction.options.getInteger("auto_archive") || 1440;
        const invitable = interaction.options.getBoolean("invitable") ?? true;

        if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
          return sendEmbed(`${E.error} invalid channel`, `${E.angry} threads can only be created in text or announcement channels.`, 0xff0000);
        }

        let thread;
        if (type === "private") {
          thread = await channel.threads.create({
            name,
            autoArchiveDuration: autoArchive,
            type: ChannelType.PrivateThread,
            invitable,
            reason: "chromed thread create",
          });
        } else {
          // public thread
          const message = await channel.send(name).catch(() => null);
          if (!message) {
            return sendEmbed(`${E.error} failed`, `${E.angry} couldn't create public thread. Try private or specify a message.`, 0xff0000);
          }
          thread = await message.startThread({
            name,
            autoArchiveDuration: autoArchive,
            reason: "chromed thread create",
          });
          // delete the starter message? optional; keep it.
        }

        return sendEmbed(`${E.threads} thread created`, `${E.success} created thread **${thread.name}**.`);
      }

      // DELETE
      if (sub === "delete") {
        const input = interaction.options.getString("thread_id");
        const thread = await resolveThread(input);
        await thread.delete();
        return sendEmbed(`${E.threads} thread deleted`, `${E.success} deleted thread **${thread.name}**.`);
      }

      // RENAME
      if (sub === "rename") {
        const input = interaction.options.getString("thread_id");
        const newName = interaction.options.getString("name");
        const thread = await resolveThread(input);
        await thread.setName(newName);
        return sendEmbed(`${E.threads} thread renamed`, `${E.success} renamed to **${newName}**.`);
      }

      // LOCK
      if (sub === "lock") {
        const input = interaction.options.getString("thread_id");
        const thread = await resolveThread(input);
        await thread.setLocked(true);
        return sendEmbed(`${E.lock} thread locked`, `${E.success} thread is now locked.`);
      }

      // UNLOCK
      if (sub === "unlock") {
        const input = interaction.options.getString("thread_id");
        const thread = await resolveThread(input);
        await thread.setLocked(false);
        return sendEmbed(`${E.unlock} thread unlocked`, `${E.success} thread is now unlocked.`);
      }

      // ARCHIVE
      if (sub === "archive") {
        const input = interaction.options.getString("thread_id");
        const thread = await resolveThread(input);
        await thread.setArchived(true);
        return sendEmbed(`${E.threads} thread archived`, `${E.success} thread archived.`);
      }

      // UNARCHIVE
      if (sub === "unarchive") {
        const input = interaction.options.getString("thread_id");
        const thread = await resolveThread(input);
        await thread.setArchived(false);
        return sendEmbed(`${E.threads} thread unarchived`, `${E.success} thread unarchived.`);
      }

      // SLOWMODE
      if (sub === "slowmode") {
        const input = interaction.options.getString("thread_id");
        const seconds = interaction.options.getInteger("seconds");
        const thread = await resolveThread(input);
        await thread.setRateLimitPerUser(seconds);
        return sendEmbed(`${E.threads} slowmode set`, `${E.success} slowmode set to **${seconds} seconds**.`);
      }

      // AUTO ARCHIVE
      if (sub === "auto-archive") {
        const input = interaction.options.getString("thread_id");
        const minutes = interaction.options.getInteger("minutes");
        const thread = await resolveThread(input);
        await thread.setAutoArchiveDuration(minutes);
        return sendEmbed(`${E.threads} auto archive set`, `${E.success} auto archive set to **${minutes} minutes**.`);
      }

      // INFO
      if (sub === "info") {
        const input = interaction.options.getString("thread_id");
        const thread = await resolveThread(input);
        const embed = new EmbedBuilder()
          .setColor(0x7c7ce0)
          .setTitle(`${E.threads} thread info`)
          .addFields(
            { name: "name", value: thread.name, inline: true },
            { name: "id", value: thread.id, inline: true },
            { name: "type", value: thread.type.toString(), inline: true },
            { name: "archived", value: thread.archived ? "yes" : "no", inline: true },
            { name: "locked", value: thread.locked ? "yes" : "no", inline: true },
            { name: "parent", value: thread.parent ? `<#${thread.parentId}>` : "none", inline: true },
            { name: "members", value: `${thread.memberCount}`, inline: true },
            { name: "auto archive", value: `${thread.autoArchiveDuration} min`, inline: true }
          )
          .setFooter({ text: "chromed" })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] });
      }

      // ADD MEMBER
      if (sub === "add-member") {
        const input = interaction.options.getString("thread_id");
        const user = interaction.options.getUser("user");
        const thread = await resolveThread(input);
        if (thread.type !== ChannelType.PrivateThread) {
          return sendEmbed(`${E.error} not private`, `${E.angry} only private threads have members.`, 0xff0000);
        }
        const memberObj = await guild.members.fetch(user.id).catch(() => null);
        if (!memberObj) return sendEmbed(`${E.error} user not found`, `${E.angry} user not in server.`, 0xff0000);
        await thread.members.add(user.id);
        return sendEmbed(`${E.threads} member added`, `${E.success} added **${user.username}** to thread.`);
      }

      // REMOVE MEMBER
      if (sub === "remove-member") {
        const input = interaction.options.getString("thread_id");
        const user = interaction.options.getUser("user");
        const thread = await resolveThread(input);
        if (thread.type !== ChannelType.PrivateThread) {
          return sendEmbed(`${E.error} not private`, `${E.angry} only private threads have members.`, 0xff0000);
        }
        await thread.members.remove(user.id);
        return sendEmbed(`${E.threads} member removed`, `${E.success} removed **${user.username}** from thread.`);
      }

      // LIST
      if (sub === "list") {
        const channel = interaction.options.getChannel("channel");
        const threads = channel.threads.cache.filter(t => !t.archived);
        if (!threads.size) {
          return sendEmbed(`${E.threads} no active threads`, "there are no active threads in this channel.");
        }
        const threadList = threads.map(t => `<#${t.id}> — ${t.name}`).join("\n");
        return sendEmbed(`${E.threads} active threads`, threadList);
      }

      return sendEmbed(`${E.error} unknown`, "unknown subcommand.");
    } catch (err) {
      console.error("thread command error:", err);
      return sendEmbed(`${E.error} error`, `${E.angry} ${err.message}`, 0xff0000);
    }
  },
};
