const fs = require("fs");

// ==============================================
// 1. UTILITIES
// ==============================================

function getPlayer(universe, name) {
  const p = universe.players.find(pl => pl.name === name);
  if (!p) {
    console.warn(`⚠ WARNING: Wrestler "${name}" not found in universe.json`);
  }
  return p;
}

// ==============================================
// 2. ELO CALCULATION (SINGLES + MULTI-MAN)
// ==============================================

function updateEloMultiman(players, winnerName, matchType, isPPV = false) {
  const k = 32;
  const numPlayers = players.length;

  const winnerMultTable = {
    Singles: 1.0,
    TripleThreat: 1.2,
    FourWay: 1.3,
    FiveWay: 1.4,
    SixWay: 1.5,
    EightWay: 1.7
  };

  const loserMultTable = {
    Singles: 1.0,
    TripleThreat: 0.6,
    FourWay: 0.5,
    FiveWay: 0.45,
    SixWay: 0.4,
    EightWay: 0.35
  };

  const baseWinnerMult = winnerMultTable[matchType] || 1.0;
  const baseLoserMult  = loserMultTable[matchType] || 1.0;

  const ppvBoost = isPPV ? 0.2 : 0;

  const winnerMult = baseWinnerMult + ppvBoost;
  const loserMult  = baseLoserMult + ppvBoost;

  const chaos = (Math.random() - 0.5) * 4;

  const winner = players.find(p => p.name === winnerName);
  if (!winner) {
    console.warn(`⚠ Winner "${winnerName}" not found in players for matchType ${matchType}`);
    return players;
  }

  const avgOppElo = players
    .filter(p => p.name !== winnerName)
    .reduce((sum, p) => sum + p.elo, 0) / (numPlayers - 1);

  const expectedWinner = 1 / (1 + Math.pow(10, (avgOppElo - winner.elo) / 400));

  winner.lastElo = winner.elo;
  winner.elo = Math.round(
    winner.elo + (k * (1 - expectedWinner) * winnerMult) + chaos
  );

  players.forEach(p => {
    if (p.name === winnerName) return;

    p.lastElo = p.elo;
    const expectedLoser = 1 / (1 + Math.pow(10, (winner.elo - p.elo) / 400));

    p.elo = Math.round(
      p.elo + (k * (0 - expectedLoser) * loserMult) - chaos
    );
  });

  return players;
}

// ==============================================
// 3. MATCH STRING PARSING
// ==============================================
// Format required:
// "Singles: A vs B | YYYY-MM-DD"
// Winner is always the FIRST name.

function parseMatchString(str) {
  const isPPV = str.includes("(PPV)");

  let datePart = null;
  if (str.includes("|")) {
    const parts = str.split("|");
    str = parts[0].trim();
    datePart = parts[1].trim();
  }

  str = str.replace("(PPV)", "").trim();

  const [typePart, wrestlersPart] = str.split(":");
  if (!typePart || !wrestlersPart) {
    console.warn("⚠ Invalid match string format:", str);
    return null;
  }

  const matchType = typePart.trim();
  const names = wrestlersPart.split("vs").map(n => n.trim()).filter(Boolean);

  return { matchType, names, isPPV, datePart };
}

// ==============================================
// 4. PROCESS A SINGLE MATCH STRING
// ==============================================

function processMatchString(matchString, universe) {
  const parsed = parseMatchString(matchString);
  if (!parsed) return universe;

  const { matchType, names, isPPV, datePart } = parsed;
	// Build clean universal match string
	const cleanMatch = `${names[0]} vs ${names[1]} | ${datePart}`;

  const players = names.map(n => getPlayer(universe, n)).filter(Boolean);

  if (players.length < 2) {
    console.warn("⚠ Not enough valid players for match:", matchString);
    return universe;
  }

  const winnerName = names[0];
  const winner = players.find(p => p.name === winnerName);

  if (!winner) {
    console.warn("⚠ Winner not found among loaded players:", winnerName);
    return universe;
  }

  winner.wins = (winner.wins || 0) + 1;
  players.forEach(p => {
    if (p.name !== winnerName) {
      p.losses = (p.losses || 0) + 1;
    }
  });

  updateEloMultiman(players, winnerName, matchType, isPPV);

  // Timestamp (REQUIRED because you chose Option A)
  const dateString = `${datePart}T11:00:00-06:00`;
  const timestamp = new Date(dateString).getTime();

  // Per-wrestler match history
  players.forEach(p => {
    p.matchHistory = p.matchHistory || [];
    p.matchHistory.unshift({
      result: p.name === winnerName ? "WIN" : "LOSS",
      match: matchString,
      timestamp: timestamp
    });
    p.matchHistory = p.matchHistory.slice(0, 20);
  });

  // Weekly match list
  universe.lastWeekMatches = universe.lastWeekMatches || [];
  universe.lastWeekMatches.push(matchString);

  // Global match history
  universe.matchHistory = universe.matchHistory || [];
  universe.matchHistory.unshift({
    match: matchString,
    timestamp: timestamp
  });
  universe.matchHistory = universe.matchHistory.slice(0, 500);

  return universe;
}

// ==============================================
// 5. RUN A FULL SHOW
// ==============================================

function runShow(matchStrings, universe) {
  universe.lastWeekMatches = [];
  matchStrings.forEach(m => processMatchString(m, universe));
  return universe;
}

// ==============================================
// 6. RANKINGS + DIVISIONS
// ==============================================

function updateRankingsAndDivisions(universe) {
  universe.players.forEach(player => {
    player.division = player.elo >= 1500 ? "Div 1" : "Div 2";
  });

  const div1 = universe.players
    .filter(p => p.division === "Div 1")
    .sort((a, b) => b.elo - a.elo);

  const div2 = universe.players
    .filter(p => p.division === "Div 2")
    .sort((a, b) => b.elo - a.elo);

  div1.forEach((player, index) => {
    player.divisionRank = index + 1;
  });

  div2.forEach((player, index) => {
    player.divisionRank = index + 1;
  });

  universe.players.sort((a, b) => b.elo - a.elo);
  universe.players.forEach((player, index) => {
    player.rank = index + 1;
  });

  console.log("✔ Divisions and division rankings updated.");
}

// ==============================================
// 7. MATCHMAKING HELPERS
// ==============================================

function getPlayersByDivision(universe, division) {
  return universe.players.filter(p => p.division === division);
}

function generateSinglesMatches(universe, division, count = 3) {
  const pool = [...getPlayersByDivision(universe, division)];
  const matches = [];

  while (pool.length >= 2 && matches.length < count) {
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];

    matches.push(`Singles: ${a.name} vs ${b.name}`);
  }

  return matches;
}

function generateMultimanMatch(universe, division, size = 3) {
  const pool = [...getPlayersByDivision(universe, division)];

  if (pool.length < size) return null;

  const chosen = [];
  for (let i = 0; i < size; i++) {
    chosen.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].name);
  }

  const typeNames = {
    3: "TripleThreat",
    4: "FourWay",
    5: "FiveWay",
    6: "SixWay",
    8: "EightWay"
  };

  const typeName = typeNames[size];
  if (!typeName) {
    console.warn("⚠ Unsupported multi-man size:", size);
    return null;
  }

  return `${typeName}: ${chosen.join(" vs ")}`;
}

// ==============================================
// 8. SAVE UNIVERSE
// ==============================================

function saveUniverse(universe) {
  fs.writeFileSync("universe.json", JSON.stringify(universe, null, 2));
  console.log("✔ Universe updated and saved.");
}

// ==============================================
// 9. MAIN EXECUTION
// ==============================================

let universe = require("./universe.json");

universe.lastWeekMatches = universe.lastWeekMatches || [];
universe.matchHistory = universe.matchHistory || [];

// Your matches MUST include dates now (Option A)
const matchesToRun = [
	"Singles: Kaden vs TollerTornado | 2026-01-19",
	"Singles: Ginauz vs HerrKrokodil | 2026-01-19",
	"Singles: MuddyB3 vs Jimmytvf | 2026-01-20",
	"Singles: RawrImHere vs Balderoni | 2026-01-20",
	"Singles: TheBobbyV vs Paulg8 | 2026-01-21",
	"Singles: Cardraul vs PottiePots | 2026-01-21",
	"Singles: Narky vs RagGhee | 2026-01-22",
	"Singles: Ravroid vs Deadlee | 2026-01-22",
	"Singles: MininumWageWorker vs Offron | 2026-01-23",
	"TripleThreat: RebelMime vs WilliamIsTed vs CannibalJeebus | 2026-01-23"
];

universe = runShow(matchesToRun, universe);
updateRankingsAndDivisions(universe);
saveUniverse(universe);
