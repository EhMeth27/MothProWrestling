const fs = require("fs");

// ==============================================
// 1. UTILITIES
// ==============================================

function getPlayer(universe, name) {
  return universe.players.find(p => p.name === name);
}

function safeMatchHistoryEntry(result, match, timestamp) {
  return { result, match, timestamp };
}

// ==============================================
// 2. MATCH TYPE DETECTION
// ==============================================

function detectMatchType(names) {
  const size = names.length;
  if (size === 2) return "Singles";
  if (size === 3) return "TripleThreat";
  if (size === 4) return "FourWay";
  if (size === 5) return "FiveWay";
  if (size === 6) return "SixWay";
  if (size === 8) return "EightWay";
  return "Singles";
}

// ==============================================
// 3. ELO CALCULATION HELPERS
// ==============================================

function expectedScore(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function updateSinglesElo(A, B, winnerName) {
  const k = 32;
  const resultA = A.name === winnerName ? 1 : 0;
  const resultB = 1 - resultA;

  const expA = expectedScore(A.elo, B.elo);
  const expB = 1 - expA;

  A.lastElo = A.elo;
  B.lastElo = B.elo;

  A.elo = Math.round(A.elo + k * (resultA - expA));
  B.elo = Math.round(B.elo + k * (resultB - expB));
}

function updateMultimanElo(universe, names, winnerName) {
  const players = names.map(n => getPlayer(universe, n)).filter(Boolean);
  const k = 32;

  const winner = players.find(p => p.name === winnerName);
  if (!winner) return;

  const avgOppElo =
    players.filter(p => p.name !== winnerName).reduce((s, p) => s + p.elo, 0) /
    (players.length - 1);

  const expWinner = expectedScore(winner.elo, avgOppElo);

  winner.lastElo = winner.elo;
  winner.elo = Math.round(winner.elo + k * (1 - expWinner));

  players.forEach(p => {
    if (p.name === winnerName) return;

    const expLoser = expectedScore(p.elo, winner.elo);
    p.lastElo = p.elo;
    p.elo = Math.round(p.elo + k * (0 - expLoser));
  });
}

function updateTagTeamElo(teamA, teamB, winnerName) {
  const k = 28;

  const resultA = teamA.name === winnerName ? 1 : 0;
  const resultB = 1 - resultA;

  const expA = expectedScore(teamA.elo, teamB.elo);
  const expB = 1 - expA;

  teamA.lastElo = teamA.elo;
  teamB.lastElo = teamB.elo;

  // Normal ELO change
  let newA = teamA.elo + k * (resultA - expA);
  let newB = teamB.elo + k * (resultB - expB);

  // ⭐ Add slight random variance (between -3 and +3)
  const randomA = (Math.random() - 0.5) * 6; // -3 to +3
  const randomB = (Math.random() - 0.5) * 6; // -3 to +3

  newA += randomA;
  newB += randomB;

  teamA.elo = Math.round(newA);
  teamB.elo = Math.round(newB);
}

// ==============================================
// 4. PARSE MATCH STRING (SAFE)
// ==============================================

function parseMatchString(str) {
  if (!str || typeof str !== "string") return null;

  const parts = str.split("|");
  if (parts.length < 2) return null;

  const matchPart = parts[0].trim();
  const datePart = parts[1].trim();

  // TAG TEAM MATCH
  if (matchPart.includes("&")) {
    const [left, right] = matchPart.split("vs").map(s => s.trim());
    const teamA = left.split("&").map(n => n.trim());
    const teamB = right.split("&").map(n => n.trim());

    return {
      matchType: "TagTeam",
      teamA,
      teamB,
      datePart
    };
  }

  // MULTIMAN OR SINGLES
  const names = matchPart.split("vs").map(n => n.trim());

  return {
    matchType: names.length > 2 ? "Multiman" : "Singles",
    names,
    datePart
  };
}

// ==============================================
// 5. PROCESS MATCH
// ==============================================

function processMatchString(universe, matchStr) {
  const parsed = parseMatchString(matchStr);
  if (!parsed) {
    console.warn("Skipping invalid match:", matchStr);
    return universe;
  }

  const timestamp = new Date(`${parsed.datePart}T12:00:00`).getTime();

  // -------------------------
  // TAG TEAM MATCH
  // -------------------------
  if (parsed.matchType === "TagTeam") {
    const { teamA, teamB } = parsed;

    const tagA = universe.tagTeams.find(
      t => t.members.length === teamA.length && teamA.every(m => t.members.includes(m))
    );

    const tagB = universe.tagTeams.find(
      t => t.members.length === teamB.length && teamB.every(m => t.members.includes(m))
    );

    if (!tagA || !tagB) {
      console.warn("Tag team not found:", teamA, teamB);
      return universe;
    }

    const winnerTeam = tagA;
    const loserTeam = tagB;

    updateTagTeamElo(tagA, tagB, winnerTeam.name);

    tagA.wins++;
    tagB.losses++;

    const cleanMatch = `${teamA.join(" & ")} vs ${teamB.join(" & ")} | ${parsed.datePart}`;

    tagA.matchHistory.unshift(safeMatchHistoryEntry("WIN", cleanMatch, timestamp));
    tagB.matchHistory.unshift(safeMatchHistoryEntry("LOSS", cleanMatch, timestamp));

    // Add to lastWeekMatches so the homepage displays it
    universe.lastWeekMatches.push(cleanMatch);

    [...teamA, ...teamB].forEach(name => {
      const p = getPlayer(universe, name);
      if (!p) return;

      const result = teamA.includes(name) ? "WIN" : "LOSS";
      p.matchHistory.unshift(safeMatchHistoryEntry(result, cleanMatch, timestamp));
    });

    return universe;
  }

  // -------------------------
  // MULTIMAN MATCH
  // -------------------------
  if (parsed.matchType === "Multiman") {
    const names = parsed.names;
    const winner = names[0];

    names.forEach(name => {
      const p = getPlayer(universe, name);
      if (!p) return;

      const result = name === winner ? "WIN" : "LOSS";
      p.matchHistory.unshift(safeMatchHistoryEntry(result, matchStr, timestamp));

      if (result === "WIN") p.wins++;
      else p.losses++;
    });

    updateMultimanElo(universe, names, winner);
    return universe;
  }

  // -------------------------
  // SINGLES MATCH
  // -------------------------
  if (parsed.matchType === "Singles") {
    const [p1, p2] = parsed.names;

    const A = getPlayer(universe, p1);
    const B = getPlayer(universe, p2);

    if (!A || !B) return universe;

    const winner = p1;

    updateSinglesElo(A, B, winner);

    A.wins++;
    B.losses++;

    A.matchHistory.unshift(safeMatchHistoryEntry("WIN", matchStr, timestamp));
    B.matchHistory.unshift(safeMatchHistoryEntry("LOSS", matchStr, timestamp));

    return universe;
  }

  return universe;
}

// ==============================================
// 6. RUN SHOW
// ==============================================

function runShow(matchStrings, universe) {
  universe.lastWeekMatches = [];
  matchStrings.forEach(m => processMatchString(universe, m)); // FIXED ORDER
  return universe;
}

// ==============================================
// 7. DIVISIONS + RANKINGS
// ==============================================

function updateRankingsAndDivisions(universe) {
  // 1. Assign divisions
  universe.players.forEach(player => {
    player.division = player.elo >= 1500 ? "Div 1" : "Div 2";
  });

  // 2. Global sort + global rank
  universe.players.sort((a, b) => b.elo - a.elo);
  universe.players.forEach((p, i) => (p.rank = i + 1));

  // 3. Division rank — sort within each division and assign
  const div1 = universe.players.filter(p => p.division === "Div 1");
  const div2 = universe.players.filter(p => p.division === "Div 2");

  // Already sorted by elo from step 2, so assign in order
  div1.forEach((p, i) => (p.divisionRank = i + 1));
  div2.forEach((p, i) => (p.divisionRank = i + 1));

  console.log(`✔ Rankings updated: ${div1.length} in Div 1, ${div2.length} in Div 2`);
}

// ==============================================
// 8. SAVE
// ==============================================

function saveUniverse(universe) {
  fs.writeFileSync("universe.json", JSON.stringify(universe, null, 2));
  console.log("✔ Universe updated and saved.");
}

// ==============================================
// 9. MAIN
// ==============================================

let universe = require("./universe.json");

const matchesToRun = [
  "Ginauz & Kaden vs Lilith & CrowBird  | 2026-04-16",
  "ManulTheCat vs Madeline | 2026-04-13",
  "Ginauz vs BloodiestCorpse | 2026-04-13",
  "Balderoni vs JJ | 2026-04-14",
  "TaysTales vs Nans | 2026-04-14",
  "MuraWisteria vs WilliamIsTed | 2026-04-15",
  "PilleVipp vs CannibalJeebus | 2026-04-15",
  "TollerTornado vs Slug | 2026-04-16",
  "Pigmanman vs HeyyaNito vs Dinsdale| 2026-04-17",
  "Ravroid vs Narky| 2026-04-17"
];

universe = runShow(matchesToRun, universe);
updateRankingsAndDivisions(universe);
saveUniverse(universe);


/*
TaysTales vs Cardraul
Balderoni vs Deadlee
Ginauz vs RebelMime
HerrKrokodil
Jimmytvf
MuddyB3
HeyyaNito
CrowBird
RawrImHere
Kaden
Pigmanman
BloodiestCorpse
Lilith
Madeline
MininumWageWorker
TollerTornado
WilliamIsTed
Narky
Dinsdale
Shartstarion
Slug
RagGhee
Offron
Paulg8
CannibalJeebus
Ravroid
PilleVipp
Hro79
PottiePots
TheBobbyV
MuraWisteria
JJ
Nans
RoofDog
ManulTheCat
  "TollerTornado vs HeyyaNito | 2026-03-30",
  "Slug vs PottiePots | 2026-03-30",
  "RebelMime vs Jimmytvf | 2026-03-31",
  "Pigmanman vs MuraWisteria | 2026-04-01",
  "TheBobbyV vs Dinsdale | 2026-04-01",
  "PilleVipp vs Balderoni | 2026-04-02",
  "Paulg8 vs Offron | 2026-04-02",
  "Narky vs BloodiestCorpse | 2026-04-02"
  
**/