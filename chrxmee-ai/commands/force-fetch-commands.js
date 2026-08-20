const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const OWNER_ID = '1332518492620197961';
// by the way you can change it to your own user id, if youre using this repo on your bot!

module.exports = {
  name: 'forcefetch',
  aliases: ['ff', 'fetchcmds'],
  data: new SlashCommandBuilder()
    .setName('forcefetch')
    .setDescription('force fetch global commands'),

  async execute(client, ctx) {
    const isSlash = ctx.isChatInputCommand ? ctx.isChatInputCommand() : false;
    const userId = isSlash ? ctx.user.id : ctx.author.id;

    if (userId !== OWNER_ID) {
      if (isSlash) return ctx.reply({ content: 'nah', ephemeral: true });
      return;
    }

    const reply = isSlash
      ? await ctx.reply('fetching commands rq!')
      : await ctx.reply('fetching commands rq!!');

    try {
      const commands = await client.application.commands.fetch();

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setDescription(`fetched ${commands.size} commands ig it worked prob`);

      if (isSlash) {
        await ctx.editReply({ content: null, embeds: [embed] });
      } else {
        await reply.edit({ content: null, embeds: [embed] });
      }
    } catch (err) {
      console.error(err);

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setDescription(`fetch failed bruh😭 error: ${err.message}`);

      if (isSlash) {
        await ctx.editReply({ content: null, embeds: [embed] });
      } else {
        await reply.edit({ content: null, embeds: [embed] });
      }
    }
  }
};
