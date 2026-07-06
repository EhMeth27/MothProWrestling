// Strip (PPV) and freebird notes like "(Fork Knife)" from match strings for parsing
function cleanForParsing(str) {
  return str.replace(/\(PPV\)/gi, "").replace(/\([^)]*\)/g, "").trim();
}

// Extract all opponent names from a match string for a given wrestler
function extractOpponents(matchStr, wrestlerName) {
  const cleaned = cleanForParsing(matchStr);
  const beforeDate = cleaned.split("|")[0].trim();

  // Split on " vs " to get all sides
  const sides = beforeDate.split(" vs ").map(s => s.trim()).filter(Boolean);

  // Expand & groups into individual names
  const allNames = [];
  sides.forEach(side => {
    side.split("&").forEach(n => {
      const name = n.trim();
      if (name) allNames.push(name);
    });
  });

  // Return everyone except this wrestler
  return allNames.filter(n => n !== wrestlerName);
}

// Format a match entry for display in the match history list
function formatMatchEntry(m, wrestler) {
  const isPPV = m.match.includes("(PPV)");
  const resultColor = m.result === "WIN" ? "limegreen" : "crimson";
  const date = new Date(m.timestamp).toLocaleDateString();
  const ppvBadge = isPPV ? ' <span style="color:gold;font-size:0.8em;">[PPV]</span>' : "";

  const opponents = extractOpponents(m.match, wrestler.name);

  const opponentLinks = opponents.length > 0
    ? opponents.map(n =>
        `<a href="wrestler.html?name=${encodeURIComponent(n)}">${n}</a>`
      ).join(", ")
    : "Unknown";

  return `
    <span style="color:${resultColor}; font-weight:bold;">${m.result}</span>${ppvBadge}
    vs ${opponentLinks}
    <span style="opacity:0.7;">(${date})</span>
  `;
}

loadUniverse(data => {
  const params = new URLSearchParams(window.location.search);
  const nameParam = params.get('name');
  if (!nameParam) return;

  const wrestler = data.players.find(p => p.name === decodeURIComponent(nameParam));
  if (!wrestler) {
    document.getElementById('wrestler-name').textContent = "Wrestler Not Found";
    return;
  }

  // --- Core info ---
  const photoEl = document.getElementById('wrestler-photo');
  photoEl.src = wrestler.photo || "images/default.png";
  photoEl.onerror = () => { photoEl.src = "images/default.png"; };

  document.getElementById('wrestler-name').textContent = wrestler.name;
  document.getElementById('wrestler-division-rank').textContent =
    `Division: ${wrestler.division} • Division Rank: #${wrestler.divisionRank} • Global Rank: #${wrestler.rank}`;
  document.getElementById('wrestler-record').textContent =
    `Record: ${wrestler.wins}-${wrestler.losses}`;
  document.getElementById('wrestler-elo').textContent =
    `Elo Rating: ${wrestler.elo}`;

  // --- Titles ---
  const titlesEl = document.getElementById('wrestler-titles');
  const heldTitles = (data.championships || []).filter(c => c.holder === wrestler.name);
  titlesEl.textContent = heldTitles.length
    ? `Current Championships: ${heldTitles.map(t => t.name).join(', ')}`
    : "Current Championships: None";

  // --- Tag Teams ---
  const myTeams = (data.tagTeams || []).filter(t => t.members.includes(wrestler.name));
  const teamSection = document.getElementById('tag-team-section');
  if (myTeams.length > 0 && teamSection) {
    teamSection.style.display = 'block';
    document.getElementById('wrestler-teams').innerHTML = myTeams.map(t => `
      <li>
        <a href="tagteam.html?id=${t.id}">${t.name}</a>
        — Elo: ${t.elo} | Record: ${t.wins}-${t.losses}
      </li>
    `).join('');
  }

  // --- Faction ---
  const myFaction = (data.factions || []).find(f => f.members.includes(wrestler.name));
  const factionSection = document.getElementById('faction-section');
  if (myFaction && factionSection) {
    factionSection.style.display = 'block';
    const otherMembers = myFaction.members
      .filter(m => m !== wrestler.name)
      .map(m => `<a href="wrestler.html?name=${encodeURIComponent(m)}">${m}</a>`)
      .join(', ');
    document.getElementById('wrestler-faction').innerHTML =
      `<strong>${myFaction.name}</strong> — alongside ${otherMembers}`;
  }

  // --- Overview ---
  document.getElementById('wrestler-overview').textContent =
    `${wrestler.name} competes in ${wrestler.division} and is currently ranked #${wrestler.divisionRank} with an Elo of ${wrestler.elo}.`;

  // --- Match history (last 5) ---
  const matchesEl = document.getElementById('wrestler-matches');
  matchesEl.innerHTML = '';

  if (wrestler.matchHistory && wrestler.matchHistory.length > 0) {
    [...wrestler.matchHistory]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5)
      .forEach(m => {
        const li = document.createElement('li');
        li.innerHTML = formatMatchEntry(m, wrestler);
        matchesEl.appendChild(li);
      });
  } else {
    matchesEl.innerHTML = `<li>No matches recorded yet.</li>`;
  }

  // --- Career stats ---
  const statsEl = document.getElementById('wrestler-career-stats');
  if (wrestler.matchHistory && wrestler.matchHistory.length > 0) {
    const sorted = [...wrestler.matchHistory].sort((a, b) => a.timestamp - b.timestamp);
    const wins   = sorted.filter(m => m.result === "WIN").length;
    const losses = sorted.length - wins;
    const ppvWins = sorted.filter(m => m.result === "WIN" && m.match.includes("(PPV)")).length;

    let tempWin = 0, tempLoss = 0, longestWin = 0, longestLoss = 0;
    sorted.forEach(m => {
      if (m.result === "WIN") { tempWin++; tempLoss = 0; if (tempWin > longestWin) longestWin = tempWin; }
      else                    { tempLoss++; tempWin = 0; if (tempLoss > longestLoss) longestLoss = tempLoss; }
    });

    const last = sorted[sorted.length - 1];
    const streakText = last.result === "WIN" ? `W${tempWin}` : `L${tempLoss}`;

    statsEl.innerHTML = `
      <strong>Career Stats:</strong><br>
      Total Matches: ${sorted.length} |
      Wins: ${wins} | Losses: ${losses}<br>
      PPV Wins: ${ppvWins}<br>
      Current Streak: ${streakText} |
      Longest Win Streak: ${longestWin} |
      Longest Losing Streak: ${longestLoss}
    `;
  } else {
    statsEl.textContent = "Career Stats: No matches yet.";
  }

  // --- Highlights ---
  const highlightsEl = document.getElementById('wrestler-highlights');
  if (wrestler.highlights && wrestler.highlights.length > 0) {
    highlightsEl.innerHTML = wrestler.highlights.map(h => `<li>${h}</li>`).join('');
  } else {
    highlightsEl.innerHTML = `<li>Debut season – poised to make an impact.</li>`;
  }
});
