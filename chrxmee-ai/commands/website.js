const {
  SlashCommandBuilder,
  ApplicationIntegrationType,
  InteractionContextType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} = require('discord.js');

const dns = require('node:dns').promises;
const tls = require('node:tls');
const https = require('node:https');

/* ═══════════════ emojis ═══════════════ */
const E = {
  success:  "<:Verified_Icon:1527194184841167010>",
  error:    "<:no:1530373946795364362>",
  ai:       "<:Chrxmaticc_AI:1480094799292928132>",
  settings: "<:Settings:1525601248278216725>",
  angry:    "<:angry_cry:1526029511882440744>",
  file:     "<:File_Icon:1526542046213570681>",
  folder:   "<:Folder_Icon:1526542112806539274>",
  compass:  "<:Compass_Discover_Icon:1526542192494248067>",
  link:     "<:Link:1525603398341103806>",
  lock:     "<:lock:1530377198324945056>",
  unlock:   "<:unlock:1530377714995826831>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
  pc:       "<:Computer_PC:1526541989376688318>",
  cursor:   "<:Cursor_Code:1526703109345116310>",
  son:      "<:Son:1526536930693484575>",
  qsob:     "<:qsob:1526706054396645487>",
  skull:    "<a:skulllmao:1544845693762535477>",
};

const COLORS = {
  blue: 0x7289da, red: 0xff3b3b, green: 0x57f287,
  purple: 0x9b59b6, gold: 0xf1c40f, default: 0x5b7fd4,
  orange: 0xe67e22, pink: 0xff69b4, blurple: 0x5865f2,
  cyan: 0x00d4ff, dark: 0x1a1a1a,
};

const V2 = MessageFlags.IsComponentsV2;
const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

/* ═══════════════ helpers ═══════════════ */
function normalizeUrl(input) {
  let url = String(input).trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try {
    const u = new URL(url);
    return u;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, opts = {}, ms = 10000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal, redirect: 'follow' });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function getPageInfo(url) {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; chromed/1.0; +https://chromed.bot)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, 12000);

    const html = await res.text();
    const elapsed = Date.now() - start;

    const get = (regex) => {
      const m = html.match(regex);
      return m ? m[1].trim() : null;
    };

    const title = get(/<title[^>]*>([^<]*)<\/title>/i);
    const description =
      get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      get(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i);
    const ogTitle = get(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i);
    const ogImage = get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i);
    const ogSiteName = get(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i);
    const themeColor = get(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']*)["']/i);
    const generator = get(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i);
    const lang = get(/<html[^>]+lang=["']([^"']*)["']/i);
    const charset = get(/<meta[^>]+charset=["']?([^"'\s/>]+)/i);
    const canonical = get(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);

    // favicon
    let favicon = null;
    const favMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']*)["']/i);
    if (favMatch) {
      try { favicon = new URL(favMatch[1], url).href; } catch { favicon = null; }
    }

    // word count
    const textOnly = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = textOnly ? textOnly.split(' ').length : 0;

    return {
      ok: true,
      status: res.status,
      statusText: res.statusText,
      elapsed,
      finalUrl: res.url,
      headers: Object.fromEntries(res.headers),
      title, description, ogTitle, ogImage, ogSiteName, themeColor, generator, lang, charset, canonical, favicon, wordCount,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function tlsInfo(hostname, port = 443, timeout = 8000) {
  return new Promise((resolve) => {
    let done = false;
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false, timeout }, () => {
      if (done) return; done = true;
      try {
        const cert = socket.getPeerCertificate();
        resolve({
          ok: true,
          authorized: socket.authorized,
          protocol: socket.getProtocol(),
          cipher: socket.getCipher()?.name,
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysLeft: Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000),
          fingerprint: cert.fingerprint,
        });
      } catch (e) {
        resolve({ ok: false, error: e.message });
      } finally {
        socket.destroy();
      }
    });
    socket.on('error', (e) => { if (!done) { done = true; resolve({ ok: false, error: e.message }); } });
    socket.on('timeout', () => { if (!done) { done = true; socket.destroy(); resolve({ ok: false, error: 'timeout' }); } });
  });
}

function screenshotUrl(url, opts = {}) {
  const width = opts.width || 1280;
  const crop = opts.crop || 800;
  const fullPage = opts.fullPage ? 'fullpage/' : `crop/${crop}/`;
  const dark = opts.dark ? 'darkMode/' : '';
  return `https://image.thum.io/get/width/${width}/${dark}${fullPage}noanimate/${url}`;
}

/* ═══════════════ module ═══════════════ */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('website')
    .setDescription('everything you can do to a website')
    .setIntegrationTypes(
      ApplicationIntegrationType.GuildInstall,
      ApplicationIntegrationType.UserInstall,
    )
    .setContexts(
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    )

    .addSubcommand(s => s.setName('screenshot').setDescription('screenshot a webpage')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
      .addBooleanOption(o => o.setName('full_page').setDescription('full-page screenshot').setRequired(false))
      .addBooleanOption(o => o.setName('dark_mode').setDescription('render in dark mode').setRequired(false))
    )

    .addSubcommand(s => s.setName('info').setDescription('title, description, og tags, favicon')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    )

    .addSubcommand(s => s.setName('status').setDescription('http status, response time, redirects')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    )

    .addSubcommand(s => s.setName('headers').setDescription('raw http headers')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    )

    .addSubcommand(s => s.setName('dns').setDescription('dns records for a domain')
      .addStringOption(o => o.setName('domain').setDescription('example.com').setRequired(true))
    )

    .addSubcommand(s => s.setName('ssl').setDescription('ssl certificate info')
      .addStringOption(o => o.setName('domain').setDescription('example.com').setRequired(true))
    )

    .addSubcommand(s => s.setName('robots').setDescription('fetch robots.txt')
      .addStringOption(o => o.setName('domain').setDescription('example.com').setRequired(true))
    )

    .addSubcommand(s => s.setName('sitemap').setDescription('check for a sitemap')
      .addStringOption(o => o.setName('domain').setDescription('example.com').setRequired(true))
    )

    .addSubcommand(s => s.setName('preview').setDescription('full preview card — screenshot + og data')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    await interaction.deferReply({ flags: V2_E });

    const errBox = (msg) => new ContainerBuilder()
      .setAccentColor(COLORS.red)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${msg}`));

    /* ──── SCREENSHOT ──── */
    if (sub === 'screenshot') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const fullPage = interaction.options.getBoolean('full_page') ?? false;
      const dark = interaction.options.getBoolean('dark_mode') ?? false;

      const shot = screenshotUrl(parsed.href, { fullPage, dark, width: 1280, crop: 800 });

      const c = new ContainerBuilder()
        .setAccentColor(COLORS.cyan)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.pc} screenshot`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${parsed.hostname}${fullPage ? ' · full page' : ''}${dark ? ' · dark' : ''}`))
        .addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(shot))
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('open in browser').setURL(parsed.href).setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('open screenshot').setURL(shot).setStyle(ButtonStyle.Link),
          )
        );

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── INFO ──── */
    if (sub === 'info') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const info = await getPageInfo(parsed.href);
      if (!info.ok) return interaction.editReply({ components: [errBox(`couldn't fetch — ${info.error}`)], flags: V2_E });

      const c = new ContainerBuilder().setAccentColor(COLORS.blue);

      const headerText = [
        `## ${E.compass} ${info.ogTitle || info.title || parsed.hostname}`,
        `-# ${info.finalUrl}`,
      ].join('\n');

      if (info.favicon || info.ogImage) {
        c.addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(info.favicon || info.ogImage))
        );
      } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerText));
      }

      if (info.description) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(info.description.slice(0, 600)));
      }

      if (info.ogImage) {
        c.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(info.ogImage))
        );
      }

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      const meta = [];
      if (info.ogSiteName) meta.push(`**site** · ${info.ogSiteName}`);
      if (info.lang) meta.push(`**lang** · \`${info.lang}\``);
      if (info.charset) meta.push(`**charset** · \`${info.charset}\``);
      if (info.generator) meta.push(`**generator** · \`${info.generator}\``);
      if (info.canonical) meta.push(`**canonical** · ${info.canonical.slice(0, 80)}`);
      meta.push(`**words** · ${info.wordCount.toLocaleString()}`);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(meta.join('\n')));

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('open site').setURL(info.finalUrl).setStyle(ButtonStyle.Link),
          ...(info.favicon ? [new ButtonBuilder().setLabel('favicon').setURL(info.favicon).setStyle(ButtonStyle.Link)] : []),
        )
      );

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── STATUS ──── */
    if (sub === 'status') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const info = await getPageInfo(parsed.href);

      if (!info.ok) {
        return interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.red)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.error} site is down`))
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
              `**host** · \`${parsed.hostname}\``,
              `**error** · \`${info.error}\``,
            ].join('\n')))],
          flags: V2_E,
        });
      }

      const statusEmoji = info.status < 300 ? E.success : info.status < 400 ? E.on : info.status < 500 ? E.angry : E.error;
      const statusColor = info.status < 300 ? COLORS.green : info.status < 400 ? COLORS.gold : COLORS.red;
      const ms = info.elapsed;
      const speed = ms < 300 ? '🟢 fast' : ms < 1000 ? '🟡 ok' : '🔴 slow';

      const c = new ContainerBuilder()
        .setAccentColor(statusColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${statusEmoji} \`${info.status} ${info.statusText}\``))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${parsed.hostname}`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `**response** · \`${ms}ms\` · ${speed}`,
          `**redirects to** · ${info.finalUrl === parsed.href ? '*no redirect*' : info.finalUrl}`,
          `**content-type** · \`${info.headers['content-type'] || 'unknown'}\``,
          `**server** · \`${info.headers['server'] || 'hidden'}\``,
        ].join('\n')));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── HEADERS ──── */
    if (sub === 'headers') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const info = await getPageInfo(parsed.href);
      if (!info.ok) return interaction.editReply({ components: [errBox(`couldn't fetch — ${info.error}`)], flags: V2_E });

      const priority = [
        'server', 'content-type', 'content-length', 'content-encoding',
        'cache-control', 'x-powered-by', 'strict-transport-security',
        'content-security-policy', 'x-frame-options', 'x-content-type-options',
        'cf-cache-status', 'cf-ray', 'x-vercel-id', 'x-vercel-cache',
        'via', 'vary', 'age', 'etag',
      ];

      const seen = new Set();
      const lines = [];
      for (const k of priority) {
        if (info.headers[k]) {
          seen.add(k);
          const v = String(info.headers[k]).slice(0, 120);
          lines.push(`**${k}** · \`${v}\``);
        }
      }
      for (const [k, v] of Object.entries(info.headers)) {
        if (!seen.has(k) && !k.startsWith(':') && lines.length < 25) {
          lines.push(`**${k}** · \`${String(v).slice(0, 100)}\``);
        }
      }

      const c = new ContainerBuilder()
        .setAccentColor(COLORS.purple)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.file} headers`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${parsed.hostname}`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n') || '*no headers*'));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── DNS ──── */
    if (sub === 'dns') {
      const domain = interaction.options.getString('domain').trim().replace(/^https?:\/\//, '').split('/')[0];

      const [a, aaaa, ns, mx, txt, cname] = await Promise.all([
        dns.resolve4(domain).catch(() => []),
        dns.resolve6(domain).catch(() => []),
        dns.resolveNs(domain).catch(() => []),
        dns.resolveMx(domain).catch(() => []),
        dns.resolveTxt(domain).catch(() => []),
        dns.resolveCname(domain).catch(() => []),
      ]);

      const c = new ContainerBuilder()
        .setAccentColor(COLORS.cyan)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.link} dns records`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${domain}`));

      const sections = [];
      if (a.length) sections.push(`**A**\n${a.slice(0, 8).map(ip => `\`${ip}\``).join(' ')}`);
      if (aaaa.length) sections.push(`**AAAA**\n${aaaa.slice(0, 4).map(ip => `\`${ip}\``).join(' ')}`);
      if (cname.length) sections.push(`**CNAME**\n${cname.map(x => `\`${x}\``).join(' ')}`);
      if (ns.length) sections.push(`**NS**\n${ns.slice(0, 6).map(x => `\`${x}\``).join('\n')}`);
      if (mx.length) sections.push(`**MX**\n${mx.slice(0, 6).map(m => `\`${m.priority}\` ${m.exchange}`).join('\n')}`);
      if (txt.length) {
        const cleaned = txt.slice(0, 4).map(t => t.join('')).filter(t => t.length < 120);
        if (cleaned.length) sections.push(`**TXT**\n${cleaned.map(t => `\`${t}\``).join('\n')}`);
      }

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(sections.join('\n\n') || '*no records found*'));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── SSL ──── */
    if (sub === 'ssl') {
      const domain = interaction.options.getString('domain').trim().replace(/^https?:\/\//, '').split('/')[0];
      const info = await tlsInfo(domain);

      if (!info.ok) {
        return interaction.editReply({ components: [errBox(`ssl check failed — ${info.error}`)], flags: V2_E });
      }

      const statusColor = info.daysLeft > 30 ? COLORS.green : info.daysLeft > 7 ? COLORS.gold : COLORS.red;
      const statusEmoji = info.daysLeft > 30 ? E.success : info.daysLeft > 7 ? E.on : E.error;

      const c = new ContainerBuilder()
        .setAccentColor(statusColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${statusEmoji} ${info.daysLeft} days left`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${domain}`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `**issued to** · \`${info.subject?.CN || 'unknown'}\``,
          `**issuer** · \`${info.issuer?.O || info.issuer?.CN || 'unknown'}\``,
          `**valid from** · \`${info.validFrom}\``,
          `**valid until** · \`${info.validTo}\``,
          `**protocol** · \`${info.protocol}\``,
          `**cipher** · \`${info.cipher}\``,
          `**fingerprint** · \`${info.fingerprint?.slice(0, 32)}...\``,
          `**authorized** · ${info.authorized ? E.success + ' yes' : E.error + ' no'}`,
        ].join('\n')));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── ROBOTS ──── */
    if (sub === 'robots') {
      const domain = interaction.options.getString('domain').trim().replace(/^https?:\/\//, '').split('/')[0];

      try {
        const res = await fetchWithTimeout(`https://${domain}/robots.txt`, {}, 8000);
        if (!res.ok) {
          return interaction.editReply({ components: [errBox(`no robots.txt found (${res.status}).`)], flags: V2_E });
        }
        const text = await res.text();
        const trimmed = text.length > 1800 ? text.slice(0, 1800) + '\n... (truncated)' : text;

        const c = new ContainerBuilder()
          .setAccentColor(COLORS.orange)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} robots.txt`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${domain}`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`\n${trimmed}\n\`\`\``));

        return interaction.editReply({ components: [c], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`couldn't fetch — ${e.message}`)], flags: V2_E });
      }
    }

    /* ──── SITEMAP ──── */
    if (sub === 'sitemap') {
      const domain = interaction.options.getString('domain').trim().replace(/^https?:\/\//, '').split('/')[0];

      const candidates = [`https://${domain}/sitemap.xml`, `https://${domain}/sitemap_index.xml`];
      let found = null;

      for (const url of candidates) {
        try {
          const res = await fetchWithTimeout(url, {}, 8000);
          if (res.ok) {
            const text = await res.text();
            const urls = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
            found = { url, count: urls.length, sample: urls.slice(0, 10), raw: text };
            break;
          }
        } catch {}
      }

      if (!found) {
        return interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(COLORS.red)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} no sitemap found at \`${domain}\``))],
          flags: V2_E,
        });
      }

      const c = new ContainerBuilder()
        .setAccentColor(COLORS.green)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} sitemap found`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# \`${found.url}\``))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**urls** · ${found.count}`));

      if (found.sample.length) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
          found.sample.slice(0, 10).map(u => `-# ${u.slice(0, 100)}`).join('\n')
        ));
      }

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── PREVIEW ──── */
    if (sub === 'preview') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const [info] = await Promise.all([getPageInfo(parsed.href)]);

      const shot = screenshotUrl(parsed.href, { width: 1280, crop: 720 });
      const siteName = info.ok ? (info.ogSiteName || parsed.hostname) : parsed.hostname;
      const title = info.ok ? (info.ogTitle || info.title || parsed.hostname) : parsed.hostname;
      const description = info.ok ? info.description : null;

      const c = new ContainerBuilder()
        .setAccentColor(info.ok && info.status < 400 ? COLORS.blue : COLORS.red)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.link} ${title}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${siteName} · ${parsed.href}`));

      if (description) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(description.slice(0, 400)));
      }

      c.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(shot))
      );

      if (info.ok) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `**status** · \`${info.status}\``,
          `**response** · \`${info.elapsed}ms\``,
          `**words** · ${info.wordCount.toLocaleString()}`,
        ].join(' · ')));
      }

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('open site').setURL(parsed.href).setStyle(ButtonStyle.Link),
          new ButtonBuilder().setLabel('screenshot').setURL(shot).setStyle(ButtonStyle.Link),
        )
      );

      return interaction.editReply({ components: [c], flags: V2_E });
    }
  },
};
