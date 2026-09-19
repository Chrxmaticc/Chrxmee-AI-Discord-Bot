const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

const { store, engine, constants } = require('../cogs/pets');
const { SPECIES, FOODS, DRINKS, MEDICINE, PET_EMOJI, EMOJI } = constants;

const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const errBox = (m) => new ContainerBuilder().setAccentColor(0xff3b3b)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.error} ${m}`));
const okBox = (m) => new ContainerBuilder().setAccentColor(0x57f287)
  .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.success} ${m}`));
const cash = (n) => `${EMOJI.cash} **${Number(n).toLocaleString()}**`;

function bar(value, max = 100, width = 10) {
  const v = Math.max(0, Math.min(max, value || 0));
  const filled = Math.round((v / max) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function statLine(emoji, label, value) {
  return `${emoji} **${label}** ${bar(value)} \`${value}\``;
}

function petCard(pet) {
  const sp = SPECIES.find(s => s.id === pet.species) || SPECIES[0];
  const mood = engine.moodOf(pet);
  const moodLabel = {
    happy: 'happy', okay: 'okay', sad: 'sad',
    sick: 'sick', sleeping: 'sleeping', critical: 'critical', dead: 'dead',
  }[mood];

  const c = new ContainerBuilder().setAccentColor(pet.alive ? (pet.sick ? 0xffa500 : 0x5b7fd4) : 0xff3b3b);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${sp.emoji} ${pet.name}`));
  const flags = [];
  if (pet.sick) flags.push(PET_EMOJI.sick);
  if (pet.asleep) flags.push(PET_EMOJI.sleep);
  if (pet.poops > 0) flags.push(`${PET_EMOJI.poop} ×${pet.poops}`);
  const subline = `-# ${sp.label} · ${moodLabel}${flags.length ? ' · ' + flags.join(' ') : ''}`;
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(subline));
  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  if (!pet.alive) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.error} this pet died <t:${Math.floor((pet.diedAt || Date.now()) / 1000)}:R>\ncause: **${pet.causeOfDeath || 'unknown'}**`));
    return c;
  }

  c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    statLine(PET_EMOJI.hunger, 'hunger', pet.hunger),
    statLine(PET_EMOJI.thirst, 'thirst', pet.thirst),
    statLine(PET_EMOJI.happiness, 'happy', pet.happiness),
    statLine(PET_EMOJI.energy, 'energy', pet.energy),
    statLine(PET_EMOJI.hygiene, 'hygiene', pet.hygiene),
    statLine(PET_EMOJI.health, 'health', pet.health),
  ].join('\n')));

  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
    `-# adopted <t:${Math.floor(pet.adoptedAt / 1000)}:R>\n-# /pets feed · drink · play · wash · sleep · medicine`
  ));
  return c;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pets')
    .setDescription('adopt and take care of a virtual pet')
    .addSubcommand(s => s.setName('adopt').setDescription('adopt a new pet')
      .addStringOption(o => o.setName('species').setDescription('pick a species').setRequired(true)
        .addChoices(...SPECIES.map(sp => ({ name: `${sp.label} (${sp.price})`, value: sp.id }))))
      .addStringOption(o => o.setName('name').setDescription('your pet\'s name').setRequired(true).setMaxLength(24)))
    .addSubcommand(s => s.setName('view').setDescription('check on your pet')
      .addUserOption(o => o.setName('user').setDescription('view someone else\'s pet')))
    .addSubcommand(s => s.setName('feed').setDescription('feed your pet')
      .addStringOption(o => o.setName('food').setDescription('pick a food').setRequired(true)
        .addChoices(...FOODS.map(f => ({ name: `${f.label} (${f.price})`, value: f.id })))))
    .addSubcommand(s => s.setName('drink').setDescription('give your pet a drink')
      .addStringOption(o => o.setName('drink').setDescription('pick a drink').setRequired(true)
        .addChoices(...DRINKS.map(d => ({ name: `${d.label} (${d.price})`, value: d.id })))))
    .addSubcommand(s => s.setName('play').setDescription('play with your pet'))
    .addSubcommand(s => s.setName('wash').setDescription('wash your pet'))
    .addSubcommand(s => s.setName('clean').setDescription('clean up your pet\'s poop'))
    .addSubcommand(s => s.setName('sleep').setDescription('put your pet to sleep'))
    .addSubcommand(s => s.setName('wake').setDescription('wake your pet up'))
    .addSubcommand(s => s.setName('medicine').setDescription('heal a sick pet'))
    .addSubcommand(s => s.setName('cuddle').setDescription('cuddle your pet'))
    .addSubcommand(s => s.setName('rename').setDescription('rename your pet')
      .addStringOption(o => o.setName('name').setDescription('new name').setRequired(true).setMaxLength(24)))
    .addSubcommand(s => s.setName('abandon').setDescription('give up your pet (permanent)'))
    .addSubcommand(s => s.setName('leaderboard').setDescription('healthiest pets'))
    .addSubcommand(s => s.setName('species').setDescription('list all species')),

  async execute(interaction) {
    await interaction.deferReply({ flags: V2_E }).catch(() => {});
    if (interaction.client?.pool) {
      try { store.setPool(interaction.client.pool); } catch {}
    }

    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    /* ── species list ── */
    if (sub === 'species') {
      const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.compass} species`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      const lines = SPECIES.map(sp => `${sp.emoji} **${sp.label}** · ${cash(sp.price)}\n-# ${sp.desc}`);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n\n')));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ── adopt ── */
    if (sub === 'adopt') {
      const species = interaction.options.getString('species');
      const name = interaction.options.getString('name');
      const sp = SPECIES.find(s => s.id === species);
      if (!sp) return interaction.editReply({ components: [errBox('unknown species.')], flags: V2_E });

      const existing = await store.getPet(userId);
      if (existing && existing.alive) return interaction.editReply({ components: [errBox('you already have a pet.')], flags: V2_E });

      const bal = await store.getCash(userId);
      if (bal < sp.price) return interaction.editReply({ components: [errBox(`you need ${cash(sp.price)} — you have ${cash(bal)}.`)], flags: V2_E });

      await store.spendCash(userId, sp.price);
      if (existing && !existing.alive) await store.deletePet(userId);
      const pet = await store.createPet(userId, name, species);

      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${sp.emoji} ${name} adopted!`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`you spent ${cash(sp.price)} on your new **${sp.label}**.\n\nuse \`/pets view\` to see them, and keep their stats up or they'll get sick.`))],
        flags: V2_E,
      });
    }

    /* ── leaderboard ── */
    if (sub === 'leaderboard') {
      const pets = (await store.listAll()).filter(p => p.alive).sort((a, b) => {
        const sa = a.hunger + a.thirst + a.happiness + a.energy + a.hygiene + a.health;
        const sb = b.hunger + b.thirst + b.happiness + b.energy + b.hygiene + b.health;
        return sb - sa;
      }).slice(0, 10);
      if (!pets.length) return interaction.editReply({ components: [errBox('no pets yet.')], flags: V2_E });
      const lines = pets.map((p, i) => {
        const sp = SPECIES.find(s => s.id === p.species) || SPECIES[0];
        const total = Math.round((p.hunger + p.thirst + p.happiness + p.energy + p.hygiene + p.health) / 6);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`#${i + 1}\``;
        return `${medal} ${sp.emoji} **${p.name}** · <@${p.userId}> · \`${total}/100\``;
      });
      const c = new ContainerBuilder().setAccentColor(0xf5c34a);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.crown} healthiest pets`));
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ── everything else needs a pet ── */
    const target = interaction.options.getUser?.('user') || interaction.user;
    const pet = await store.getPet(target.id);

    if (!pet) {
      return interaction.editReply({ components: [errBox(target.id === userId ? 'you don\'t have a pet yet. use `/pets adopt`.' : 'that user has no pet.')], flags: V2_E });
    }

    /* ── view ── */
    if (sub === 'view') {
      return interaction.editReply({ components: [petCard(pet)], flags: V2_E });
    }

    /* ── self-only actions from here ── */
    if (target.id !== userId) {
      return interaction.editReply({ components: [errBox('you can only do that to your own pet.')], flags: V2_E });
    }
    if (!pet.alive) {
      return interaction.editReply({ components: [errBox(`your pet **${pet.name}** is dead. use \`/pets adopt\` for a new one.`)], flags: V2_E });
    }

    /* ── feed ── */
    if (sub === 'feed') {
      const foodId = interaction.options.getString('food');
      const food = FOODS.find(f => f.id === foodId);
      if (!food) return interaction.editReply({ components: [errBox('unknown food.')], flags: V2_E });
      const cost = await store.spendCash(userId, food.price);
      if (!cost.ok) return interaction.editReply({ components: [errBox(`not enough cash (${cash(food.price)})`)], flags: V2_E });
      const r = engine.feed(pet, foodId);
      if (!r.ok) {
        await store.addCash(userId, food.price);
        return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      }
      await store.savePet(userId);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${food.emoji} fed ${pet.name}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`+${food.hunger} hunger · +${food.happiness} happy\n-# spent ${cash(food.price)}`))],
        flags: V2_E,
      });
    }

    /* ── drink ── */
    if (sub === 'drink') {
      const drinkId = interaction.options.getString('drink');
      const drink = DRINKS.find(d => d.id === drinkId);
      if (!drink) return interaction.editReply({ components: [errBox('unknown drink.')], flags: V2_E });
      const cost = await store.spendCash(userId, drink.price);
      if (!cost.ok) return interaction.editReply({ components: [errBox(`not enough cash (${cash(drink.price)})`)], flags: V2_E });
      const r = engine.drink(pet, drinkId);
      if (!r.ok) {
        await store.addCash(userId, drink.price);
        return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      }
      await store.savePet(userId);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${drink.emoji} gave ${pet.name} a ${drink.label}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`+${drink.thirst} thirst · +${drink.happiness} happy\n-# spent ${cash(drink.price)}`))],
        flags: V2_E,
      });
    }

    /* ── play ── */
    if (sub === 'play') {
      const r = engine.play(pet);
      if (!r.ok) return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      await store.savePet(userId);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${PET_EMOJI.happiness} played with ${pet.name}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`+${r.gain} happiness · -10 energy · -5 hunger · -5 thirst`))],
        flags: V2_E,
      });
    }

    /* ── wash ── */
    if (sub === 'wash') {
      const r = engine.wash(pet);
      if (!r.ok) return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      await store.savePet(userId);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${PET_EMOJI.hygiene} washed ${pet.name}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`+50 hygiene · +5 happiness`))],
        flags: V2_E,
      });
    }

    /* ── clean poop ── */
    if (sub === 'clean') {
      if (!pet.poops) return interaction.editReply({ components: [errBox('no poop to clean.')], flags: V2_E });
      const r = engine.cleanPoop(pet);
      await store.savePet(userId);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${PET_EMOJI.poop} cleaned up`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`removed ${r.cleaned} poop(s).`))],
        flags: V2_E,
      });
    }

    /* ── sleep ── */
    if (sub === 'sleep') {
      const r = engine.sleep(pet);
      if (!r.ok) return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      await store.savePet(userId);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x5b7fd4)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${PET_EMOJI.sleep} ${pet.name} is sleeping`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`stats decay slower · energy regenerates each tick.`))],
        flags: V2_E,
      });
    }

    /* ── wake ── */
    if (sub === 'wake') {
      const r = engine.wake(pet);
      if (!r.ok) return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      await store.savePet(userId);
      return interaction.editReply({
        components: [okBox(`${pet.name} is awake.`)],
        flags: V2_E,
      });
    }

    /* ── medicine ── */
    if (sub === 'medicine') {
      const cost = await store.spendCash(userId, MEDICINE.price);
      if (!cost.ok) return interaction.editReply({ components: [errBox(`not enough cash (${cash(MEDICINE.price)})`)], flags: V2_E });
      const r = engine.medicine(pet);
      if (!r.ok) {
        await store.addCash(userId, MEDICINE.price);
        return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      }
      await store.savePet(userId);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${MEDICINE.emoji} healed ${pet.name}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`+30 health · no longer sick\n-# spent ${cash(MEDICINE.price)}`))],
        flags: V2_E,
      });
    }

    /* ── cuddle ── */
    if (sub === 'cuddle') {
      const r = engine.cuddle(pet);
      if (!r.ok) return interaction.editReply({ components: [errBox(r.reason)], flags: V2_E });
      await store.savePet(userId);
      return interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0x57f287)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${EMOJI.friends} you cuddled ${pet.name}`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`+5 happiness`))],
        flags: V2_E,
      });
    }

    /* ── rename ── */
    if (sub === 'rename') {
      const newName = interaction.options.getString('name');
      pet.name = newName;
      await store.savePet(userId);
      return interaction.editReply({ components: [okBox(`renamed to **${newName}**.`)], flags: V2_E });
    }

    /* ── abandon ── */
    if (sub === 'abandon') {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pet_yes').setLabel('abandon').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('pet_no').setLabel('cancel').setStyle(ButtonStyle.Secondary),
      );
      await interaction.editReply({
        components: [new ContainerBuilder().setAccentColor(0xff3b3b)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.error} abandon ${pet.name}?`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`this is permanent. you'll lose everything.`))
          .addActionRowComponents(row)],
        flags: V2_E,
      });
      const msg = await interaction.fetchReply();
      const click = await new Promise(resolve => {
        const col = msg.createMessageComponentCollector({ time: 30000, max: 1, filter: i => i.user.id === userId });
        col.on('collect', i => resolve(i));
        col.on('end', (_, r) => { if (r === 'time') resolve(null); });
      });
      if (!click) return;
      await click.deferUpdate().catch(() => {});
      if (click.customId === 'pet_yes') {
        await store.deletePet(userId);
        return interaction.editReply({ components: [okBox(`said goodbye to **${pet.name}**.`)], flags: V2_E });
      }
      return interaction.editReply({ components: [okBox('cancelled.')], flags: V2_E });
    }
  },
};
