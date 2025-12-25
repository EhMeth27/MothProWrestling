const fs = require('fs');
const startingElo = 1500;

// Load universe safely
let universe = JSON.parse(fs.readFileSync('universe.json', 'utf8'));
let players = universe.players || [];
if (!Array.isArray(players)) players = [];

// Ensure base fields exist
players.forEach(p => {
  if (typeof p.elo !== 'number') p.elo = startingElo;
  if (typeof p.wins !== 'number') p.wins = 0;
  if (typeof p.losses !== 'number') p.losses = 0;
  if (!Array.isArray(p.matches)) p.matches = [];
  if (!p.name) throw new Error('Player missing name in universe.json');
});

universe.promos = universe.promos || [];
universe.rivalries = universe.rivalries || {};
universe.factionStats = universe.factionStats || {};
universe.factions = universe.factions || {};
universe.championships = universe.championships || [];

// Helpers
function getPlayer(name) {
  if (!name) return undefined;
  return players.find(p => p.name === name);
}

function ensurePlayer(name) {
  let p = getPlayer(name);
  if (!p) {
    throw new Error(`Player not found in universe.json: ${name}`);
  }
  if (!Array.isArray(p.matches)) p.matches = [];
  return p;
}

function calculateEloChange(playerElo, opponentAvgElo, result, numOpponents, matchType, isStoryline = false, baseK = 64) {
  const expected = 1 / (1 + Math.pow(10, (opponentAvgElo - playerElo) / 400));
  const score = result === 'Win' ? 1 : result === 'Loss' ? 0 : 0.5;

  const typeMultipliers = {
    Singles: 1.0,
    TripleThreat: 1.2,
    Fatal4Way: 1.4,
    '6ManTag': 1.6,
    BattleRoyal: 2.0
  };

  let k = baseK * (typeMultipliers[matchType] || 1.0);

  if (numOpponents > 1) {
    if (result === 'Win') k *= 1 + (numOpponents - 1) * 0.25;
    else if (result === 'Loss') k *= 0.5;
    else k *= 0.75;
  }

  if (isStoryline) k *= 1.3;

  return Math