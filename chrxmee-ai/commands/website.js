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
  pc:       "<:Computer_PC:1526541989376688318>",
  cursor:   "<:Cursor_Code:1526703109345116310>",
  lock:     "<:lock:1530377198324945056>",
  unlock:   "<:unlock:1530377714995826831>",
  on:       "<:on:1545571641684135946>",
  off:      "<:off:1545571608897265726>",
  bot:      "<:Bot:1525492838727548999>",
  dev:      "<:Developer:1525492198035161192>",
  son:      "<:Son:1526536930693484575>",
  qsob:     "<:qsob:1526706054396645487>",
  skull:    "<a:skulllmao:1544845693762535477>",
  wheel:    "<:Adaption_Wheel:1526537780229046342>",
};

/* ═══════════════ grey palette ═══════════════ */
const GREY = {
  main:   0x99aab5,   // discord classic grey
  light:  0xc7ccd1,   // light grey
  dark:   0x4f545c,   // darker grey
  deep:   0x2b2d31,   // darkest
  red:    0xff3b3b,   // errors only
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
    const generator = get(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i);
    const lang = get(/<html[^>]+lang=["']([^"']*)["']/i);
    const charset = get(/<meta[^>]+charset=["']?([^"'\s/>]+)/i);
    const canonical = get(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);

    let favicon = null;
    const favMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']*)["']/i);
    if (favMatch) {
      try { favicon = new URL(favMatch[1], url).href; } catch { favicon = null; }
    }

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
      title, description, ogTitle, ogImage, ogSiteName, generator, lang, charset, canonical, favicon, wordCount,
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

/* ─── mShots screenshots (Discord-safe) ─── */
function screenshotUrl(url, opts = {}) {
  const width = opts.width || 1280;
  const height = opts.height || 800;
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=${width}&h=${height}`;
}

function screenshotUrlFull(url) {
  return `https://image.thum.io/get/width/1280/fullpage/noanimate/${url}`;
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

    .addSubcommand(s => s.setName('preview').setDescription('full preview — screenshot + og data')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    await interaction.deferReply({ flags: V2_E });

    const errBox = (msg) => new ContainerBuilder()
      .setAccentColor(GREY.red)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${msg}`));

    const greyHeader = (emoji, title, subtitle) => {
      const c = new ContainerBuilder().setAccentColor(GREY.main);
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${emoji} ${title}`));
      if (subtitle) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${subtitle}`));
      return c;
    };

    /* ──── SCREENSHOT ──── */
    if (sub === 'screenshot') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const fullPage = interaction.options.getBoolean('full_page') ?? false;
      const shot = fullPage
        ? screenshotUrlFull(parsed.href)
        : screenshotUrl(parsed.href, { width: 1280, height: 800 });

      // download + attach so Discord always renders it
      let attachment = null;
      const fileName = 'screenshot.png';
      try {
        const res = await fetchWithTimeout(shot, {}, 20000);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 1000) attachment = { attachment: buf, name: fileName };
        }
      } catch {}

      if (!attachment) {
        return interaction.editReply({
          components: [errBox(`couldn't render **${parsed.hostname}** — try again in a few seconds.`)],
          flags: V2_E,
        });
      }

      const c = greyHeader(E.pc, 'screenshot', `${parsed.hostname}${fullPage ? ' · full page' : ''}`)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL(`attachment://${fileName}`)
          )
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('open in browser').setURL(parsed.href).setStyle(ButtonStyle.Link),
            new ButtonBuilder().setLabel('open screenshot').setURL(shot).setStyle(ButtonStyle.Link),
          )
        );

      return interaction.editReply({
        components: [c],
        files: [attachment],
        flags: V2_E,
      });
    }

    /* ──── INFO ──── */
    if (sub === 'info') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const info = await getPageInfo(parsed.href);
      if (!info.ok) return interaction.editReply({ components: [errBox(`couldn't fetch — ${info.error}`)], flags: V2_E });

      const c = new ContainerBuilder().setAccentColor(GREY.main);

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
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.file} ${info.description.slice(0, 600)}`));
      }

      if (info.ogImage) {
        c.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(info.ogImage))
        );
      }

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      const meta = [];
      if (info.ogSiteName) meta.push(`${E.bot} **site** · ${info.ogSiteName}`);
      if (info.lang) meta.push(`${E.compass} **lang** · \`${info.lang}\``);
      if (info.charset) meta.push(`${E.settings} **charset** · \`${info.charset}\``);
      if (info.generator) meta.push(`${E.dev} **generator** · \`${info.generator}\``);
      if (info.canonical) meta.push(`${E.link} **canonical** · ${info.canonical.slice(0, 80)}`);
      meta.push(`${E.file} **words** · ${info.wordCount.toLocaleString()}`);
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
            .setAccentColor(GREY.red)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.error} site is down`))
            .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(new TextDisplayBuilder().setContent([
              `${E.pc} **host** · \`${parsed.hostname}\``,
              `${E.skull} **error** · \`${info.error}\``,
            ].join('\n')))],
          flags: V2_E,
        });
      }

      const statusEmoji = info.status < 300 ? E.success : info.status < 400 ? E.on : info.status < 500 ? E.angry : E.error;
      const speed = info.elapsed < 300 ? 'fast' : info.elapsed < 1000 ? 'ok' : 'slow';

      const c = new ContainerBuilder()
        .setAccentColor(GREY.main)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${statusEmoji} \`${info.status} ${info.statusText}\``))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${parsed.hostname}`))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `${E.wheel} **response** · \`${info.elapsed}ms\` · ${speed}`,
          `${E.link} **redirects to** · ${info.finalUrl === parsed.href ? '*no redirect*' : info.finalUrl}`,
          `${E.file} **content-type** · \`${info.headers['content-type'] || 'unknown'}\``,
          `${E.pc} **server** · \`${info.headers['server'] || 'hidden'}\``,
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

      const c = greyHeader(E.file, 'headers', parsed.hostname)
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

      const c = greyHeader(E.compass, 'dns records', domain);

      const sections = [];
      if (a.length) sections.push(`${E.link} **A**\n${a.slice(0, 8).map(ip => `\`${ip}\``).join(' ')}`);
      if (aaaa.length) sections.push(`${E.link} **AAAA**\n${aaaa.slice(0, 4).map(ip => `\`${ip}\``).join(' ')}`);
      if (cname.length) sections.push(`${E.link} **CNAME**\n${cname.map(x => `\`${x}\``).join(' ')}`);
      if (ns.length) sections.push(`${E.pc} **NS**\n${ns.slice(0, 6).map(x => `\`${x}\``).join('\n')}`);
      if (mx.length) sections.push(`${E.file} **MX**\n${mx.slice(0, 6).map(m => `\`${m.priority}\` ${m.exchange}`).join('\n')}`);
      if (txt.length) {
        const cleaned = txt.slice(0, 4).map(t => t.join('')).filter(t => t.length < 120);
        if (cleaned.length) sections.push(`${E.settings} **TXT**\n${cleaned.map(t => `\`${t}\``).join('\n')}`);
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

      const statusEmoji = info.daysLeft > 30 ? E.success : info.daysLeft > 7 ? E.on : E.error;

      const c = greyHeader(statusEmoji, `${info.daysLeft} days left`, domain)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `${E.lock} **issued to** · \`${info.subject?.CN || 'unknown'}\``,
          `${E.pc} **issuer** · \`${info.issuer?.O || info.issuer?.CN || 'unknown'}\``,
          `${E.on} **valid from** · \`${info.validFrom}\``,
          `${E.off} **valid until** · \`${info.validTo}\``,
          `${E.settings} **protocol** · \`${info.protocol}\``,
          `${E.settings} **cipher** · \`${info.cipher}\``,
          `${E.file} **fingerprint** · \`${info.fingerprint?.slice(0, 32)}...\``,
          `${info.authorized ? E.success : E.error} **authorized** · ${info.authorized ? 'yes' : 'no'}`,
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

        const c = greyHeader(E.folder, 'robots.txt', domain)
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
            found = { url, count: urls.length, sample: urls.slice(0, 10) };
            break;
          }
        } catch {}
      }

      if (!found) {
        return interaction.editReply({
          components: [new ContainerBuilder()
            .setAccentColor(GREY.dark)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} no sitemap found at \`${domain}\``))],
          flags: V2_E,
        });
      }

      const c = new ContainerBuilder()
        .setAccentColor(GREY.main)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.folder} sitemap found`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# \`${found.url}\``))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.file} **urls** · ${found.count}`));

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

      const info = await getPageInfo(parsed.href);

      const shot = screenshotUrl(parsed.href, { width: 1280, height: 720 });
      const siteName = info.ok ? (info.ogSiteName || parsed.hostname) : parsed.hostname;
      const title = info.ok ? (info.ogTitle || info.title || parsed.hostname) : parsed.hostname;
      const description = info.ok ? info.description : null;

      const c = new ContainerBuilder()
        .setAccentColor(GREY.main)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.link} ${title}`))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${siteName} · ${parsed.href}`));

      if (description) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.file} ${description.slice(0, 400)}`));
      }

      c.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(shot))
      );

      if (info.ok) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `${E.wheel} **status** · \`${info.status}\``,
          `${E.pc} **response** · \`${info.elapsed}ms\``,
          `${E.file} **words** · ${info.wordCount.toLocaleString()}`,
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
