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
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Manage your birthday')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('set, view, or remove')
        .setRequired(true)
        .addChoices(
          { name: 'set', value: 'set' },
          { name: 'view', value: 'view' },
          { name: 'remove', value: 'remove' }
        ))
    .addStringOption(option =>
      option.setName('date')
        .setDescription('YYYY-MM-DD (only for set)')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('city')
        .setDescription('City for timezone (only for set)')
        .setRequired(false)
        .setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'city') return;

    const choices = Object.keys(CITY_TIMEZONES);
    const filtered = choices.filter(c => c.includes(focused.value.toLowerCase())).slice(0, 25);
    await interaction.respond(filtered.map(c => ({ name: c.charAt(0).toUpperCase() + c.slice(1), value: c })));
  },

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const action = interaction.options.getString('action');
    const userId = interaction.user.id;

    if (action === 'set') {
      const dateStr = interaction.options.getString('date');
      const city = interaction.options.getString('city')?.toLowerCase();

      if (!dateStr || !city) return interaction.editReply('Need both date and city for set ❄️');

      const tz = CITY_TIMEZONES[city];
      if (!tz) return interaction.editReply(`No timezone for "${city}" — try New York, Tokyo, London, etc. ❄️`);

      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return interaction.editReply('Date must be YYYY-MM-DD ❄️');

      const date = new Date(dateStr);
      if (isNaN(date)) return interaction.editReply('Date looks broken ❄️');

      await client.pool.query(`
        INSERT INTO user_birthdays (user_id, birthday_date, timezone)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE SET birthday_date = $2, timezone = $3, set_at = NOW()
      `, [userId, dateStr, tz]);

      return interaction.editReply(`Birthday set: **${dateStr}** (${city} time). I’ll remember ❄️`);
    }

    if (action === 'view') {
      const res = await client.pool.query('SELECT birthday_date, timezone FROM user_birthdays WHERE user_id = $1', [userId]);
      if (res.rowCount === 0) return interaction.editReply('No birthday set. Use /birthday set ❄️');
      const { birthday_date, timezone } = res.rows[0];
      return interaction.editReply(`Your birthday: **${birthday_date}** (${timezone}) ❄️`);
    }

    if (action === 'remove') {
      await client.pool.query('DELETE FROM user_birthdays WHERE user_id = $1', [userId]);
      return interaction.editReply('Birthday forgotten ❄️');
    }
  }
};
