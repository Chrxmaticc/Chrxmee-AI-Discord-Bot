/* cogs/verification/engine.js — the verify flow */

const {
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  PermissionFlagsBits,
} = require('discord.js');

const config = require('./config');
const store = require('./store');
const captcha = require('./captcha');
const altDetect = require('./altDetect');
const antiRaid = require('./antiRaid');
const log = require('./log');

const V2 = MessageFlags.IsComponentsV2;
const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  settings: "<:Settings:1525601248278216725>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  lock:     "<:lock:1530377198324945056>",
  unlock:   "<:unlock:1530377714995826831>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
};

/* pending DM codes: `${guildId}:${userId}` -> { code, expiresAt } */
const dmCodes = new Map();

/* ───── helpers ───── */
function errBox(msg) {
  return new ContainerBuilder().setAccentColor(0xff3b3b)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${msg}`));
}
function okBox(msg) {
  return new ContainerBuilder().setAccentColor(0x57f287)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.success} ${msg}`));
}

async function grantVerified(member, method) {
  const cfg = config.get(member.guild.id);
  const guildId = member.guild.id;
  const userId = member.id;

  const remove = [
    cfg.roleUnverified,
    cfg.rolePending,
    cfg.roleQuarantine,
  ].filter(Boolean);
  if (cfg.bloxlinkStripOnVerify && cfg.roleBloxlink) remove.push(cfg.roleBloxlink);

  for (const rid of remove) {
    if (member.roles.cache.has(rid)) await member.roles.remove(rid).catch(() => {});
  }
  if (cfg.roleVerified && !member.roles.cache.has(cfg.roleVerified)) {
    await member.roles.add(cfg.roleVerified).catch(() => {});
  }

  const expiresAt = cfg.rememberDays > 0 ? Date.now() + cfg.rememberDays * 86400000 : null;
  store.setUser(guildId, userId, {
    status: 'verified',
    method,
    verifiedAt: Date.now(),
    expiresAt,
    attempts: 0,
  });

  /* welcome */
  if (cfg.verifiedWelcomeChannel && cfg.verifiedWelcomeMessage) {
    const ch = member.guild.channels.cache.get(cfg.verifiedWelcomeChannel);
    if (ch) {
      const text = cfg.verifiedWelcomeMessage
        .replace(/\{user\}/g, `<@${userId}>`)
        .replace(/\{server\}/g, member.guild.name);
      await ch.send({ content: text }).catch(() => {});
    }
  }

  /* dm */
  if (cfg.dmVerifySuccess) {
    const msg = cfg.dmVerifySuccess
      .replace(/\{user\}/g, member.user.username)
      .replace(/\{server\}/g, member.guild.name);
    await member.send({ content: msg }).catch(() => {});
  }

  await log.log(member.client, guildId, {
    icon: E.success,
    color: 0x57f287,
    title: 'verify · success',
    body: `<@${userId}> verified via \`${method}\``,
  });
}

async function punishFail(member, reason) {
  const cfg = config.get(member.guild.id);
  const guildId = member.guild.id;
  const userId = member.id;

  store.setUser(guildId, userId, {
    status: cfg.failAction === 'quarantine' ? 'quarantined' : 'failed',
    quarantinedAt: Date.now(),
  });

  if (cfg.failAction === 'quarantine' && cfg.roleQuarantine) {
    if (cfg.roleVerified && member.roles.cache.has(cfg.roleVerified)) {
      await member.roles.remove(cfg.roleVerified).catch(() => {});
    }
    if (cfg.roleUnverified && member.roles.cache.has(cfg.roleUnverified)) {
      await member.roles.remove(cfg.roleUnverified).catch(() => {});
    }
    await member.roles.add(cfg.roleQuarantine).catch(() => {});
    if (cfg.dmQuarantine) {
      const msg = cfg.dmQuarantine.replace(/\{server\}/g, member.guild.name);
      await member.send({ content: msg }).catch(() => {});
    }
  } else if (cfg.failAction === 'kick') {
    await member.kick(reason).catch(() => {});
  } else if (cfg.failAction === 'manual') {
    await log.log(member.client, guildId, {
      icon: E.lock,
      color: 0xf5c34a,
      title: 'manual review needed',
      body: `<@${userId}> failed verification — waiting for staff`,
    });
  } else {
    /* none — send fail dm, let them retry */
    if (cfg.dmVerifyFail) {
      const msg = cfg.dmVerifyFail
        .replace(/\{reason\}/g, reason)
        .replace(/\{channel\}/g, cfg.panelChannel ? `<#${cfg.panelChannel}>` : '');
      await member.send({ content: msg }).catch(() => {});
    }
  }

  await log.logAttempt(member.client, guildId, userId, 'unknown', 'failed', reason);
}

/* ───── entry point ───── */
async function startVerify(interaction) {
  const cfg = config.get(interaction.guildId);
  if (!cfg.enabled) {
    return interaction.reply({ components: [errBox('verification is not enabled in this server.')], flags: V2_E }).catch(() => {});
  }
  if (!cfg.roleVerified || !cfg.roleUnverified) {
    return interaction.reply({ components: [errBox('verification is not fully configured. contact staff.')], flags: V2_E }).catch(() => {});
  }

  const member = interaction.member;
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  /* already remembered as verified? */
  if (store.isVerifiedRemembered(guildId, userId)) {
    return interaction.reply({ components: [okBox("you're already verified.")], flags: V2_E }).catch(() => {});
  }
  if (member.roles.cache.has(cfg.roleVerified)) {
    return interaction.reply({ components: [okBox("you're already verified.")], flags: V2_E }).catch(() => {});
  }

  /* raid mode check */
  if (antiRaid.isRaidActive(guildId) && cfg.antiraidForceCaptcha) {
    return runMethod(interaction, 'captcha', 'raid_mode');
  }

  /* suspicious score */
  const score = await altDetect.scoreMember(member, cfg, { raidMode: antiRaid.isRaidActive(guildId) });
  store.setUser(guildId, userId, { suspiciousScore: score.total });

  const forced = altDetect.shouldForceStronger(score.total, cfg);
  const method = forced || cfg.methodPrimary || cfg.methods[0] || 'button';

  return runMethod(interaction, method, forced ? 'suspicious' : 'normal');
}

async function runMethod(interaction, method, triggerReason) {
  switch (method) {
    case 'button':
    case 'reaction':
      return methodButton(interaction);
    case 'captcha':
      return methodCaptcha(interaction);
    case 'math':
      return methodMath(interaction);
    case 'quiz':
      return methodQuiz(interaction);
    case 'dmcode':
      return methodDmCode(interaction);
    case 'manual':
      return methodManual(interaction);
    default:
      return methodButton(interaction);
  }
}

/* ───── method: button ───── */
async function methodButton(interaction) {
  const member = interaction.member;
  await interaction.reply({ components: [okBox('verifying...')], flags: V2_E }).catch(() => {});
  await grantVerified(member, 'button');
  await interaction.editReply({ components: [okBox("you're verified. welcome!")] }).catch(() => {});
}

/* ───── method: captcha ───── */
async function methodCaptcha(interaction) {
  const cfg = config.get(interaction.guildId);
  const result = await captcha.createCaptcha(cfg.captchaStyle || 'text', {
    length: cfg.captchaLength || 5,
    caseSensitive: cfg.captchaCaseSensitive,
    expirySeconds: cfg.captchaExpirySeconds,
    maxAttempts: cfg.captchaMaxAttempts,
    color: cfg.captchaBrandColor,
  });

  const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.lock} verification`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent('type the code shown in the image below to verify.'));
  c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL('attachment://captcha.png')
  ));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# expires in ${Math.round((cfg.captchaExpirySeconds || 300) / 60)} min`));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`verify_captcha_open_${result.token}`).setLabel('enter code').setStyle(ButtonStyle.Primary)
  );
  c.addActionRowComponents(row);

  await interaction.reply({
    components: [c],
    files: [{ attachment: result.buffer, name: 'captcha.png' }],
    flags: V2_E,
  }).catch(() => {});
}

/* ───── method: math ───── */
async function methodMath(interaction) {
  const cfg = config.get(interaction.guildId);
  const result = await captcha.createCaptcha('math', {
    difficulty: 'medium',
    expirySeconds: cfg.captchaExpirySeconds,
    maxAttempts: cfg.captchaMaxAttempts,
    color: cfg.captchaBrandColor,
  });

  const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.compass} verification`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent('solve the problem below to verify.'));
  c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
    new MediaGalleryItemBuilder().setURL('attachment://math.png')
  ));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`verify_captcha_open_${result.token}`).setLabel('submit answer').setStyle(ButtonStyle.Primary)
  );
  c.addActionRowComponents(row);

  await interaction.reply({
    components: [c],
    files: [{ attachment: result.buffer, name: 'math.png' }],
    flags: V2_E,
  }).catch(() => {});
}

/* ───── method: quiz (placeholder — falls back to captcha if no questions) ───── */
async function methodQuiz(interaction) {
  const cfg = config.get(interaction.guildId);
  if (!cfg.quizQuestions || !cfg.quizQuestions.length) return methodCaptcha(interaction);
  /* simple: post first question as modal placeholder */
  const modal = new ModalBuilder().setCustomId('verify_quiz_modal').setTitle('rules quiz');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('a1').setLabel(cfg.quizQuestions[0].q.slice(0, 45)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
  ));
  await interaction.showModal(modal).catch(() => {});
}

/* ───── method: dm code ───── */
async function methodDmCode(interaction) {
  const member = interaction.member;
  const key = `${interaction.guildId}:${member.id}`;
  const code = String(Math.floor(100000 + Math.random() * 900000));
  dmCodes.set(key, { code, expiresAt: Date.now() + 10 * 60 * 1000 });

  const sent = await member.send({
    content: `your verification code for **${interaction.guild.name}** is \`${code}\`\n-# expires in 10 minutes`,
  }).catch(() => null);

  if (!sent) {
    return interaction.reply({ components: [errBox('could not dm you. open your dms and try again.')], flags: V2_E }).catch(() => {});
  }

  const modal = new ModalBuilder().setCustomId('verify_dmcode_modal').setTitle('enter your code');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('code').setLabel('6-digit code').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6)
  ));
  await interaction.showModal(modal).catch(() => {});
}

/* ───── method: manual ───── */
async function methodManual(interaction) {
  const cfg = config.get(interaction.guildId);
  const member = interaction.member;
  const user = store.getUser(interaction.guildId, member.id);
  store.setUser(interaction.guildId, member.id, { status: 'pending' });

  const c = new ContainerBuilder().setAccentColor(0x5b7fd4);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.settings} awaiting staff approval`));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent('a moderator will review your verification shortly.'));

  await interaction.reply({ components: [c], flags: V2_E }).catch(() => {});

  await log.log(interaction.client, interaction.guildId, {
    icon: E.settings,
    color: 0xf5c34a,
    title: 'manual verify pending',
    body: `<@${member.id}> is awaiting staff approval\nuse \`/verification force-verify @${member.user.username}\` to approve`,
    footer: `suspicious score: ${user.suspiciousScore || 0}`,
  });
}

/* ───── captcha modal submit handler ───── */
async function handleCaptchaModal(interaction, token) {
  const submitted = interaction.fields.getTextInputValue('code');
  const res = captcha.checkCaptcha(token, submitted);
  const member = interaction.member;
  const guildId = interaction.guildId;

  if (res.ok) {
    await interaction.reply({ components: [okBox('verified!')], flags: V2_E }).catch(() => {});
    await grantVerified(member, 'captcha');
    return;
  }

  await log.logAttempt(interaction.client, guildId, member.id, 'captcha', res.reason, res.reason);

  if (res.reason === 'max_attempts') {
    await interaction.reply({ components: [errBox('too many attempts.')], flags: V2_E }).catch(() => {});
    await punishFail(member, 'max_attempts');
    return;
  }

  const msg = res.reason === 'expired' ? 'expired. try again.' : `wrong. ${res.attemptsLeft} attempt(s) left.`;
  await interaction.reply({ components: [errBox(msg)], flags: V2_E }).catch(() => {});
}

/* ───── dm code modal submit ───── */
async function handleDmCodeModal(interaction) {
  const key = `${interaction.guildId}:${interaction.user.id}`;
  const entry = dmCodes.get(key);
  const submitted = interaction.fields.getTextInputValue('code').trim();

  if (!entry || Date.now() > entry.expiresAt) {
    dmCodes.delete(key);
    return interaction.reply({ components: [errBox('code expired. try again.')], flags: V2_E }).catch(() => {});
  }
  if (submitted !== entry.code) {
    return interaction.reply({ components: [errBox('wrong code.')], flags: V2_E }).catch(() => {});
  }
  dmCodes.delete(key);
  await interaction.reply({ components: [okBox('verifying...')], flags: V2_E }).catch(() => {});
  await grantVerified(interaction.member, 'dmcode');
  await interaction.editReply({ components: [okBox("you're verified.")] }).catch(() => {});
}

/* ───── first-join handler ───── */
async function onJoin(member) {
  const cfg = config.get(member.guild.id);
  if (!cfg.enabled) return;

  /* antiraid check */
  const raidTriggered = antiRaid.checkOnJoin(member.guild.id);

  /* assign unverified */
  if (cfg.roleUnverified && !member.roles.cache.has(cfg.roleUnverified)) {
    await member.roles.add(cfg.roleUnverified).catch(() => {});
  }

  /* dm on join */
  if (cfg.dmOnJoin) {
    const msg = cfg.dmOnJoin
      .replace(/\{user\}/g, member.user.username)
      .replace(/\{server\}/g, member.guild.name)
      .replace(/\{channel\}/g, cfg.panelChannel ? `<#${cfg.panelChannel}>` : 'the verify channel');
    await member.send({ content: msg }).catch(() => {});
  }

  await log.log(member.client, member.guild.id, {
    icon: E.unlock,
    color: 0x5b7fd4,
    title: 'member joined',
    body: `<@${member.id}> · ${member.user.username}`,
    footer: raidTriggered ? '🚨 raid mode activated' : undefined,
  });

  if (raidTriggered) {
    await log.log(member.client, member.guild.id, {
      icon: E.lock,
      color: 0xff3b3b,
      title: 'raid mode triggered',
      body: `${cfg.antiraidThreshold} joins in ${cfg.antiraidWindowSeconds}s — forcing captcha for ${cfg.antiraidDurationMinutes} min`,
    });
  }
}

/* ───── rejoin check ───── */
async function onRejoin(member) {
  const cfg = config.get(member.guild.id);
  if (!cfg.enabled) return;
  if (store.isVerifiedRemembered(member.guild.id, member.id)) {
    /* re-grant verified role */
    if (cfg.roleVerified && !member.roles.cache.has(cfg.roleVerified)) {
      await member.roles.add(cfg.roleVerified).catch(() => {});
    }
    if (cfg.roleUnverified && member.roles.cache.has(cfg.roleUnverified)) {
      await member.roles.remove(cfg.roleUnverified).catch(() => {});
    }
    return;
  }
  return onJoin(member);
}

module.exports = {
  startVerify,
  grantVerified,
  punishFail,
  handleCaptchaModal,
  handleDmCodeModal,
  onJoin,
  onRejoin,
};
