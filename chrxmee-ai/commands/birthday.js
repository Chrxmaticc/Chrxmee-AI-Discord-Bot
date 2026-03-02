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
  'mumbai': 'Asia/Kolkata'
  // Feel free to add 2–3 more if you want — keep it under ~25 for best UX
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Manage your birthday')
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set your birthday')
        .addStringOption(opt => opt.setName('date').setDescription('YYYY-MM-DD or DD-MM-YYYY').setRequired(true))
        .addStringOption(opt =>
          opt.setName('city')
            .setDescription('Type city name to see timezone choices (autocomplete) — start typing e.g. "new" for New York')
            .setRequired(true)
            .setAutocomplete(true)))
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
    const value = focused.value.toLowerCase();

    // Show all choices if nothing typed yet (helps with "nothing displays" issue)
    let filtered = value ? choices.filter(c => c.includes(value)) : choices.slice(0, 25);

    // Optional: always show top 5 popular ones first even if typed something weird
    const popular = ['new york', 'london', 'tokyo', 'sydney', 'los angeles'];
    filtered = [...new Set([...popular.filter(p => p.includes(value)), ...filtered])].slice(0, 25);

    await interaction.respond(filtered.map(c => ({ name: c.charAt(0).toUpperCase() + c.slice(1), value: c })));
  },

  async execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true }); // First line — covers all subcommands

    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      let dateStr = interaction.options.getString('date').trim();
      const city = interaction.options.getString('city')?.toLowerCase();

      if (!dateStr || !city) return interaction.editReply('Need both date and city to set it.');

      const tz = CITY_TIMEZONES[city];
      if (!tz) return interaction.editReply(`No timezone for "${city}" — try New York, Tokyo, London, etc.`);

      // Smarter date parsing (accepts YYYY-MM-DD, YYYY-M-D, DD-MM-YYYY, DD-M-YYYY)
      let year, month, day;
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-').map(p => p.trim());
        if (parts.length !== 3) return interaction.editReply('Date format invalid — try YYYY-MM-DD or DD-MM-YYYY');

        if (parts[0].length === 4) {
          // YYYY-MM-DD or YYYY-M-D
          [year, month, day] = parts;
        } else {
          // DD-MM-YYYY or DD-M-YYYY
          [day, month, year] = parts;
        }

        month = month.padStart(2, '0');
        day = day.padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      } else {
        return interaction.editReply('Date must use dashes (YYYY-MM-DD or DD-MM-YYYY)');
      }

      const date = new Date(dateStr);
      if (isNaN(date.getTime()) || date.getFullYear() < 1900 || date.getFullYear() > new Date().getFullYear() + 1) {
        return interaction.editReply('Date looks invalid or too far in the future/past.');
      }

      try {
        await client.pool.query(`
          INSERT INTO user_birthdays (user_id, birthday_date, timezone)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id) DO UPDATE SET birthday_date = $2, timezone = $3, set_at = NOW()
        `, [userId, dateStr, tz]);

        return interaction.editReply(`Birthday set: **${dateStr}** (${city} time)`);
      } catch (err) {
        console.error('Birthday set error:', err);
        return interaction.editReply('DB is being slow... try again in a sec.');
      }
    }

    if (sub === 'view') {
      try {
        const res = await client.pool.query('SELECT birthday_date, timezone FROM user_birthdays WHERE user_id = $1', [userId]);
        if (res.rowCount === 0) return interaction.editReply('No birthday set yet.');

        const { birthday_date, timezone } = res.rows[0];
        return interaction.editReply(`Your birthday: **${birthday_date}** (${timezone})`);
      } catch (err) {
        console.error('Birthday view error:', err);
        return interaction.editReply('Couldn’t fetch it... try again?');
      }
    }

    if (sub === 'remove') {
      try {
        await client.pool.query('DELETE FROM user_birthdays WHERE user_id = $1', [userId]);
        return interaction.editReply('Birthday forgotten.');
      } catch (err) {
        console.error('Birthday remove error:', err);
        return interaction.editReply('Couldn’t forget it... try again?');
      }
    }
  }
};
