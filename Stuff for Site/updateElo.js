const fs = require('fs');
const startingElo = 1500;
let universe = JSON.parse(fs.readFileSync('universe.json', 'utf8'));
let players = universe.players;

// Helper: find wrestler
function getPlayer(name) {
  return players.find(p => p.name === name);
}

// Elo calculation with scaling
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

  return Math.round(k * (score - expected));
}

// Rivalry tracker
function updateRivalry(a, b) {
  const key = [a, b].sort().join(' vs ');
  universe.rivalries = universe.rivalries || {};
  universe.rivalries[key] = (universe.rivalries[key] || 0) + 1;
}

// Promo generator
function generatePromo(winner, losers, matchType, isStoryline) {
  const rival = losers[0];
  const key = [winner.name, rival.name].sort().join(' vs ');
  const heat = universe.rivalries?.[key] || 1;
  const tagline = isStoryline ? "🔥 Storyline continues!" : "💥 Surprise upset!";
  return `${winner.name} cuts a promo: "I’ve beaten ${rival.name} ${heat} times now. That ${matchType} match was just the beginning!" ${tagline}`;
}

// Match parser
function parseMatch(line) {
  const [typePart, resultPart, finishPart] = line.split('|').map(s => s.trim());
  const matchType = typePart.split(':')[1].trim();
  const finishRaw = finishPart.split(':')[1].trim();
  const isStoryline = finishRaw.includes('[Storyline]');
  const finish = finishRaw.replace('[Storyline]', '').trim();

  let winnerName = null, opponents = [], isDraw = false;

  if (resultPart.startsWith('Draw:')) {
    isDraw = true;
    opponents = resultPart.replace('Draw:', '').split(',').map(s => s.trim());
  } else {
    [winnerName, others] = resultPart.split('def.').map(s => s.trim());
    opponents = others.split(',').map(s => s.trim());
  }

  return { matchType, winnerName, opponents, finish, isDraw, isStoryline };
}

// Weekly card generator
function generateWeeklyCard(players) {
  const shuffled = [...players].sort(() => 0.5 - Math.random());
  const matches = [];

  for (let i = 0; i < 10; i++) {
    const type = i % 3 === 0 ? 'TripleThreat' : 'Singles';
    const selected = shuffled.slice(i * 3, i * 3 + (type === 'TripleThreat' ? 3 : 2));
    const match = `MatchType: ${type} | ${selected[0].name} vs ${selected.slice(1).map(p => p.name).join(', ')} | Finish: TBD`;
    matches.push(match);
  }

  universe.weeklyCard = matches;
}

// Process matches
function processMatches(txtPath) {
  const lines = fs.readFileSync(txtPath, 'utf8').split('\n').filter(Boolean);
  universe.promos = universe.promos || [];
  universe.rivalries = universe.rivalries || {};
  universe.factionStats = universe.factionStats || {};

  for (const line of lines) {
    const { matchType, winnerName, opponents, finish, isDraw, isStoryline } = parseMatch(line);
    const allNames = isDraw ? opponents : [winnerName, ...opponents];

    if (isDraw) {
      for (const name of opponents) {
        const player = getPlayer(name);
        player.matches.push({ opponent: opponents.filter(n => n !== name).join(', '), result: 'Draw', finish });
      }
      continue;
    }

    const winner = getPlayer(winnerName);
    const avgOpponentElo = opponents.map(getPlayer).reduce((sum, p) => sum + (p.elo || startingElo), 0) / opponents.length;
    const winnerChange = calculateEloChange(winner.elo || startingElo, avgOpponentElo, 'Win', opponents.length, matchType, isStoryline);
    winner.elo = (winner.elo || startingElo) + winnerChange;
    winner.wins += 1;
    winner.matches.push({ opponent: opponents.join(', '), result: 'Win', finish });

    for (const loserName of opponents) {
      const loser = getPlayer(loserName);
      const otherOpponents = allNames.filter(n => n !== loserName);
      const avgOppElo = otherOpponents.map(getPlayer).reduce((sum, p) => sum + (p.elo || startingElo), 0) / otherOpponents.length;
      const change = calculateEloChange(loser.elo || startingElo, avgOppElo, 'Loss', allNames.length - 1, matchType, isStoryline);
      loser.elo = (loser.elo || startingElo) + change;
      loser.losses += 1;
      loser.matches.push({ opponent: winnerName, result: 'Loss', finish });
    }

    // Rivalry tracking
    opponents.forEach(o => updateRivalry(winnerName, o));

    // Promo generation
    const promo = generatePromo(winner, opponents.map(getPlayer), matchType, isStoryline);
    universe.promos.push(promo);
    console.log(promo);

    // Title match logic
    universe.championships.forEach(title => {
      const champ = getPlayer(title.holder);
      const inMatch = allNames.includes(champ.name);
      const sameDivision = champ.division === winner.division;

      if (inMatch && sameDivision && champ.name !== winner.name) {
        console.log(`🏆 Title Change: ${title.name} now held by ${winner.name}`);
        title.holder = winner.name;
      }
    });

    // Faction win tracking
    Object.entries(universe.factions || {}).forEach(([name, members]) => {
      if (members.includes(winner.name)) {
        universe.factionStats[name] = (universe.factionStats[name] || 0) + 1;
      }
    });
  }

  // Assign divisions
  players.forEach(p => {
    p.division = (p.elo || startingElo) > startingElo ? 'Div 1' : 'Div 2';
  });

  // Update rankings
  players.sort((a, b) => (b.elo || startingElo) - (a.elo || startingElo)).reverse();
  players.forEach((p, i) => p.rank = i + 1);

  // Update contenders
  universe.championships.forEach(title => {
    title.contenders = players
      .filter(p => p.division === title.division)
      .slice(0, 5)
      .map(p => p.name);
  });

  generateWeeklyCard(players);
  fs.writeFileSync('universe.json', JSON.stringify(universe, null, 2));
}

processMatches('weekly_matches.txt');
