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

  // --- Tag Teams (only show section if they're on a team) ---
  const myTeams = (data.tagTeams || []).filter(t => t.members.includes(wrestler.name));
  if (myTeams.length > 0) {
    document.getElementById('tag-team-section').style.display = 'block';
    document.getElementById('wrestler-teams').innerHTML = myTeams.map(t => `
      <li>
        <a href="tagteam.html?id=${t.id}">${t.name}</a>
        — Elo: ${t.elo} | Record: ${t.wins}-${t.losses}
      </li>
    `).join('');
  }

  // --- Faction (only show section if they're in one) ---
  const myFaction = (data.factions || []).find(f => f.members.includes(wrestler.name));
  if (myFaction) {
    document.getElementById('faction-section').style.display = 'block';
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
        const resultColor = m.result === "WIN" ? "limegreen" : "crimson";

        // Parse opponent(s) — works for singles AND multi-man
        const beforeDate = m.match.split("|")[0].trim();
        let vsPart = beforeDate.includes(":") ? beforeDate.split(":")[1].trim() : beforeDate;
        const allNames = vsPart.split(" vs ").map(n => n.trim()).filter(Boolean);
        const opponents = allNames.filter(n => n !== wrestler.name);
        const opponentLinks = opponents.map(n =>
          `<a href="wrestler.html?name=${encodeURIComponent(n)}">${n}</a>`
        ).join(', ');

        const date = new Date(m.timestamp).toLocaleDateString();

        li.innerHTML = `
          <span style="color:${resultColor}; font-weight:bold;">${m.result}</span>
          vs ${opponentLinks}
          <span style="opacity:0.7;">(${date})</span>
        `;
        matchesEl.appendChild(li);
      });
  } else {
    matchesEl.innerHTML = `<li>No matches recorded yet.</li>`;
  }

  // --- Career stats ---
  const statsEl = document.getElementById('wrestler-career-stats');
  if (wrestler.matchHistory && wrestler.matchHistory.length > 0) {
    const sorted = [...wrestler.matchHistory].sort((a, b) => a.timestamp - b.timestamp);
    const wins = sorted.filter(m => m.result === "WIN").length;
    const losses = sorted.length - wins;

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
      Current Streak: ${streakText} |
      Longest Win Streak: ${longestWin} |
      Longest Losing Streak: ${longestLoss}
    `;
  } else {
    statsEl.textContent = "Career Stats: No matches yet.";
  }

  // --- Highlights ---
  const highlightsEl = document.getElementById('wrestler-highlights');
  if (wrestler.highlights && wrestler.highlights.length > 0 && wrestler.highlights[0] !== "Career highlights coming soon.") {
    highlightsEl.innerHTML = wrestler.highlights.map(h => `<li>${h}</li>`).join('');
  } else {
    highlightsEl.innerHTML = `<li>Debut season – poised to make an impact.</li>`;
  }
});
