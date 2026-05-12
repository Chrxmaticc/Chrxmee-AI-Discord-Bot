require("dotenv").config();

const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

console.log("=== DEPLOY-COMMANDS START ===");
console.log("Current working directory (project root):", __dirname);

// === 1. Load from subfolder "commands" (if it exists) ===
const commandsFolderPath = path.join(__dirname, "commands");
let subFolderFiles = [];

if (fs.existsSync(commandsFolderPath)) {
  console.log('Found "commands" subfolder — loading files from it...');
  subFolderFiles = fs.readdirSync(commandsFolderPath)
    .filter(file => file.endsWith(".js"))
    .map(file => path.join(commandsFolderPath, file));

  if (subFolderFiles.length > 0) {
    console.log(`  Found ${subFolderFiles.length} command file(s) in /commands:`);
    subFolderFiles.forEach(f => console.log(`    - ${path.basename(f)}`));
  } else {
    console.log("  No .js files inside /commands folder.");
  }
} else {
  console.log('No "commands" subfolder found — skipping.');
}

// === 2. Load loose .js files from root (main folder) ===
const rootPath = __dirname;
const allRootFiles = fs.readdirSync(rootPath);
const looseCommandFiles = allRootFiles.filter(file => 
  file.endsWith(".js") && 
  file !== "index.js" && 
  file !== "deploy-commands.js"
);

console.log(`\nFound ${looseCommandFiles.length} loose .js file(s) in root folder:`);
if (looseCommandFiles.length > 0) {
  looseCommandFiles.forEach(file => console.log(`  - ${file}`));
} else {
  console.log("  No loose command files in root.");
}

// === Combine both sources ===
const allCommandPaths = [...subFolderFiles, ...looseCommandFiles.map(f => path.join(rootPath, f))];

if (allCommandPaths.length === 0) {
  console.error("ERROR: No command files found anywhere!");
  console.log("  - Create .js files in root or in a 'commands' folder");
  process.exit(1);
}

const commands = [];

for (const filePath of allCommandPaths) {
  try {
    const command = require(filePath);
    const fileName = path.basename(filePath);

    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
      console.log(`  Loaded command: ${command.data.name} (${fileName})`);
    } else {
      console.warn(`  Skipped ${fileName}: missing 'data' or 'execute'`);
    }
  } catch (err) {
    console.error(`  Failed to load ${path.basename(filePath)}:`, err.message);
  }
}

if (commands.length === 0) {
  console.error("ERROR: No valid commands loaded! Check your files.");
  process.exit(1);
}

// Check env vars
if (!process.env.BOT_TOKEN) {
  console.error("ERROR: BOT_TOKEN missing from .env!");
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error("ERROR: CLIENT_ID missing from .env!");
  process.exit(1);
}

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log(`\nRegistering ${commands.length} command(s):`);
    commands.forEach(cmd => console.log(`  - ${cmd.name}`));

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log(`\nSUCCESS: Registered ${data.length} global command(s)!`);
    console.log("Global commands can take up to 1 hour to appear in Discord.");
  } catch (err) {
    console.error("\nREGISTRATION FAILED:");
    console.error(err.message || err);
  }
})();
