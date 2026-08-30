const PRESTIGE_XP_REQUIREMENT = 50000;
const BASE_XP_MIN = 5;
const BASE_XP_MAX = 15;
const XP_COOLDOWN_MS = 60000;

function getLevel(xp) {
  let level = 0;
  let needed = 100;
  let remaining = xp;
  while (remaining >= needed) {
    remaining -= needed;
    level++;
    needed = Math.floor(needed * 1.2);
  }
  return level;
}

function xpForLevel(level) {
  let total = 0;
  let needed = 100;
  for (let i = 0; i < level; i++) {
    total += needed;
    needed = Math.floor(needed * 1.2);
  }
  return total;
}

function buildProgressBar(xp) {
  const level = getLevel(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const progress = xp - currentLevelXp;
  const needed = nextLevelXp - currentLevelXp;
  const percent = Math.min(100, Math.floor((progress / needed) * 100));
  const filled = Math.floor(percent / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  return { level, progress, needed, percent, bar };
}

function getPrestigeInfo(prestige) {
  const colors = {
    1: "#ffd700",
    2: "#c0c0c0",
    3: "#cd7f32",
    4: "#00ffff",
    5: "#ff00ff",
  };
  const labels = {
    1: "prestige i",
    2: "prestige ii",
    3: "prestige iii",
    4: "prestige iv",
    5: "prestige v",
  };
  return {
    label: labels[prestige] || `prestige ${prestige}`,
    color: colors[prestige] || "#ffd700",
  };
}

module.exports = {
  PRESTIGE_XP_REQUIREMENT,
  BASE_XP_MIN,
  BASE_XP_MAX,
  XP_COOLDOWN_MS,
  getLevel,
  xpForLevel,
  buildProgressBar,
  getPrestigeInfo,
};
