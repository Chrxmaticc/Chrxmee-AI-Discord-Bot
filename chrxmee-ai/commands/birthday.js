const { SlashCommandBuilder } = require('discord.js');

const CITY_TIMEZONES = {
  'new york': 'America/New_York',
  'london': 'Europe/London',
  'tokyo': 'Asia/Tokyo',
  'sydney': 'Australia/Sydney',
  'dubai': 'Asia/Dubai',
  'los angeles': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
  'paris': 'Europe/Paris',
  'berlin': 'Europe/Berlin',
  'moscow': 'Europe/Moscow',
  'toronto': 'America/Toronto',
  'seoul': 'Asia/Seoul',
  'mumbai': 'Asia/Kolkata',
  // Feel free to add 2–3 more cities you actually see people from
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Manage your birthday')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set your birthday')
        .addStringOption(opt => opt.setName('date').setDescription('YYYY-MM-DD').setRequired(true))
        .addStringOption(opt => opt.setName('city').setDescription('City for timezone').setRequired(true).setAutocomplete(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('view')
        .setDescription('See your birthday info'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Forget your birthday')),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'city') return;

    const choices = Object.keys(CITY_TIMEZONES);
    const filtered = choices.filter(c => c.includes(focused.value.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered.map(c => ({ name: c.charAt(0).toUpperCase() + c.slice(1), value: c })));
  },

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const dateStr = interaction.options.getString('date');
      const city = interaction.options.getString('city').toLowerCase();
      const tz = CITY_TIMEZONES[city];

      if (!tz) {
        return interaction.editReply(
          `No timezone match for "${city}" — try a bigger city like New York, Tokyo, London, etc. ❄️ ` +
          `Your birthday wasn't saved yet, but you can try again!`
        );
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return interaction.editReply('Date must be YYYY-MM-DD (e.g. 1995-12-25) ❄️');
      }

      const date = new Date(dateStr);
      if (isNaN(date)) return interaction.editReply('That date looks broken. Try again ❄️');

      try {
        await client.pool.query(`
          INSERT INTO user_birthdays (user_id, birthday_date, timezone)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET birthday_date = $2, timezone = $3, set_at = NOW()
        `, [userId, dateStr, tz]);

        return interaction.editReply(
          `Birthday locked in: **${dateStr}** (${city} time). ` +
          `I’ll remember... and probably roast you extra hard when the day comes ❄️`
        );
      } catch (err) {
        console.error('Birthday set error:', err);
        return interaction.editReply('Something broke on my end. Try again later? ❄️');
      }
    }

    if (sub === 'view') {
      try {
        const res = await client.pool.query('SELECT birthday_date, timezone FROM user_birthdays WHERE user_id = $1', [userId]);
        if (res.rowCount === 0) {
          return interaction.editReply('No birthday set yet. Use /birthday set to fix that ❄️');
        }

        const { birthday_date, timezone } = res.rows[0];
        return interaction.editReply(`Your birthday: **${birthday_date}** (${timezone}) ❄️ Counting down already.`);
      } catch (err) {
        console.error('Birthday view error:', err);
        return interaction.editReply('Couldn’t find your birthday... did I forget? Try setting it again ❄️');
      }
    }

    if (sub === 'remove') {
      try {
        await client.pool.query('DELETE FROM user_birthdays WHERE user_id = $1', [userId]);
        return interaction.editReply('Birthday memory wiped. No more annual roasts from me... for now ❄️');
      } catch (err) {
        console.error('Birthday remove error:', err);
        return interaction.editReply('Couldn’t forget it... weird. Try again? ❄️');
      }
    }
  }
};
