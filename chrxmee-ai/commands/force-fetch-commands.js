const { EmbedBuilder } = require('discord.js');

const OWNER_ID = '1332518492620197961';
// by the way you can change it to your own user id, if youre using this repo on your bot!

module.exports = {
  name: 'forcefetch',
  aliases: ['ff', 'fetchcmds'],
  async execute(client, message) {
    if (message.author.id !== OWNER_ID) return;

    const msg = await message.reply('fetching commands rq!!');

    try {
      const commands = await client.application.commands.fetch();

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setDescription(`fetched ${commands.size} commands ig it worked prob`);

      await msg.edit({ content: null, embeds: [embed] });
    } catch (err) {
      console.error(err);

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setDescription('fetch failed bruh😭 error: ${err.message}');

      await msg.edit({ content: null, embeds: [embed] });
    }
  }
};
