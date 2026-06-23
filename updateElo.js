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
// 2. ELO CALCULATION HELPERS
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
  const size = players.length;

  // Winner gets more Elo the bigger the match (harder to win)
  // Losers lose less Elo the bigger the match (easier to lose)
  const winnerMult = { 3: 1.2, 4: 1.3, 5: 1.4, 6: 1.5, 8: 1.7 }[size] || 1.0;
  const loserMult  = { 3: 0.7, 4: 0.6, 5: 0.55, 6: 0.5, 8: 0.4 }[size] || 1.0;

  const winner = players.find(p => p.name === winnerName);
  if (!winner) return;

  const avgOppElo =
    players.filter(p => p.name !== winnerName).reduce((s, p) => s + p.elo, 0) /
    (size - 1);

  const expWinner = expectedScore(winner.elo, avgOppElo);

  winner.lastElo = winner.elo;
  winner.elo = Math.round(winner.elo + k * (1 - expWinner) * winnerMult);

  players.forEach(p => {
    if (p.name === winnerName) return;
    const expLoser = expectedScore(p.elo, winner.elo);
    p.lastElo = p.elo;
    p.elo = Math.round(p.elo + k * (0 - expLoser) * loserMult);
  });
}

function updateTagTeamElo(teamA, teamB) {
  // teamA is always the winner
  const k = 28;
  const expA = expectedScore(teamA.elo, teamB.elo);
  const expB = 1 - expA;

  teamA.lastElo = teamA.elo;
  teamB.lastElo = teamB.elo;

  let newA = teamA.elo + k * (1 - expA);
  let newB = teamB.elo + k * (0 - expB);

  // Slight random variance (-3 to +3)
  newA += (Math.random() - 0.5) * 6;
  newB += (Math.random() - 0.5) * 6;

  teamA.elo = Math.round(newA);
  teamB.elo = Math.round(newB);
}

// ==============================================
// 3. TAG TEAM RESOLUTION (exact match + freebird)
// ==============================================
// Finds the tag team object for a given set of wrestlers.
// Step 1: exact member list match (standard teams)
// Step 2: freebird — all wrestlers share a faction that owns a tag team

function resolveTeam(universe, members) {
  // Exact match
  const exact = universe.tagTeams.find(
    t => t.members.length === members.length &&
         members.every(m => t.members.includes(m))
  );
  if (exact) return exact;

  // Freebird fallback
  const faction = (universe.factions || []).find(
    f => members.every(m => f.members.includes(m))
  );
  if (!faction) return null;

  const factionTeam = universe.tagTeams.find(
    t => (faction.teams || []).includes(t.id)
  );
  if (factionTeam) {
    console.log(`✔ Freebird: [${members.join(" & ")}] competing as "${factionTeam.name}"`);
  }
  return factionTeam || null;
}

// ==============================================
// 4. PARSE MATCH STRING
// ==============================================
// Accepted formats (winner is always listed FIRST):
//   Singles:   "A vs B | YYYY-MM-DD"
//   Tag Team:  "A & B vs C & D | YYYY-MM-DD"
//   Multiman:  "A vs B vs C | YYYY-MM-DD"

function parseMatchString(str) {
  if (!str || typeof str !== "string") return null;

  const parts = str.split("|");
  if (parts.length < 2) return null;

  const matchPart = parts[0].trim();
  const datePart  = parts[1].trim();

  // Tag team — detected by presence of &
  if (matchPart.includes("&")) {
    const sides = matchPart.split(" vs ").map(s => s.trim());
    const teamA = sides[0].split("&").map(n => n.trim()).filter(Boolean);
    const teamB = sides[1].split("&").map(n => n.trim()).filter(Boolean);
    return { matchType: "TagTeam", teamA, teamB, datePart };
  }

  // Singles or multiman
  const names = matchPart.split(" vs ").map(n => n.trim()).filter(Boolean);
  return {
    matchType: names.length > 2 ? "Multiman" : "Singles",
    names,
    datePart
  };
}

// ==============================================
// 5. VALIDATE MATCHES (runs before anything is saved)
// ==============================================

function validateMatches(matchStrings, universe) {
  const errors = [];

  matchStrings.forEach(matchStr => {
    if (!matchStr || typeof matchStr !== "string") {
      errors.push(`  ✘ Invalid entry (not a string): ${matchStr}`);
      return;
    }

    const parts = matchStr.split("|");
    if (parts.length < 2) {
      errors.push(`  ✘ Missing date — add "| YYYY-MM-DD" to: "${matchStr}"`);
      return;
    }

    const matchPart = parts[0].trim();

    if (matchPart.includes("&")) {
      // Tag team
      const sides = matchPart.split(" vs ").map(s => s.trim());
      if (sides.length !== 2) {
        errors.push(`  ✘ Tag match must have exactly 2 sides: "${matchStr}"`);
        return;
      }
      const teamA = sides[0].split("&").map(n => n.trim()).filter(Boolean);
      const teamB = sides[1].split("&").map(n => n.trim()).filter(Boolean);

      [...teamA, ...teamB].forEach(name => {
        if (!getPlayer(universe, name))
          errors.push(`  ✘ Wrestler not found: "${name}" in "${matchStr}"`);
      });
      if (!resolveTeam(universe, teamA))
        errors.push(`  ✘ No tag team or faction for [${teamA.join(" & ")}] in "${matchStr}"\n     Tip: check spelling, or add them to a faction with a linked tag team`);
      if (!resolveTeam(universe, teamB))
        errors.push(`  ✘ No tag team or faction for [${teamB.join(" & ")}] in "${matchStr}"\n     Tip: check spelling, or add them to a faction with a linked tag team`);

    } else {
      // Singles / multiman
      const names = matchPart.split(" vs ").map(n => n.trim()).filter(Boolean);
      if (names.length < 2) {
        errors.push(`  ✘ Match needs at least 2 wrestlers: "${matchStr}"`);
        return;
      }
      names.forEach(name => {
        if (!getPlayer(universe, name))
          errors.push(`  ✘ Wrestler not found: "${name}" in "${matchStr}"`);
      });
    }
  });

  return errors;
}

// ==============================================
// 6. PROCESS A SINGLE MATCH
// ==============================================

function processMatchString(universe, matchStr) {
  const parsed = parseMatchString(matchStr);
  if (!parsed) {
    console.warn("Skipping invalid match:", matchStr);
    return universe;
  }

  const timestamp = new Date(`${parsed.datePart}T12:00:00`).getTime();

  // ── TAG TEAM ────────────────────────────────────────────
  if (parsed.matchType === "TagTeam") {
    const { teamA, teamB } = parsed;

    const tagA = resolveTeam(universe, teamA);
    const tagB = resolveTeam(universe, teamB);

    if (!tagA || !tagB) {
      console.warn("Tag team not resolved:", teamA, teamB);
      return universe;
    }

    updateTagTeamElo(tagA, tagB); // tagA is always winner
    tagA.wins++;
    tagB.losses++;

    // Note freebird lineups in match string when lineup differs from stored members
    const noteA = teamA.every(m => tagA.members.includes(m)) ? "" : ` (${tagA.name})`;
    const noteB = teamB.every(m => tagB.members.includes(m)) ? "" : ` (${tagB.name})`;
    const cleanMatch = `${teamA.join(" & ")}${noteA} vs ${teamB.join(" & ")}${noteB} | ${parsed.datePart}`;

    tagA.matchHistory.unshift(safeMatchHistoryEntry("WIN",  cleanMatch, timestamp));
    tagB.matchHistory.unshift(safeMatchHistoryEntry("LOSS", cleanMatch, timestamp));
    universe.lastWeekMatches.push(cleanMatch);

    [...teamA, ...teamB].forEach(name => {
      const p = getPlayer(universe, name);
      if (!p) return;
      const result = teamA.includes(name) ? "WIN" : "LOSS";
      p.matchHistory.unshift(safeMatchHistoryEntry(result, cleanMatch, timestamp));
    });

    return universe;
  }

  // ── MULTIMAN ────────────────────────────────────────────
  if (parsed.matchType === "Multiman") {
    const { names } = parsed;
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
    universe.lastWeekMatches.push(matchStr);
    return universe;
  }

  // ── SINGLES ─────────────────────────────────────────────
  if (parsed.matchType === "Singles") {
    const [p1, p2] = parsed.names;
    const A = getPlayer(universe, p1);
    const B = getPlayer(universe, p2);
    if (!A || !B) return universe;

    updateSinglesElo(A, B, p1);
    A.wins++;
    B.losses++;

    A.matchHistory.unshift(safeMatchHistoryEntry("WIN",  matchStr, timestamp));
    B.matchHistory.unshift(safeMatchHistoryEntry("LOSS", matchStr, timestamp));
    universe.lastWeekMatches.push(matchStr);
    return universe;
  }

  return universe;
}

// ==============================================
// 7. RUN SHOW
// ==============================================

function runShow(matchStrings, universe) {
  universe.lastWeekMatches = [];
  matchStrings.forEach(m => processMatchString(universe, m));
  return universe;
}

// ==============================================
// 8. RANKINGS + DIVISIONS
// ==============================================

function updateRankingsAndDivisions(universe) {
  // 1. Assign divisions
  universe.players.forEach(p => {
    p.division = p.elo >= 1500 ? "Div 1" : "Div 2";
  });

  // 2. Global sort + global rank
  universe.players.sort((a, b) => b.elo - a.elo);
  universe.players.forEach((p, i) => (p.rank = i + 1));

  // 3. Division rank
  const div1 = universe.players.filter(p => p.division === "Div 1");
  const div2 = universe.players.filter(p => p.division === "Div 2");
  div1.forEach((p, i) => (p.divisionRank = i + 1));
  div2.forEach((p, i) => (p.divisionRank = i + 1));

  console.log(`✔ Rankings updated: ${div1.length} in Div 1, ${div2.length} in Div 2`);
}

// ==============================================
// 9. SAVE
// ==============================================

function saveUniverse(universe) {
  fs.writeFileSync("universe.json", JSON.stringify(universe, null, 2));
  console.log("✔ Universe updated and saved.");
}

// ==============================================
// 10. MAIN — edit matchesToRun each week
// ==============================================

let universe = require("./universe.json");

const matchesToRun = [
  "CannibalJeebus & Offron vs Slug & JJ | 2026-06-18",
  "Jimmytvf vs WheatSeedGuy | 2026-06-15",
  "Gamerat60 vs JeromeySchweemey | 2026-06-15",
  "CannibalJeebus vs CrowBird | 2026-06-16",
  "Slug vs HeyyaNito | 2026-06-16",
  "Hro79 vs Cardraul | 2026-06-17",
  "Balderoni vs Shartstarion | 2026-06-17",
  "Nans vs MininumWageWorker | 2026-06-18",
  "PottiePots vs RebelMime vs Dinsdale |  2026-06-19",
  "MiniMoth10 vs Kaden vs Ravroid vs Paulg8| 2026-06-19",
];

// Validate first — stops before touching universe.json if anything is wrong
const errors = validateMatches(matchesToRun, universe);

if (errors.length > 0) {
  console.error("\n❌ SHOW NOT SAVED — fix these errors and re-run:\n");
  errors.forEach(e => console.error(e));
  console.error("\n⚠ universe.json was NOT modified.\n");
  process.exit(1);
}

console.log("✔ All matches validated. Running show...");
universe = runShow(matchesToRun, universe);
updateRankingsAndDivisions(universe);
saveUniverse(universe);


/*
ROSTER REFERENCE:
TaysTales, Cardraul, Balderoni, Deadlee, Ginauz, RebelMime, HerrKrokodil,
Jimmytvf, MuddyB3, HeyyaNito, CrowBird, RawrImHere, Kaden, Pigmanman,
BloodiestCorpse, Lilith, Madeline, MininumWageWorker, TollerTornado,
WilliamIsTed, Narky, Dinsdale, Shartstarion, Slug, RagGhee, Offron, Paulg8,
CannibalJeebus, Ravroid, PilleVipp, Hro79, PottiePots, TheBobbyV, MuraWisteria,
JJ, Nans, RoofDog, ManulTheCat, MiniMoth10,WheatSeedGuy,JeromeySchweemey

TAG TEAMS:
  id=1  The Dirty Ducks    [TheBobbyV, MuddyB3]
  id=2  The Hex Girls      [Lilith, CrowBird]
  id=3  Rogue Hog          [JJ, Slug]
  id=4  Fork Knife         [Kaden, Ginauz]
  id=5  Loose Losers       [CannibalJeebus, Offron]
  id=6  TnT                [TaysTales, TollerTornado]
  

FACTIONS (freebird eligible):
  Fork Knife     -> members: Kaden, Ginauz, Nans       -> team id=4
  The Dirty Ducks-> members: TheBobbyV, RagGhee, MuddyB3 -> team id=1
  Loose Losers   -> members: CannibalJeebus, WilliamIsTed, Offron -> team id=5
  The Hex Girls  -> members: CrowBird, Lilith, Slug, JJ -> team id=2,3
**/
