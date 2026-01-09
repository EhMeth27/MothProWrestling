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

  // Mild chaos: -2 to +2
  const chaos = (Math.random() - 0.5) * 4;

  const winner = players.find(p => p.name === winnerName);
  if (!winner) {
    console.warn(`⚠ Winner "${winnerName}" not found in players for matchType ${matchType}`);
    return players;
  }

  // Average opponent ELO (all but winner)
  const avgOppElo = players
    .filter(p => p.name !== winnerName)
    .reduce((sum, p) => sum + p.elo, 0) / (numPlayers - 1);

  const expectedWinner = 1 / (1 + Math.pow(10, (avgOppElo - winner.elo) / 400));

  // Save last week's ELO before updating 
  winner.lastElo = winner.elo;
  // Update winner ELO
  winner.elo = Math.round(
    winner.elo + (k * (1 - expectedWinner) * winnerMult) + chaos
  );

  // Update losers ELO
  players.forEach(p => {
    if (p.name === winnerName) return;
	// Save last week's ELO before updating
	p.lastElo = p.elo;
    const expectedLoser = 1 / (1 + Math.pow(10, (winner.elo - p.elo) / 400));

    p.elo = Math.round(
      p.elo + (k * (0 - expectedLoser) * loserMult) - chaos
    );
  });
  players.forEach(p => {
	player.elo = newElo;
  }
  return players;
}

// ==============================================
// 3. MATCH STRING PARSING
// ==============================================
// Accepted formats:
// "Singles: A vs B"
// "TripleThreat: A vs B vs C"
// "FourWay: A vs B vs C vs D"
// "SixWay(PPV): A vs B vs C vs D vs E vs F"
// Winner is always the FIRST name in the list.

function parseMatchString(str) {
  const isPPV = str.includes("(PPV)");

  // Split off the date if provided
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

  const { matchType, names, isPPV } = parsed;

  const players = names.map(n => getPlayer(universe, n)).filter(Boolean);

  if (players.length < 2) {
    console.warn("⚠ Not enough valid players for match:", matchString);
    return universe;
  }

  const winnerName = names[0]; // first listed = winner

  const winner = players.find(p => p.name === winnerName);
  if (!winner) {
    console.warn("⚠ Winner not found among loaded players:", winnerName);
    return universe;
  }

  // Wins / losses
  winner.wins = (winner.wins || 0) + 1;
  players.forEach(p => {
    if (p.name !== winnerName) {
      p.losses = (p.losses || 0) + 1;
    }
  });

  // ELO update (handles singles + multi-man)
  updateEloMultiman(players, winnerName, matchType, isPPV);

  // Per-wrestler match history
  players.forEach(p => {
    p.matchHistory = p.matchHistory || [];
    p.matchHistory.unshift({
      result: p.name === winnerName ? "WIN" : "LOSS",
      match: matchString,
	  let timestamp;

	  if (parsed.datePart) {
		  // Force 11 AM Central Time
		  const dateString = `${parsed.datePart}T11:00:00-06:00`;
		  timestamp = new Date(dateString).getTime();
	  } else {
		  timestamp = Date.now();
	  }

    });
    // Keep only last 20 matches per wrestler
    p.matchHistory = p.matchHistory.slice(0, 20);
  });

  // Weekly match list (for site display)
  universe.lastWeekMatches = universe.lastWeekMatches || [];
  universe.lastWeekMatches.push(matchString);

  // Global universe match history
  universe.matchHistory = universe.matchHistory || [];
  universe.matchHistory.unshift({
    match: matchString,
	  if (parsed.datePart) {
		  // Force 11 AM Central Time
		  const dateString = `${parsed.datePart}T11:00:00-06:00`;
		  timestamp = new Date(dateString).getTime();
	  } else {
		  timestamp = Date.now();
	  }
  });
  // Keep last 500 matches globally
  universe.matchHistory = universe.matchHistory.slice(0, 500);

  return universe;
}

// ==============================================
// 5. RUN A FULL SHOW (ARRAY OF MATCH STRINGS)
// ==============================================

function runShow(matchStrings, universe) {
  // Clear last week's matches each run
  universe.lastWeekMatches = [];
  matchStrings.forEach(m => processMatchString(m, universe));
  return universe;
}

// ==============================================
/* 6. RANKINGS + DIVISIONS
   Div 1: elo >= 1500
   Div 2: elo < 1500
*/
// ==============================================

function updateRankingsAndDivisions(universe) {
  // Assign divisions based on ELO
  universe.players.forEach(player => {
    player.division = player.elo >= 1500 ? "Div 1" : "Div 2";
  });

  // Sort each division separately
  const div1 = universe.players
    .filter(p => p.division === "Div 1")
    .sort((a, b) => b.elo - a.elo);

  const div2 = universe.players
    .filter(p => p.division === "Div 2")
    .sort((a, b) => b.elo - a.elo);

  // Assign division ranks (start at 1 for each division)
  div1.forEach((player, index) => {
    player.divisionRank = index + 1;
  });

  div2.forEach((player, index) => {
    player.divisionRank = index + 1;
  });

  // Optional: keep global rank too
  universe.players.sort((a, b) => b.elo - a.elo);
  universe.players.forEach((player, index) => {
    player.rank = index + 1;
  });

  console.log("✔ Divisions and division rankings updated.");
}


// ==============================================
// 7. DIVISION-BASED MATCHMAKING
// ==============================================

function getPlayersByDivision(universe, division) {
  return universe.players.filter(p => p.division === division);
}

// Generate N random singles matches within a division
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

// Generate a single multi-man match from a division
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

// Ensure history structures exist
universe.lastWeekMatches = universe.lastWeekMatches || [];
universe.matchHistory = universe.matchHistory || [];

// Example: manually booked matches (edit or replace these)
const manualMatches = [
  "Singles: RagGhee vs Shartstarion",
  "TripleThreat: Narky vs Ravroid vs Offron",
  "FourWay(PPV): CrowBird vs PottiePots vs TaysTales vs MininumWageWorker"
];

// Example: auto-generate some division-based matches
const div1Singles = generateSinglesMatches(universe, "Div 1", 2);
const div2Singles = generateSinglesMatches(universe, "Div 2", 2);
const div1Triple  = generateMultimanMatch(universe, "Div 1", 3);
const div2Four    = generateMultimanMatch(universe, "Div 2", 4);

const autoMatches = [
  ...div1Singles,
  ...div2Singles,
  div1Triple,
  div2Four
].filter(Boolean);

// Choose what to run:
//  - just manualMatches
//  - just autoMatches
//  - or combine them
const matchesToRun = [
	"Singles: RagGhee vs Shartstarion",
	"Singles: Narky vs Ravroid",
	"Singles: Cardraul vs WilliamIsTed",
	"Singles: HerrKrokodil vs Madeline",
	"Singles: Offron vs PottiePots",
	"Singles: TollerTornado vs TheBobbyV",
	"Singles: CrowBird vs HeyyaNito",
	"Singles: TaysTales vs CannibalJeebus",
	"Singles: MininumWageWorker vs RebelMime",
	"Singles: Shartstarion vs Jimmytvf"
];

universe = runShow(matchesToRun, universe);
updateRankingsAndDivisions(universe);
saveUniverse(universe);
