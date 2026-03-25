function getLevel(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

function xpForLevel(level) {
  return level * level * 100;
}

function buildProgressBar(xp) {
  const level = getLevel(xp);
  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  const progress = xp - currentLevelXP;
  const needed = nextLevelXP - currentLevelXP;
  const percent = Math.floor((progress / needed) * 100);
  const barFilled = Math.floor(percent / 10);
  const bar = "█".repeat(barFilled) + "░".repeat(10 - barFilled);
  return { level, progress, needed, percent, bar };
}

const PRESTIGE_LEVELS = [
  { prestige: 1, label: "✦ Bronze",   color: "#cd7f32" },
  { prestige: 2, label: "✦✦ Silver",  color: "#c0c0c0" },
  { prestige: 3, label: "✦✦✦ Gold",   color: "#ffd700" },
  { prestige: 4, label: "✦✦✦✦ Platinum", color: "#00d4ff" },
  { prestige: 5, label: "✦✦✦✦✦ Diamond", color: "#b9f2ff" },
];

function getPrestigeInfo(prestige) {
  return PRESTIGE_LEVELS[prestige - 1] || null;
}

const PRESTIGE_XP_REQUIREMENT = 10000; // XP needed to prestige

module.exports = { getLevel, xpForLevel, buildProgressBar, getPrestigeInfo, PRESTIGE_XP_REQUIREMENT };
