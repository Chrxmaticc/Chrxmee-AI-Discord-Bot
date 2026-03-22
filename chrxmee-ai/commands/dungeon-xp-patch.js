// ============================================================
// DUNGEON XP PATCH — Add this to the TOP of your dungeon.js
// after the require statements
// ============================================================

// Add this require at the top of dungeon.js:
// const { getSkillBonus, getPrestigeBonus, getPrestigeTitle, getRoomXP, getBossXP, xpForLevel, getPrestigeKey, NIGHTMARE_ROOMS, PRESTIGE_BOSSES } = require('./dungeon-prestige');

// ── ADD TO performRoom() — after goldGain is calculated ───────────────────
// Paste this block inside performRoom() after the action is resolved
// and before client.memory.set():

/*
// XP GAIN
const pKey = getPrestigeKey(guildId, userId);
let pData = client.memory.get(pKey) || { level:1, xp:0, skillPoints:0, skills:[], prestige:0, revivesUsed:0 };
const xpGain = getRoomXP(data.currentRoom, pData.prestige);
pData.xp += xpGain;

// Level up check
while (pData.level < 100 && pData.xp >= xpForLevel(pData.level + 1)) {
  pData.xp -= xpForLevel(pData.level + 1);
  pData.level++;
  pData.skillPoints += 2;
}
client.memory.set(pKey, pData);

// Apply skill bonuses
const skillBonus = getSkillBonus(pData.skills, pData.prestige);

// Dodge check
if (skillBonus.dodgeChance > 0 && Math.random() < skillBonus.dodgeChance) {
  hpLoss = 0; // dodged!
  result += ' | 🌀 DODGED!';
}

// Critical hit
if (skillBonus.critChance > 0 && Math.random() < skillBonus.critChance) {
  goldGain = Math.floor(goldGain * skillBonus.critMult);
  result += ` | 💥 CRIT! (${skillBonus.critMult}x)`;
}

// Gold Rush bonus
goldGain += skillBonus.goldPerRoom;

// Treasure Hunter
if (skillBonus.treasureChance > 0 && Math.random() < skillBonus.treasureChance) {
  const bonus = Math.floor(Math.random() * 50) + 30;
  goldGain += bonus;
  result += ` | 🏴‍☠️ Treasure! +${bonus}g`;
}

// Midas / all gold mult
goldGain = Math.floor(goldGain * skillBonus.allGoldMult);

// Nightmare rooms (prestige 3+)
if (pData.prestige >= 3 && Math.random() < 0.15) {
  const nightmare = NIGHTMARE_ROOMS[Math.floor(Math.random() * NIGHTMARE_ROOMS.length)];
  hpLoss += nightmare.dmg;
  goldGain += nightmare.gold;
  result += `\n🌑 **NIGHTMARE: ${nightmare.name}!** +${nightmare.gold}g / -${nightmare.dmg}HP`;
}
*/

// ── ADD TO performBossRoom() — after boss is killed ───────────────────────
// Paste this inside the boss kill handler after gold is calculated:

/*
// Boss XP
const pKey = getPrestigeKey(guildId, userId);
let pData = client.memory.get(pKey) || { level:1, xp:0, skillPoints:0, skills:[], prestige:0, revivesUsed:0 };
const bossXp = getBossXP(data.currentRoom, pData.prestige);
pData.xp += bossXp;
while (pData.level < 100 && pData.xp >= xpForLevel(pData.level + 1)) {
  pData.xp -= xpForLevel(pData.level + 1);
  pData.level++;
  pData.skillPoints += 2;
}
client.memory.set(pKey, pData);

const skillBonus = getSkillBonus(pData.skills, pData.prestige);

// Boss gold mult from Fortune God
goldReward = Math.floor(goldReward * skillBonus.bossGoldMult * skillBonus.allGoldMult);

// Prestige bosses (prestige 5+) — random chance to face harder version
if (pData.prestige >= 5 && Math.random() < 0.3) {
  const pBoss = PRESTIGE_BOSSES[Math.floor(Math.random() * PRESTIGE_BOSSES.length)];
  // Use pBoss.gold as additional reward
  goldReward += pBoss.gold;
}

// Revive system — if player dies in boss room
// Replace the death handler with:
// if (data.hp <= 0 && skillBonus.revives > 0 && pData.revivesUsed < skillBonus.revives) {
//   pData.revivesUsed++;
//   data.hp = 50;
//   client.memory.set(pKey, pData);
//   // show revive message instead of death
// }
*/

console.log('dungeon-xp-patch.js loaded — this is a reference file, not a runnable command');
