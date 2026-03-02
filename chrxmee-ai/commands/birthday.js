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
  'moscow': 'Europe/Moscow'
  // add more cities as needed — keep it short for autocomplete
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
      const city = interaction.options.getString('city')?.toLowerCase();

      if (!dateStr || !city) return interaction.editReply('Need **date** and **city** to set it, besto ❄️');

      const tz = CITY_TIMEZONES[city];
      if (!tz) return interaction.editReply(`No timezone for "${city}"... try New York, Tokyo, London, etc. ❄️`);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return interaction.editReply('Date must be YYYY-MM-DD ❄️');

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return interaction.editReply('That date looks cursed ❄️');

      try {
        await client.pool.query(`
          INSERT INTO user_birthdays (user_id, birthday_date, timezone)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET birthday_date = $2, timezone = $3, set_at = NOW()
        `, [userId, dateStr, tz]);

        return interaction.editReply(`Birthday locked in: **${dateStr}** (${city} time). I gotchu, besto ❄️`);
      } catch (err) {
        console.error('Birthday set failed:', err);
        return interaction.editReply('DB said no... weird. Try again? ❄️');
      }
    }

    if (sub === 'view') {
      try {
        const res = await client.pool.query('SELECT birthday_date, timezone FROM user_birthdays WHERE user_id = $1', [userId]);
        if (res.rowCount === 0) return interaction.editReply('No birthday set yet. Use /birthday set ❄️');

        const { birthday_date, timezone } = res.rows[0];
        return interaction.editReply(`Your big day: **${birthday_date}** (${timezone}) ❄️ Already counting down.`);
      } catch (err) {
        console.error('Birthday view failed:', err);
        return interaction.editReply('Couldn’t find it... did I forget? Set it again? ❄️');
      }
    }

    if (sub === 'remove') {
      try {
        await client.pool.query('DELETE FROM user_birthdays WHERE user_id = $1', [userId]);
        return interaction.editReply('Birthday memory wiped. No more annual roasts... for now ❄️');
      } catch (err) {
        console.error('Birthday remove failed:', err);
        return interaction.editReply('Couldn’t forget it... the bot’s clingy. Try again? ❄️');
      }
    }
  }
};
