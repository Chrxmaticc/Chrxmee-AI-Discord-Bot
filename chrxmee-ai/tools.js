// tools.js — Chromed's universal tool system
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ─── MODELS (same hybrid Groq + Navy) ─────────────────────────────────────
const MODELS = {
  genius: {
    label: "Genius",
    providers: [
      { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  speedster: {
    label: "Speedster",
    providers: [
      { name: "groq", id: "openai/gpt-oss-20b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  thinker: {
    label: "Thinker",
    providers: [
      { name: "groq", id: "openai/gpt-oss-120b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  creative: {
    label: "Creative",
    providers: [
      { name: "groq", id: "qwen/qwen3.6-27b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  efficient: {
    label: "Efficient",
    providers: [
      { name: "groq", id: "groq/compound-mini", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1-mini", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  vision: {
    label: "Vision",
    providers: [
      { name: "groq", id: "qwen/qwen3.6-27b", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
  agent: {
    label: "Agent",
    providers: [
      { name: "groq", id: "groq/compound", url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
      { name: "navy", id: "gpt-4.1", url: "https://api.navy/v1/chat/completions", keyEnv: "NAVY_API_KEY" }
    ]
  },
};

const DEFAULT_MODEL = "genius";

async function callAI(modelKey, messages, temperature, maxTokens = 1024) {
  const model = MODELS[modelKey] || MODELS[DEFAULT_MODEL];
  let lastError;
  for (const provider of model.providers) {
    const apiKey = process.env[provider.keyEnv];
    if (!apiKey) continue;
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: provider.id,
          messages,
          temperature,
          max_tokens: maxTokens,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider.name} API error ${response.status}: ${errorText.slice(0, 200)}`);
      }
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
      throw new Error(`No content from ${provider.name}`);
    } catch (err) {
      console.error(`${provider.name} failed:`, err.message);
      lastError = err;
    }
  }
  throw new Error(`All providers failed. Last error: ${lastError?.message || "Unknown"}`);
}

// ─── DATABASE HELPERS ─────────────────────────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_chat_history (
      user_id TEXT,
      guild_id TEXT,
      history JSONB DEFAULT '[]',
      summary TEXT,
      updated_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, guild_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_notes (
      user_id TEXT,
      note TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function loadMemory(userId, guildId) {
  const res = await pool.query(
    "SELECT history, summary FROM user_chat_history WHERE user_id = $1 AND guild_id = $2",
    [userId, guildId]
  );
  if (res.rows[0]) {
    return {
      history: res.rows[0].history,
      summary: res.rows[0].summary,
    };
  }
  return { history: [], summary: null };
}

async function saveMemory(userId, guildId, history, summary) {
  await pool.query(
    `INSERT INTO user_chat_history (user_id, guild_id, history, summary)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, guild_id)
     DO UPDATE SET history = $3, summary = $4, updated_at = NOW()`,
    [userId, guildId, JSON.stringify(history), summary]
  );
}

// ─── TOOL DETECTION ──────────────────────────────────────────────────────
function detectTool(content) {
  const text = content.trim().toLowerCase();

  // image generation
  if (/(imagine|generate|create|make|draw)\s+(an?\s+)?(image|pic|picture|art|photo)\s+(of\s+)?(.+)/.test(text)) {
    const match = text.match(/(imagine|generate|create|make|draw)\s+(an?\s+)?(image|pic|picture|art|photo)\s+(of\s+)?(.+)/);
    return { tool: "image", args: match[5] };
  }
  if (/imagine\s+(.+)/.test(text)) {
    const match = text.match(/imagine\s+(.+)/);
    return { tool: "image", args: match[1] };
  }

  // calculator
  if (/^(calc|calculate|math)\s+(.+)$/.test(text)) {
    const match = text.match(/^(calc|calculate|math)\s+(.+)$/);
    return { tool: "calculator", args: match[2] };
  }

  // weather
  if (/weather(?:\s+in)?\s+(.+)/.test(text)) {
    const match = text.match(/weather(?:\s+in)?\s+(.+)/);
    return { tool: "weather", args: match[1] };
  }

  // time
  if (/time(?:\s+in)?\s+(.+)/.test(text)) {
    const match = text.match(/time(?:\s+in)?\s+(.+)/);
    return { tool: "time", args: match[1] };
  }

  // dictionary
  if (/^(define|dict|urban)\s+(.+)/.test(text)) {
    const match = text.match(/^(define|dict|urban)\s+(.+)/);
    return { tool: "dictionary", args: match[2] };
  }

  // translate
  if (/translate\s+(.+)\s+to\s+(.+)/.test(text)) {
    const match = text.match(/translate\s+(.+)\s+to\s+(.+)/);
    return { tool: "translate", args: { text: match[1], target: match[2] } };
  }

  // wikipedia
  if (/^(wiki|wikipedia)\s+(.+)/.test(text)) {
    const match = text.match(/^(wiki|wikipedia)\s+(.+)/);
    return { tool: "wikipedia", args: match[2] };
  }

  // crypto
  if (/(crypto|price of)\s+(.+)/.test(text)) {
    const match = text.match(/(crypto|price of)\s+(.+)/);
    return { tool: "crypto", args: match[2] };
  }

  // stock
  if (/^(stock|stocks)\s+(.+)/.test(text)) {
    const match = text.match(/^(stock|stocks)\s+(.+)/);
    return { tool: "stock", args: match[1] };
  }

  // QR
  if (/^qr\s+(.+)/.test(text)) {
    const match = text.match(/^qr\s+(.+)/);
    return { tool: "qr", args: match[1] };
  }

  // shorten URL
  if (/^shorten\s+(https?:\/\/\S+)/.test(text)) {
    const match = text.match(/^shorten\s+(https?:\/\/\S+)/);
    return { tool: "shorten", args: match[1] };
  }

  // server info
  if (/server\s*(info|stats)/.test(text)) return { tool: "serverinfo", args: null };

  // user info
  if (/user\s*info\s*<@!?(\d+)>/.test(text)) {
    const match = text.match(/<@!?(\d+)>/);
    return { tool: "userinfo", args: match[1] };
  }

  // remind me
  if (/remind\s+me\s+to\s+(.+?)\s+in\s+(\d+)\s*(seconds|minutes|hours|days)/i.test(text)) {
    const match = text.match(/remind\s+me\s+to\s+(.+?)\s+in\s+(\d+)\s*(seconds|minutes|hours|days)/i);
    return { tool: "reminder", args: { text: match[1], amount: parseInt(match[2]), unit: match[3] } };
  }

  // notes
  if (/note\s+(save|add)\s+(.+)/.test(text)) {
    const match = text.match(/note\s+(save|add)\s+(.+)/);
    return { tool: "note_save", args: match[2] };
  }
  if (/note\s+(list|get)\s*/.test(text)) return { tool: "note_list", args: null };

  // currency conversion
  if (/currency\s+convert\s+(\d+)\s+([a-z]{3})\s+to\s+([a-z]{3})/.test(text)) {
    const match = text.match(/currency\s+convert\s+(\d+)\s+([a-z]{3})\s+to\s+([a-z]{3})/);
    return { tool: "currency", args: { amount: match[1], from: match[2], to: match[3] } };
  }

  // news
  if (/news\s+(top\s+)?headlines/.test(text)) return { tool: "news", args: null };

  // unit conversion
  if (/unit\s*convert\s+(\d+)\s*(\w+)\s+to\s+(\w+)/.test(text)) {
    const match = text.match(/unit\s*convert\s+(\d+)\s*(\w+)\s+to\s+(\w+)/);
    return { tool: "unit", args: { value: match[1], from: match[2], to: match[3] } };
  }

  // web search
  if (/search\s+(.+)/.test(text)) {
    const match = text.match(/search\s+(.+)/);
    return { tool: "search", args: match[1] };
  }

  // fact check
  if (/fact\s*check\s+(.+)/.test(text)) {
    const match = text.match(/fact\s*check\s+(.+)/);
    return { tool: "factcheck", args: match[1] };
  }

  // fun tools
  if (/^(roast|insult)\s+<@!?(\d+)>/.test(text)) {
    const match = text.match(/^(roast|insult)\s+<@!?(\d+)>/);
    return { tool: "roast", args: match[2] };
  }
  if (/^(joke|tell me a joke)/.test(text)) return { tool: "joke", args: null };
  if (/^(meme|show me a meme)/.test(text)) return { tool: "meme", args: null };
  if (/^(8ball|magic 8 ball)/.test(text)) return { tool: "magic8ball", args: null };
  if (/^(dice|roll a dice)/.test(text)) return { tool: "dice", args: null };
  if (/^(coinflip|flip a coin)/.test(text)) return { tool: "coinflip", args: null };

  return null;
}

// ─── TOOL EXECUTION ─────────────────────────────────────────────────────
async function executeTool(tool, args, context = {}) {
  const { message, client } = context;
  const pool = client?.pool || pool;
  const userId = message?.author?.id;
  const guildId = message?.guildId;

  switch (tool) {
    case "image":
      return image(args);
    case "calculator":
      return calculator(args);
    case "weather":
      return weather(args);
    case "time":
      return time(args);
    case "dictionary":
      return dictionary(args);
    case "translate":
      return translate(args.text, args.target);
    case "wikipedia":
      return wikipedia(args);
    case "crypto":
      return crypto(args);
    case "stock":
      return stock(args);
    case "qr":
      return qr(args);
    case "shorten":
      return shorten(args);
    case "serverinfo":
      return serverinfo(message);
    case "userinfo":
      return userinfo(message, args);
    case "reminder":
      return reminder(message, args, client);
    case "note_save":
      return note_save(userId, args);
    case "note_list":
      return note_list(userId);
    case "currency":
      return currency(args.amount, args.from, args.to);
    case "news":
      return news();
    case "unit":
      return unit(args.value, args.from, args.to);
    case "search":
      return search(args);
    case "factcheck":
      return factcheck(args);
    case "roast":
      return roast(message, args, client);
    case "joke":
      return joke();
    case "meme":
      return meme();
    case "magic8ball":
      return magic8ball();
    case "dice":
      return dice();
    case "coinflip":
      return coinflip();
    default:
      throw new Error(`unknown tool: ${tool}`);
  }
}

// ─── INDIVIDUAL TOOLS ───────────────────────────────────────────────────
async function image(prompt) {
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;
  return { type: "image", url };
}

async function calculator(expression) {
  const sanitized = expression.replace(/[^0-9+\-*/.()\s]/g, "");
  const result = new Function(`return (${sanitized})`)();
  return `🧮 ${expression} = ${result}`;
}

async function weather(city) {
  const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=%C+%t+%h+%w`);
  if (!res.ok) throw new Error("weather API failed");
  return `🌤️ ${city}: ${await res.text()}`;
}

async function time(city) {
  const res = await fetch(`http://worldtimeapi.org/api/timezone/${encodeURIComponent(city)}`);
  if (!res.ok) throw new Error("timezone not found");
  const data = await res.json();
  return `⏰ ${city}: ${new Date(data.datetime).toLocaleString()}`;
}

async function dictionary(word) {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!res.ok) throw new Error("word not found");
  const data = await res.json();
  const entry = data[0];
  return `📚 ${entry.word}: ${entry.meanings[0].definitions[0].definition}`;
}

async function translate(text, target) {
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${target}`);
  const data = await res.json();
  return `🌐 ${text} → ${data.responseData.translatedText}`;
}

async function wikipedia(query) {
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("page not found");
  const data = await res.json();
  return `📖 ${data.title}:\n${data.extract}`;
}

async function crypto(coin) {
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin.toLowerCase())}&vs_currencies=usd`);
  if (!res.ok) throw new Error("coin not found");
  const data = await res.json();
  const price = data[coin.toLowerCase()]?.usd;
  if (!price) throw new Error("coin not found");
  return `💎 ${coin} = $${price}`;
}

async function stock(symbol) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`);
  if (!res.ok) throw new Error("stock not found");
  const data = await res.json();
  const price = data.chart.result[0].meta.regularMarketPrice;
  return `📈 ${symbol.toUpperCase()} = $${price}`;
}

async function qr(text) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`;
  return { type: "image", url };
}

async function shorten(url) {
  const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error("shorten failed");
  return `🔗 ${await res.text()}`;
}

async function serverinfo(message) {
  if (!message || !message.guild) return "you must be in a server to view server info.";
  const guild = message.guild;
  const owner = await guild.fetchOwner();
  const channels = guild.channels.cache;
  const roles = guild.roles.cache;
  return `🏠 **${guild.name}**\n` +
         `ID: ${guild.id}\n` +
         `Owner: ${owner.user.tag}\n` +
         `Members: ${guild.memberCount}\n` +
         `Channels: ${channels.size} (${channels.filter(c => c.type === 0).size} text, ${channels.filter(c => c.type === 2).size} voice)\n` +
         `Roles: ${roles.size}\n` +
         `Created: ${guild.createdAt.toLocaleDateString()}`;
}

async function userinfo(message, userId) {
  if (!message || !message.guild) return "user info only works in a server.";
  const member = await message.guild.members.fetch(userId).catch(() => null);
  if (!member) return "user not found.";
  return `👤 **${member.user.tag}**\n` +
         `ID: ${member.user.id}\n` +
         `Joined: ${member.joinedAt.toLocaleDateString()}\n` +
         `Account created: ${member.user.createdAt.toLocaleDateString()}\n` +
         `Roles: ${member.roles.cache.map(r => r.name).join(", ")}`;
}

async function reminder(message, args, client) {
  const { text, amount, unit } = args;
  let ms;
  switch(unit) {
    case "seconds": ms = amount * 1000; break;
    case "minutes": ms = amount * 60000; break;
    case "hours": ms = amount * 3600000; break;
    case "days": ms = amount * 86400000; break;
    default: return "invalid time unit.";
  }
  setTimeout(async () => {
    try {
      await message.author.send(`⏰ Reminder: ${text}`);
    } catch {}
  }, ms);
  return `I'll remind you in ${amount} ${unit}: ${text}`;
}

async function note_save(userId, noteText) {
  await pool.query("INSERT INTO user_notes (user_id, note) VALUES ($1, $2)", [userId, noteText]);
  return "📝 Note saved.";
}

async function note_list(userId) {
  const res = await pool.query("SELECT note, created_at FROM user_notes WHERE user_id = $1 ORDER BY created_at DESC", [userId]);
  if (!res.rows.length) return "you have no notes.";
  return res.rows.map((r, i) => `${i+1}. ${r.note} (${r.created_at.toLocaleDateString()})`).join("\n");
}

async function currency(amount, from, to) {
  const res = await fetch(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`);
  if (!res.ok) throw new Error("currency API failed");
  const data = await res.json();
  const rate = data.rates[to.toUpperCase()];
  if (!rate) throw new Error("currency not found");
  const converted = (amount * rate).toFixed(2);
  return `💱 ${amount} ${from.toUpperCase()} = ${converted} ${to.toUpperCase()}`;
}

async function news() {
  // using free news API: newsapi.org requires key; we'll use a simple rss feed or placeholder
  // For demo, return placeholder
  return "📰 News tool needs an API key. Set NEWS_API_KEY and we'll bring real headlines.";
}

async function unit(value, from, to) {
  // simple conversion for length and mass
  const conversions = {
    cm: { m: 0.01, km: 0.00001, in: 0.393701, ft: 0.0328084 },
    m: { cm: 100, km: 0.001, ft: 3.28084 },
    km: { m: 1000, mi: 0.621371 },
    in: { cm: 2.54, ft: 0.0833333 },
    ft: { in: 12, m: 0.3048, cm: 30.48 },
    mi: { km: 1.60934 },
    kg: { g: 1000, lb: 2.20462 },
    g: { kg: 0.001, lb: 0.00220462 },
    lb: { kg: 0.453592, g: 453.592 },
    oz: { g: 28.3495 },
  };
  const key = from.toLowerCase() + "_to_" + to.toLowerCase();
  const rate = conversions[from.toLowerCase()]?.[to.toLowerCase()];
  if (!rate) return "unsupported conversion.";
  return `📏 ${value} ${from} = ${(value * rate).toFixed(2)} ${to}`;
}

async function search(query) {
  // DuckDuckGo instant answer API
  const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
  const data = await res.json();
  if (data.AbstractText) return data.AbstractText;
  if (data.RelatedTopics && data.RelatedTopics[0]?.Text) return data.RelatedTopics[0].Text;
  return "no results found.";
}

async function factcheck(query) {
  // use wikipedia as fallback for fact check
  const summary = await wikipedia(query);
  return `Fact check: ${summary}`;
}

async function roast(message, targetId, client) {
  if (!message) return "roast can't be delivered.";
  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target) return "user not found.";
  const roast = await callAI("creative", [
    { role: "user", content: `Roast ${target.user.username} in a funny, brutal but not harmful way. Use internet slang. Keep it short.` }
  ], 0.9, 150);
  return `${target.user.username}, ${roast}`;
}

async function joke() {
  const res = await fetch("https://icanhazdadjoke.com/", { headers: { "Accept": "application/json" } });
  const data = await res.json();
  return data.joke;
}

async function meme() {
  // using reddit meme API
  const res = await fetch("https://meme-api.com/gimme");
  const data = await res.json();
  return { type: "image", url: data.url };
}

async function magic8ball() {
  const responses = ["yes", "no", "maybe", "ask again later", "definitely", "not a chance"];
  const choice = responses[Math.floor(Math.random() * responses.length)];
  return `🎱 ${choice}`;
}

async function dice() {
  return `🎲 You rolled a ${Math.floor(Math.random() * 6) + 1}`;
}

async function coinflip() {
  return `🪙 ${Math.random() < 0.5 ? "Heads" : "Tails"}`;
}

// ─── CONVERSATION SUMMARIZATION ─────────────────────────────────────────
async function summarizeHistory(messages) {
  const text = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
  const prompt = `Summarize the key points, topics, user preferences, and tone of this conversation in 3-5 sentences:\n\n${text}`;
  try {
    return await callAI("speedster", [{ role: "user", content: prompt }], 0.3, 300);
  } catch (err) {
    console.error("Summarization failed:", err.message);
    return text.slice(-500);
  }
}

// ─── MOOD DETECTION ────────────────────────────────────────────────────
async function detectMood(text) {
  try {
    const prompt = `Classify the mood of this message as one of: happy, sad, angry, excited, calm, neutral. Respond with one word.\n\nMessage: "${text}"`;
    const mood = await callAI("speedster", [{ role: "user", content: prompt }], 0.1, 10);
    return mood.trim().toLowerCase();
  } catch {
    return "neutral";
  }
}

// ─── MAIN PROCESSING FUNCTION ─────────────────────────────────────────
async function handleMessage(message, client) {
  await ensureTables();

  const userId = message.author.id;
  const guildId = message.guildId;
  const pool = client.pool || pool;

  // Load long-term memory
  const longTerm = await loadMemory(userId, guildId);
  let activeMemory = client.memory?.get(userId) || { history: [], personal: {}, model: DEFAULT_MODEL, mode: "unfiltered" };

  if (activeMemory.history.length === 0 && longTerm.history.length > 0) {
    activeMemory.history = longTerm.history;
  }

  // Image understanding? currently no vision model, but we can detect image attachments
  if (message.attachments.size > 0) {
    const image = message.attachments.first();
    if (image.contentType && image.contentType.startsWith("image/")) {
      // We'll return a placeholder for now
      return "i can't see images yet, but i will soon. 🖼️";
    }
  }

  // Detect tool usage
  const tool = detectTool(message.content);
  if (tool) {
    try {
      const result = await executeTool(tool.tool, tool.args, { message, client });
      if (typeof result === "string") {
        return { type: "text", content: result };
      } else if (result.type === "image") {
        return { type: "image", url: result.url };
      } else {
        return { type: "text", content: "something happened" };
      }
    } catch (err) {
      console.error("Tool error:", err.message);
      return { type: "text", content: `i couldn't do that: ${err.message}` };
    }
  }

  // Summarize if history too long
  if (activeMemory.history.length > 20) {
    const recent = activeMemory.history.slice(-10);
    const older = activeMemory.history.slice(0, -10);
    const summary = await summarizeHistory(older);
    activeMemory.history = recent;
    activeMemory.summary = summary;
  }

  // Build system prompt (use same logic from messageCreate, but simplified)
  const systemPrompt = `You are Chromed AI, a witty and edgy Discord bot. Speak with internet slang and lowercase mostly. Keep answers helpful and slightly sarcastic. Never use racial slurs or harmful content.`;

  const messages = [{ role: "system", content: systemPrompt }];
  if (activeMemory.summary) {
    messages.push({ role: "user", content: `Earlier conversation summary: ${activeMemory.summary}` });
  }
  messages.push(...activeMemory.history);
  messages.push({ role: "user", content: message.content });

  const answer = await callAI(activeMemory.model || DEFAULT_MODEL, messages, 0.75, 1024);

  // Update memory
  activeMemory.history.push({ role: "user", content: message.content });
  activeMemory.history.push({ role: "assistant", content: answer });
  client.memory?.set(userId, activeMemory);
  await saveMemory(userId, guildId, activeMemory.history, activeMemory.summary);

  return { type: "text", content: answer };
}

module.exports = {
  handleMessage,
  callAI,
  detectTool,
  executeTool,
  ensureTables,
  loadMemory,
  saveMemory,
  summarizeHistory,
  detectMood,
};
