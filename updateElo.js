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

function updateSinglesElo(A, B, winnerName, isPPV = false) {
  const k = isPPV ? 48 : 32;
  const resultA = A.name === winnerName ? 1 : 0;
  const resultB = 1 - resultA;

  const expA = expectedScore(A.elo, B.elo);
  const expB = 1 - expA;

  A.lastElo = A.elo;
  B.lastElo = B.elo;

  A.elo = Math.round(A.elo + k * (resultA - expA));
  B.elo = Math.round(B.elo + k * (resultB - expB));
}

function updateMultimanElo(universe, names, winnerName, isPPV = false) {
  const players = names.map(n => getPlayer(universe, n)).filter(Boolean);
  const k = isPPV ? 48 : 32;
  const size = players.length;

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

// Multi-team tag match Elo:
// Winner team gets more the more teams there are.
// Losing teams lose less the more teams there are.
// teamSides[0] is always the winning team.
function updateMultiTeamElo(teamSides, isPPV = false) {
  const k = isPPV ? 42 : 28;
  const numTeams = teamSides.length;

  // Multipliers scale with number of teams in the match
  const winnerMult = { 2: 1.0, 3: 1.25, 4: 1.5 }[numTeams] || 1.0;
  const loserMult  = { 2: 1.0, 3: 0.65, 4: 0.5 }[numTeams] || 1.0;

  const winner = teamSides[0];
  const losers = teamSides.slice(1);

  const avgOppElo = losers.reduce((s, t) => s + t.elo, 0) / losers.length;
  const expWinner = expectedScore(winner.elo, avgOppElo);

  winner.lastElo = winner.elo;
  winner.elo = Math.round(
    winner.elo + k * (1 - expWinner) * winnerMult + (Math.random() - 0.5) * 6
  );

  losers.forEach(loser => {
    const expLoser = expectedScore(loser.elo, winner.elo);
    loser.lastElo = loser.elo;
    loser.elo = Math.round(
      loser.elo + k * (0 - expLoser) * loserMult + (Math.random() - 0.5) * 6
    );
  });
}

// ==============================================
// 3. TAG TEAM RESOLUTION (exact match + freebird)
// ==============================================

function resolveTeam(universe, members) {
  const exact = universe.tagTeams.find(
    t => t.members.length === members.length &&
         members.every(m => t.members.includes(m))
  );
  if (exact) return exact;

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
//   Singles:         "A vs B | YYYY-MM-DD"
//   Tag Team:        "A & B vs C & D | YYYY-MM-DD"
//   3-way tag:       "A & B vs C & D vs E & F | YYYY-MM-DD"
//   4-way tag:       "A & B vs C & D vs E & F vs G & H | YYYY-MM-DD"
//   Multiman:        "A vs B vs C | YYYY-MM-DD"
//   PPV:             append (PPV) to any format

function parseMatchString(str) {
  if (!str || typeof str !== "string") return null;

  const isPPV = str.includes("(PPV)");
  const clean = str.replace("(PPV)", "").trim();

  const parts = clean.split("|");
  if (parts.length < 2) return null;

  const matchPart = parts[0].trim();
  const datePart  = parts[1].trim();

  // Tag team match — any side contains &
  if (matchPart.includes("&")) {
    const sides = matchPart.split(" vs ").map(s => s.trim());
    const teams = sides.map(side =>
      side.split("&").map(n => n.trim()).filter(Boolean)
    );
    return { matchType: "TagTeam", teams, datePart, isPPV };
  }

  // Singles or multiman
  const names = matchPart.split(" vs ").map(n => n.trim()).filter(Boolean);
  return {
    matchType: names.length > 2 ? "Multiman" : "Singles",
    names,
    datePart,
    isPPV
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

    const clean = matchStr.replace("(PPV)", "").trim();
    const parts = clean.split("|");
    if (parts.length < 2) {
      errors.push(`  ✘ Missing date — add "| YYYY-MM-DD" to: "${matchStr}"`);
      return;
    }

    const matchPart = parts[0].trim();

    if (matchPart.includes("&")) {
      // Tag team (2, 3, or 4 teams)
      const sides = matchPart.split(" vs ").map(s => s.trim());
      if (sides.length < 2 || sides.length > 4) {
        errors.push(`  ✘ Tag match must have 2–4 teams: "${matchStr}"`);
        return;
      }

      sides.forEach(side => {
        const members = side.split("&").map(n => n.trim()).filter(Boolean);
        members.forEach(name => {
          if (!getPlayer(universe, name))
            errors.push(`  ✘ Wrestler not found: "${name}" in "${matchStr}"`);
        });
        if (!resolveTeam(universe, members))
          errors.push(`  ✘ No tag team or faction for [${members.join(" & ")}] in "${matchStr}"\n     Tip: check spelling, or add them to a faction with a linked tag team`);
      });

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

  const { isPPV } = parsed;
  const timestamp = new Date(`${parsed.datePart}T12:00:00`).getTime();
  const ppvTag = isPPV ? " (PPV)" : "";

  // ── TAG TEAM (2, 3, or 4 teams) ─────────────────────────
  if (parsed.matchType === "TagTeam") {
    const { teams } = parsed;

    // Resolve all team objects — teams[0] is the winner
    const resolvedTeams = teams.map(members => resolveTeam(universe, members));

    if (resolvedTeams.some(t => !t)) {
      const failed = teams.filter((_, i) => !resolvedTeams[i]);
      console.warn("Tag team not resolved:", failed);
      return universe;
    }

    // Update Elo — resolvedTeams[0] is winner
    updateMultiTeamElo(resolvedTeams, isPPV);

    resolvedTeams[0].wins++;
    resolvedTeams.slice(1).forEach(t => t.losses++);

    // Build clean match string with freebird notes where needed
    const labeledSides = teams.map((members, i) => {
      const resolved = resolvedTeams[i];
      const note = members.every(m => resolved.members.includes(m)) ? "" : ` (${resolved.name})`;
      return `${members.join(" & ")}${note}`;
    });
    const cleanMatch = `${labeledSides.join(" vs ")} | ${parsed.datePart}${ppvTag}`;

    // Record on each team
    resolvedTeams.forEach((team, i) => {
      const result = i === 0 ? "WIN" : "LOSS";
      team.matchHistory.unshift(safeMatchHistoryEntry(result, cleanMatch, timestamp));
    });

    universe.lastWeekMatches.push(cleanMatch);

    // Record on each individual wrestler
    teams.forEach((members, teamIndex) => {
      const result = teamIndex === 0 ? "WIN" : "LOSS";
      members.forEach(name => {
        const p = getPlayer(universe, name);
        if (!p) return;
        p.matchHistory.unshift(safeMatchHistoryEntry(result, cleanMatch, timestamp));
      });
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

    updateMultimanElo(universe, names, winner, isPPV);
    universe.lastWeekMatches.push(matchStr);
    return universe;
  }

  // ── SINGLES ─────────────────────────────────────────────
  if (parsed.matchType === "Singles") {
    const [p1, p2] = parsed.names;
    const A = getPlayer(universe, p1);
    const B = getPlayer(universe, p2);
    if (!A || !B) return universe;

    updateSinglesElo(A, B, p1, isPPV);
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
  universe.players.forEach(p => {
    p.division = p.elo >= 1500 ? "Div 1" : "Div 2";
  });

  universe.players.sort((a, b) => b.elo - a.elo);
  universe.players.forEach((p, i) => (p.rank = i + 1));

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
  "ManulTheCat vs WheatSeedGuy vs Cardraul vs Deadlee vs Hro79 | 2026-06-27 (PPV)",
  "WilliamIsTed vs TaysTales vs Nans vs Madeline | 2026-06-27 (PPV)",
  "RawrImHere vs Offron vs TollerTornado vs Gamerat60 | 2026-06-27 (PPV)",
  "Jimmytvf vs Ravroid vs Paulg8 vs Balderoni vs RoofDog vs CannibalJeebus | 2026-06-27 (PPV)",
  "Dinsdale vs MininumWageWorker vs Pigmanman vs RebelMime vs HeyyaNito vs MuraWisteria | 2026-06-27 (PPV)",
  "Ginauz & Kaden vs CrowBird & Lilith vs JJ & Slug | 2026-06-27 (PPV)",
  "Slug vs MuddyB3 vs JeromeySchweemey vs PottiePots vs RagGhee vs Shartstarion | 2026-06-27 (PPV)",
  "Narky vs MiniMoth10 vs HerrKrokodil vs PilleVipp vs BloodiestCorpse vs TheBobbyV | 2026-06-27 (PPV)",

];

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
JJ, Nans, RoofDog, ManulTheCat, MiniMoth10, WheatSeedGuy, JeromeySchweemey, Gamerat60

TAG TEAMS:
  id=1  The Dirty Ducks    [TheBobbyV, MuddyB3]
  id=2  The Hex Girls      [Lilith, CrowBird]
  id=3  Rogue Hog          [JJ, Slug]
  id=4  Fork Knife         [Kaden, Ginauz]
  id=5  Loose Losers       [CannibalJeebus, Offron]
  id=6  TnT                [TaysTales, TollerTornado]

FACTIONS (freebird eligible):
  Fork Knife      -> members: Kaden, Ginauz, Nans              -> team id=4
  The Dirty Ducks -> members: TheBobbyV, RagGhee, MuddyB3      -> team id=1
  Loose Losers    -> members: CannibalJeebus, WilliamIsTed, Offron -> team id=5
  The Hex Girls   -> members: CrowBird, Lilith, Slug, JJ        -> team id=2,3

ELO MULTIPLIERS:
  Tag 2-way:  winner x1.0,  losers x1.0
  Tag 3-way:  winner x1.25, losers x0.65
  Tag 4-way:  winner x1.5,  losers x0.5
  PPV:        K bumped from 28->42 (tag) / 32->48 (singles/multi)

MATCH FORMAT EXAMPLES:
  Standard:     "A vs B | YYYY-MM-DD"
  Tag 2-way:    "A & B vs C & D | YYYY-MM-DD"
  Tag 3-way:    "A & B vs C & D vs E & F | YYYY-MM-DD"
  Tag 4-way:    "A & B vs C & D vs E & F vs G & H | YYYY-MM-DD"
  PPV:          "A vs B | YYYY-MM-DD (PPV)"
  PPV tag:      "A & B vs C & D vs E & F | YYYY-MM-DD (PPV)"
**/
 