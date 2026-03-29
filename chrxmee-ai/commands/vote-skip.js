const { SlashCommandBuilder } = require("discord.js");

const votes = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vote-skip")
    .setDescription("Vote to skip the current song. Needs 50% of listeners."),

  async execute(interaction) {
    const player = interaction.client.lavalink.getPlayer(interaction.guild.id);
    if (!player || !player.queue.current) return interaction.reply("❌ Nothing is playing!");
    if (!interaction.member.voice.channel) return interaction.reply("❌ You need to be in a voice channel!");

    const vc = interaction.member.voice.channel;
    const listeners = vc.members.filter(m => !m.user.bot).size;
    const needed = Math.ceil(listeners * 0.5);
    const guildId = interaction.guild.id;

    if (!votes.has(guildId)) votes.set(guildId, new Set());
    const guildVotes = votes.get(guildId);

    if (guildVotes.has(interaction.user.id)) {
      return interaction.reply("❌ You already voted to skip!");
    }

    guildVotes.add(interaction.user.id);
    const current = guildVotes.size;

    if (current >= needed) {
      votes.delete(guildId);
      await player.skip();
      return interaction.reply(`✅ Vote passed! **(${current}/${needed})** — Skipping **${player.queue.current?.info.title || "current track"}**!`);
    }

    return interaction.reply(`🗳️ Skip vote: **${current}/${needed}** votes. Need ${needed - current} more!`);
  }
};
