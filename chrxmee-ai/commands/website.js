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
  money:    "<:Money_Cry_Son:1526538340264841257>",
  crown:    "<:Holographic_owner_crown:1527401510487461969>",
  admin:    "<:Admin_Badge:1527194281234665622>",
  announce: "<:Discord_Announcements:1526028541270167593>",
  bugs:     "<:Bugs_Blurple:1531909906129490091>",
  gold:     "<:GoldDiscord:1531896474529431668>",
  reply:    "<:Reply_Continued:1531902914824638584>",
};

/* ═══════════════ grey palette ═══════════════ */
const GREY = {
  main:  0x99aab5,   // discord classic grey
  light: 0xb5c0c9,   // lighter
  mid:   0x7a828e,   // mid
  dark:  0x4f545c,   // darker
  deep:  0x2b2d31,   // darkest
  red:   0xff3b3b,   // errors only
  green: 0x99aab5,   // subtle — no, keep grey for success too
  gold:  0xf1c40f,   // ratings only
};

const V2 = MessageFlags.IsComponentsV2;
const V2_E = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;

/* ═══════════════ helpers ═══════════════ */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeUrl(input) {
  let url = String(input).trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  try { return new URL(url); } catch { return null; }
}

function domainOnly(input) {
  return String(input).trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0];
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
    const get = (re) => { const m = html.match(re); return m ? m[1].trim() : null; };

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
    const viewport = get(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']*)["']/i);

    let favicon = null;
    const favMatch = html.match(/<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']*)["']/i);
    if (favMatch) { try { favicon = new URL(favMatch[1], url).href; } catch {} }

    const textOnly = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = textOnly ? textOnly.split(' ').length : 0;

    return {
      ok: true, status: res.status, statusText: res.statusText, elapsed,
      finalUrl: res.url, headers: Object.fromEntries(res.headers),
      title, description, ogTitle, ogImage, ogSiteName, generator, lang, charset, canonical, viewport, favicon, wordCount,
      html,
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
          ok: true, authorized: socket.authorized, protocol: socket.getProtocol(),
          cipher: socket.getCipher()?.name, subject: cert.subject, issuer: cert.issuer,
          validFrom: cert.valid_from, validTo: cert.valid_to,
          daysLeft: Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000),
          fingerprint: cert.fingerprint,
        });
      } catch (e) { resolve({ ok: false, error: e.message }); }
      finally { socket.destroy(); }
    });
    socket.on('error', (e) => { if (!done) { done = true; resolve({ ok: false, error: e.message }); } });
    socket.on('timeout', () => { if (!done) { done = true; socket.destroy(); resolve({ ok: false, error: 'timeout' }); } });
  });
}

/* ─── screenshot w/ polling (mShots + thum fallback) ─── */
const PLACEHOLDER_MAX = 12000;

async function waitForScreenshot(url, opts = {}) {
  const width = opts.width || 1280;
  const height = opts.height || 800;
  const shotUrl = `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=${width}&h=${height}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetchWithTimeout(shotUrl, {}, 15000);
      if (!res.ok) { await sleep(3000); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > PLACEHOLDER_MAX) return { buffer: buf, url: shotUrl, ok: true };
      await sleep(3000);
    } catch { await sleep(3000); }
  }

  // fallback to thum.io
  try {
    const fallbackUrl = `https://image.thum.io/get/width/1280/crop/800/noanimate/${url}`;
    const res = await fetchWithTimeout(fallbackUrl, {}, 15000);
    if (res.ok) {
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > PLACEHOLDER_MAX) return { buffer: buf, url: fallbackUrl, ok: true };
    }
  } catch {}

  return { ok: false };
}

/* ─── tech detection ─── */
function detectTech(info) {
  const html = (info.html || '').toLowerCase();
  const h = info.headers || {};
  const found = new Set();

  // from headers
  const server = (h.server || '').toLowerCase();
  if (server.includes('nginx')) found.add('Nginx');
  if (server.includes('apache')) found.add('Apache');
  if (server.includes('cloudflare')) found.add('Cloudflare');
  if (server.includes('vercel')) found.add('Vercel');
  if (server.includes('netlify')) found.add('Netlify');
  if (server.includes('github')) found.add('GitHub Pages');
  if (server.includes('caddy')) found.add('Caddy');

  if (h['x-powered-by']) {
    const xp = String(h['x-powered-by']).toLowerCase();
    if (xp.includes('php')) found.add('PHP');
    if (xp.includes('express')) found.add('Express');
    if (xp.includes('next')) found.add('Next.js');
    if (xp.includes('asp.net')) found.add('ASP.NET');
  }

  if (h['x-vercel-id'] || h['x-vercel-cache']) found.add('Vercel');
  if (h['x-amz-cf-id'] || h['x-amz-request-id']) found.add('AWS CloudFront');
  if (h['x-azure-ref']) found.add('Azure');
  if (h['cf-ray'] || h['cf-cache-status']) found.add('Cloudflare');
  if (h['x-github-request-id']) found.add('GitHub Pages');
  if (h['x-shopify-stage']) found.add('Shopify');
  if (h['x-drupal-cache']) found.add('Drupal');

  // from HTML
  if (html.includes('wp-content') || html.includes('wp-includes')) found.add('WordPress');
  if (html.includes('_next/static') || html.includes('__next_data__')) found.add('Next.js');
  if (html.includes('__nuxt') || html.includes('/_nuxt/')) found.add('Nuxt');
  if (html.includes('_app-') && html.includes('data-reactroot')) found.add('React');
  if (html.includes('ng-version') || html.includes('ng-app')) found.add('Angular');
  if (html.includes('data-v-') || html.includes('__vue__')) found.add('Vue');
  if (html.includes('svelte-')) found.add('Svelte');
  if (html.includes('astro-') || html.includes('data-astro')) found.add('Astro');
  if (html.includes('gatsby')) found.add('Gatsby');
  if (html.includes('tailwind')) found.add('Tailwind CSS');
  if (html.includes('bootstrap')) found.add('Bootstrap');
  if (html.includes('font-awesome') || html.includes('fontawesome')) found.add('Font Awesome');
  if (html.includes('shopify')) found.add('Shopify');
  if (html.includes('wix.com') || html.includes('wixstatic')) found.add('Wix');
  if (html.includes('squarespace')) found.add('Squarespace');
  if (html.includes('webflow')) found.add('Webflow');
  if (html.includes('framer.com') || html.includes('framerusercontent')) found.add('Framer');
  if (html.includes('gtag(') || html.includes('google-analytics')) found.add('Google Analytics');
  if (html.includes('googletagmanager')) found.add('Google Tag Manager');
  if (html.includes('hotjar')) found.add('Hotjar');
  if (html.includes('clarity.ms')) found.add('Microsoft Clarity');
  if (html.includes('stripe.com/v3')) found.add('Stripe');
  if (html.includes('recaptcha')) found.add('reCAPTCHA');
  if (html.includes('hcaptcha')) found.add('hCaptcha');
  if (html.includes('cloudflareinsights')) found.add('CF Insights');
  if (html.includes('jsdelivr')) found.add('jsDelivr');
  if (html.includes('unpkg.com')) found.add('unpkg');

  return [...found];
}

/* ─── security scoring ─── */
function securityScore(headers) {
  const checks = [
    { name: 'Strict-Transport-Security', key: 'strict-transport-security', weight: 15 },
    { name: 'Content-Security-Policy', key: 'content-security-policy', weight: 20 },
    { name: 'X-Frame-Options', key: 'x-frame-options', weight: 10 },
    { name: 'X-Content-Type-Options', key: 'x-content-type-options', weight: 10 },
    { name: 'Referrer-Policy', key: 'referrer-policy', weight: 10 },
    { name: 'Permissions-Policy', key: 'permissions-policy', weight: 10 },
    { name: 'Cross-Origin-Opener-Policy', key: 'cross-origin-opener-policy', weight: 10 },
    { name: 'Cross-Origin-Resource-Policy', key: 'cross-origin-resource-policy', weight: 5 },
    { name: 'X-XSS-Protection', key: 'x-xss-protection', weight: 5 },
    { name: 'X-Permitted-Cross-Domain-Policies', key: 'x-permitted-cross-domain-policies', weight: 5 },
  ];

  let score = 0;
  const results = [];
  for (const c of checks) {
    const present = !!headers[c.key];
    if (present) score += c.weight;
    results.push({ ...c, present, value: headers[c.key] });
  }

  // penalize leaky headers
  if (headers['server']) score = Math.max(0, score - 5);
  if (headers['x-powered-by']) score = Math.max(0, score - 10);

  return { score: Math.min(100, score), results };
}

/* ─── seo audit ─── */
function seoAudit(info) {
  const html = info.html || '';
  const checks = [];

  checks.push({ ok: !!info.title, label: 'title tag', detail: info.title ? info.title.slice(0, 60) : 'missing' });
  checks.push({ ok: (info.title || '').length <= 60, label: 'title ≤ 60 chars', detail: `${(info.title || '').length} chars` });
  checks.push({ ok: !!info.description, label: 'meta description', detail: info.description ? `${info.description.length} chars` : 'missing' });
  checks.push({ ok: !!info.canonical, label: 'canonical url', detail: info.canonical ? 'set' : 'missing' });
  checks.push({ ok: !!info.viewport, label: 'mobile viewport', detail: info.viewport ? 'set' : 'missing' });
  checks.push({ ok: !!info.lang, label: 'html lang', detail: info.lang || 'missing' });
  checks.push({ ok: !!info.ogTitle, label: 'og:title', detail: info.ogTitle ? 'set' : 'missing' });
  checks.push({ ok: !!info.ogImage, label: 'og:image', detail: info.ogImage ? 'set' : 'missing' });

  // count headings
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
  checks.push({ ok: h1Count === 1, label: 'exactly one h1', detail: `found ${h1Count}` });

  // images without alt
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  const noAlt = imgTags.filter(t => !/alt\s*=/i.test(t)).length;
  checks.push({ ok: noAlt === 0, label: 'all images have alt', detail: `${noAlt} / ${imgTags.length} missing` });

  // structured data
  const hasJSONLD = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  checks.push({ ok: hasJSONLD, label: 'structured data (json-ld)', detail: hasJSONLD ? 'found' : 'missing' });

  // robots meta
  const robotsMeta = (html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i) || [])[1];
  checks.push({ ok: !/noindex/i.test(robotsMeta || ''), label: 'indexable', detail: robotsMeta || 'default' });

  const passed = checks.filter(c => c.ok).length;

  return { checks, score: Math.round((passed / checks.length) * 100) };
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
    )
    .addSubcommand(s => s.setName('tech').setDescription('detect what a site is built with')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    )
    .addSubcommand(s => s.setName('security').setDescription('security header audit + score')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    )
    .addSubcommand(s => s.setName('seo').setDescription('seo audit + score')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    )
    .addSubcommand(s => s.setName('whois').setDescription('domain registration info')
      .addStringOption(o => o.setName('domain').setDescription('example.com').setRequired(true))
    )
    .addSubcommand(s => s.setName('redirect').setDescription('show the redirect chain')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    )
    .addSubcommand(s => s.setName('source').setDescription('preview raw html source')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    )
    .addSubcommand(s => s.setName('check').setDescription('full health check — everything at once')
      .addStringOption(o => o.setName('url').setDescription('the url').setRequired(true))
    ),

  async execute(interaction, client) {
    const sub = interaction.options.getSubcommand();

    await interaction.deferReply({ flags: V2_E });

    const errBox = (msg) => new ContainerBuilder()
      .setAccentColor(GREY.red)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} ${msg}`));

    const greyHead = (emoji, title, subtitle) => {
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

      await interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(GREY.main)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.pc} rendering screenshot...`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${parsed.hostname} · this can take 5-15s on first request`))],
        flags: V2_E,
      });

      const result = await waitForScreenshot(parsed.href, {
        width: 1280,
        height: fullPage ? 2000 : 800,
      });

      if (!result.ok) {
        return interaction.editReply({
          components: [errBox(`couldn't render **${parsed.hostname}** — try again in a few seconds.`)],
          flags: V2_E,
        });
      }

      const fileName = 'screenshot.png';
      const c = greyHead(E.pc, 'screenshot', `${parsed.hostname}${fullPage ? ' · full page' : ''}`)
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
            new ButtonBuilder().setLabel('open screenshot').setURL(result.url).setStyle(ButtonStyle.Link),
          )
        );

      return interaction.editReply({
        components: [c],
        files: [{ attachment: result.buffer, name: fileName }],
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
      if (info.viewport) meta.push(`${E.pc} **viewport** · \`${info.viewport.slice(0, 60)}\``);
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
          lines.push(`${E.cursor} **${k}** · \`${String(info.headers[k]).slice(0, 120)}\``);
        }
      }
      for (const [k, v] of Object.entries(info.headers)) {
        if (!seen.has(k) && !k.startsWith(':') && lines.length < 25) {
          lines.push(`${E.cursor} **${k}** · \`${String(v).slice(0, 100)}\``);
        }
      }

      const c = greyHead(E.file, 'headers', parsed.hostname)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n') || '*no headers*'));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── DNS ──── */
    if (sub === 'dns') {
      const domain = domainOnly(interaction.options.getString('domain'));

      const [a, aaaa, ns, mx, txt, cname] = await Promise.all([
        dns.resolve4(domain).catch(() => []),
        dns.resolve6(domain).catch(() => []),
        dns.resolveNs(domain).catch(() => []),
        dns.resolveMx(domain).catch(() => []),
        dns.resolveTxt(domain).catch(() => []),
        dns.resolveCname(domain).catch(() => []),
      ]);

      const c = greyHead(E.compass, 'dns records', domain);

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
      const domain = domainOnly(interaction.options.getString('domain'));
      const info = await tlsInfo(domain);

      if (!info.ok) {
        return interaction.editReply({ components: [errBox(`ssl check failed — ${info.error}`)], flags: V2_E });
      }

      const statusEmoji = info.daysLeft > 30 ? E.success : info.daysLeft > 7 ? E.on : E.error;

      const c = greyHead(statusEmoji, `${info.daysLeft} days left`, domain)
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
      const domain = domainOnly(interaction.options.getString('domain'));

      try {
        const res = await fetchWithTimeout(`https://${domain}/robots.txt`, {}, 8000);
        if (!res.ok) return interaction.editReply({ components: [errBox(`no robots.txt found (${res.status}).`)], flags: V2_E });
        const text = await res.text();
        const trimmed = text.length > 1800 ? text.slice(0, 1800) + '\n... (truncated)' : text;

        const c = greyHead(E.folder, 'robots.txt', domain)
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`\n${trimmed}\n\`\`\``));

        return interaction.editReply({ components: [c], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`couldn't fetch — ${e.message}`)], flags: V2_E });
      }
    }

    /* ──── SITEMAP ──── */
    if (sub === 'sitemap') {
      const domain = domainOnly(interaction.options.getString('domain'));
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
          found.sample.map(u => `${E.link} ${u.slice(0, 100)}`).join('\n')
        ));
      }

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── PREVIEW ──── */
    if (sub === 'preview') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      await interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(GREY.main)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.pc} rendering preview...`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${parsed.hostname} · this can take 5-15s`))],
        flags: V2_E,
      });

      const [info, shotResult] = await Promise.all([
        getPageInfo(parsed.href),
        waitForScreenshot(parsed.href, { width: 1280, height: 720 }),
      ]);

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

      if (shotResult.ok) {
        c.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL('attachment://preview.png')
          )
        );
      }

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
          ...(shotResult.ok ? [new ButtonBuilder().setLabel('screenshot').setURL(shotResult.url).setStyle(ButtonStyle.Link)] : [])
        )
      );

      const reply = { components: [c], flags: V2_E };
      if (shotResult.ok) reply.files = [{ attachment: shotResult.buffer, name: 'preview.png' }];

      return interaction.editReply(reply);
    }

    /* ──── TECH ──── */
    if (sub === 'tech') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const info = await getPageInfo(parsed.href);
      if (!info.ok) return interaction.editReply({ components: [errBox(`couldn't fetch — ${info.error}`)], flags: V2_E });

      const tech = detectTech(info);

      const c = greyHead(E.dev, 'tech stack', parsed.hostname)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      if (tech.length === 0) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.qsob} *couldn't detect anything — site may be a custom stack or block detection.*`));
      } else {
        const lines = tech.map(t => `${E.bugs} \`${t}\``);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
      }

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# detected ${tech.length} technologies · from headers + html signatures`));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── SECURITY ──── */
    if (sub === 'security') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const info = await getPageInfo(parsed.href);
      if (!info.ok) return interaction.editReply({ components: [errBox(`couldn't fetch — ${info.error}`)], flags: V2_E });

      const { score, results } = securityScore(info.headers);

      const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
      const gradeEmoji = score >= 80 ? E.success : score >= 60 ? E.on : E.error;

      const c = greyHead(gradeEmoji, `security score · ${score}/100`, `${parsed.hostname} · grade **${grade}**`)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      const lines = results.map(r =>
        `${r.present ? E.success : E.error} **${r.name}**${r.present ? '' : ' · missing'}`
      );
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

      // penalties
      const penalties = [];
      if (info.headers['server']) penalties.push(`${E.pc} leaks \`server\` header`);
      if (info.headers['x-powered-by']) penalties.push(`${E.pc} leaks \`x-powered-by\``);
      if (penalties.length) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**penalties**\n${penalties.join('\n')}`));
      }

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# grade based on 10 security headers + leakage penalties`));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── SEO ──── */
    if (sub === 'seo') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const info = await getPageInfo(parsed.href);
      if (!info.ok) return interaction.editReply({ components: [errBox(`couldn't fetch — ${info.error}`)], flags: V2_E });

      const { checks, score } = seoAudit(info);
      const gradeEmoji = score >= 80 ? E.success : score >= 60 ? E.on : E.error;

      const c = greyHead(gradeEmoji, `seo audit · ${score}%`, parsed.hostname)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

      const lines = checks.map(ch =>
        `${ch.ok ? E.success : E.error} **${ch.label}** · \`${ch.detail}\``
      );
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${checks.filter(c => c.ok).length}/${checks.length} checks passed`));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── WHOIS (via RDAP) ──── */
    if (sub === 'whois') {
      const domain = domainOnly(interaction.options.getString('domain'));

      try {
        const res = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {}, 10000);
        if (!res.ok) return interaction.editReply({ components: [errBox(`no whois data for \`${domain}\` (${res.status}).`)], flags: V2_E });
        const data = await res.json();

        const events = (data.events || []).reduce((acc, e) => { acc[e.eventAction] = e.eventDate; return acc; }, {});
        const registrar = (data.entities || []).find(e => e.roles?.includes('registrar'));
        const registrarName = registrar?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || 'unknown';

        const created = events.registration ? `<t:${Math.floor(new Date(events.registration).getTime() / 1000)}:R>` : '*unknown*';
        const expires = events.expiration ? `<t:${Math.floor(new Date(events.expiration).getTime() / 1000)}:R>` : '*unknown*';
        const updated = events['last changed'] ? `<t:${Math.floor(new Date(events['last changed']).getTime() / 1000)}:R>` : '*unknown*';

        const nsList = (data.nameservers || []).map(ns => `\`${ns.ldhName}\``).join('\n') || '*none*';
        const status = (data.status || []).map(s => `\`${s}\``).join(' · ') || '*unknown*';

        const c = greyHead(E.gold, 'whois', domain)
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent([
            `${E.crown} **registrar** · \`${String(registrarName).slice(0, 60)}\``,
            `${E.on} **registered** · ${created}`,
            `${E.off} **expires** · ${expires}`,
            `${E.wheel} **updated** · ${updated}`,
          ].join('\n')))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**nameservers**\n${nsList}`))
          .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**status**\n${status}`));

        return interaction.editReply({ components: [c], flags: V2_E });
      } catch (e) {
        return interaction.editReply({ components: [errBox(`whois failed — ${e.message}`)], flags: V2_E });
      }
    }

    /* ──── REDIRECT CHAIN ──── */
    if (sub === 'redirect') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const chain = [];
      let current = parsed.href;
      let safety = 0;

      while (current && safety < 12) {
        safety++;
        try {
          const res = await fetch(current, {
            method: 'HEAD',
            redirect: 'manual',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; chromed/1.0)' },
            signal: AbortSignal.timeout(8000),
          });

          const location = res.headers.get('location');
          chain.push({ url: current, status: res.status });

          if (location && res.status >= 300 && res.status < 400) {
            current = new URL(location, current).href;
          } else {
            break;
          }
        } catch {
          chain.push({ url: current, status: 'error' });
          break;
        }
      }

      const lines = chain.map((hop, i) => {
        const prefix = i === 0 ? E.compass : `${E.link}`;
        return `${prefix} \`${hop.status}\` ${hop.url.slice(0, 100)}`;
      });

      const c = greyHead(E.link, `redirect chain · ${chain.length} hops`, parsed.hostname)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

      if (chain.length > 1) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addActionRowComponents(
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('open final destination').setURL(chain[chain.length - 1].url).setStyle(ButtonStyle.Link),
          )
        );
      }

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── SOURCE ──── */
    if (sub === 'source') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      const info = await getPageInfo(parsed.href);
      if (!info.ok) return interaction.editReply({ components: [errBox(`couldn't fetch — ${info.error}`)], flags: V2_E });

      // strip scripts/styles for readability, keep structure
      const cleaned = info.html
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .join('\n');

      const preview = cleaned.length > 1600 ? cleaned.slice(0, 1600) + '\n... (truncated)' : cleaned;
      const totalLines = cleaned.split('\n').length;

      const c = greyHead(E.cursor, 'html source', `${parsed.hostname} · ${totalLines} lines`)
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`\`\`\`html\n${preview}\n\`\`\``));

      return interaction.editReply({ components: [c], flags: V2_E });
    }

    /* ──── CHECK (all-in-one) ──── */
    if (sub === 'check') {
      const raw = interaction.options.getString('url');
      const parsed = normalizeUrl(raw);
      if (!parsed) return interaction.editReply({ components: [errBox('invalid url.')], flags: V2_E });

      await interaction.editReply({
        components: [new ContainerBuilder()
          .setAccentColor(GREY.main)
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${E.settings} running full check...`))
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${parsed.hostname} · fetching info, headers, ssl, security, seo, screenshot`))],
        flags: V2_E,
      });

      const [info, ssl, shotResult] = await Promise.all([
        getPageInfo(parsed.href),
        tlsInfo(parsed.hostname),
        waitForScreenshot(parsed.href, { width: 1280, height: 720 }),
      ]);

      if (!info.ok) {
        return interaction.editReply({ components: [errBox(`couldn't fetch — ${info.error}`)], flags: V2_E });
      }

      const { score: secScore } = securityScore(info.headers);
      const { score: seoScore } = seoAudit(info);
      const tech = detectTech(info);

      const overallOk = info.status < 400 && ssl.ok && ssl.daysLeft > 7;
      const headerEmoji = overallOk ? E.success : E.angry;

      const c = new ContainerBuilder().setAccentColor(GREY.main);

      // header
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${headerEmoji} ${parsed.hostname} · full check`));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${info.status} · ${info.elapsed}ms · ${tech.length} tech · sec ${secScore}/100 · seo ${seoScore}%`));

      // screenshot
      if (shotResult.ok) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addMediaGalleryComponents(
          new MediaGalleryBuilder().addItems(
            new MediaGalleryItemBuilder().setURL('attachment://check.png')
          )
        );
      }

      // info
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `${E.compass} **title** · ${(info.title || info.ogTitle || 'untitled').slice(0, 80)}`,
        `${E.file} **words** · ${info.wordCount.toLocaleString()}`,
        `${E.pc} **server** · \`${info.headers['server'] || 'hidden'}\``,
      ].join('\n')));

      // ssl
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
      if (ssl.ok) {
        const sslEmoji = ssl.daysLeft > 30 ? E.success : ssl.daysLeft > 7 ? E.on : E.error;
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
          `${sslEmoji} **ssl** · \`${ssl.protocol}\` · ${ssl.daysLeft} days left · issued to \`${ssl.subject?.CN || 'unknown'}\``,
        ].join('\n')));
      } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.error} **ssl** · \`${ssl.error || 'failed'}\``));
      }

      // tech
      if (tech.length) {
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${E.dev} **tech** · ${tech.slice(0, 10).map(t => `\`${t}\``).join(' · ')}`));
      }

      // scores
      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      const secBar = '█'.repeat(Math.round(secScore / 10)) + '░'.repeat(10 - Math.round(secScore / 10));
      const seoBar = '█'.repeat(Math.round(seoScore / 10)) + '░'.repeat(10 - Math.round(seoScore / 10));
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
        `${E.lock} **security** · \`${secBar}\` **${secScore}/100**`,
        `${E.compass} **seo** · \`${seoBar}\` **${seoScore}%**`,
      ].join('\n')));

      c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
      c.addActionRowComponents(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setLabel('open site').setURL(parsed.href).setStyle(ButtonStyle.Link),
          new ButtonBuilder().setLabel('preview').setURL(`https://s0.wp.com/mshots/v1/${encodeURIComponent(parsed.href)}`).setStyle(ButtonStyle.Link),
        )
      );

      const reply = { components: [c], flags: V2_E };
      if (shotResult.ok) reply.files = [{ attachment: shotResult.buffer, name: 'check.png' }];

      return interaction.editReply(reply);
    }
  },
};
