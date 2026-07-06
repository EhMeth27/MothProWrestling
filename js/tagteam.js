// Strip (PPV) and freebird notes like "(Fork Knife)" for parsing
function cleanForParsing(str) {
  return str.replace(/\(PPV\)/gi, "").replace(/\([^)]*\)/g, "").trim();
}

loadUniverse(data => {
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("id"));

  const team = (data.tagTeams || []).find(t => t.id === id);
  if (!team) {
    document.getElementById("team-name").textContent = "Tag Team Not Found";
    return;
  }

  // --- Team name ---
  document.getElementById("team-name").textContent = team.name;

  // --- Member photos ---
  const photosEl = document.getElementById("team-photos");
  team.members.forEach(memberName => {
    const player = data.players.find(p => p.name === memberName);
    const wrap = document.createElement("div");
    wrap.className = "wrestler-photo-wrap";

    const img = document.createElement("img");
    img.className = "team-member-photo";
    img.src = player?.photo || "images/default.png";
    img.alt = memberName;
    img.onerror = () => { img.src = "images/default.png"; };

    wrap.appendChild(img);
    photosEl.appendChild(wrap);
  });

  // --- Members with links ---
  document.getElementById("team-members").innerHTML =
    "Members: " +
    team.members
      .map(m => `<a href="wrestler.html?name=${encodeURIComponent(m)}">${m}</a>`)
      .join(" &amp; ");

  // --- Record ---
  document.getElementById("team-record").textContent =
    `Record: ${team.wins}-${team.losses}`;

  // --- Elo with change ---
  const eloDiff = team.lastElo !== undefined ? team.elo - team.lastElo : null;
  let eloChangeHtml = "";
  if (eloDiff !== null) {
    if (eloDiff > 0)      eloChangeHtml = ` <span style="color:#2ecc71;font-weight:bold;">+${eloDiff}</span>`;
    else if (eloDiff < 0) eloChangeHtml = ` <span style="color:#e74c3c;font-weight:bold;">${eloDiff}</span>`;
    else                  eloChangeHtml = ` <span style="color:#888;">±0</span>`;
  }
  document.getElementById("team-elo").innerHTML = `Elo Rating: ${team.elo}${eloChangeHtml}`;

  // --- Titles (singles or tag) ---
  const titles = (data.championships || []).filter(c => c.holder === team.name);
  document.getElementById("team-titles").textContent = titles.length
    ? `Current Championships: ${titles.map(t => t.name).join(", ")}`
    : "Current Championships: None";

  // --- Overview ---
  document.getElementById("team-overview").textContent =
    `${team.name} is a tag team consisting of ${team.members.join(" and ")}. ` +
    `They hold a record of ${team.wins}-${team.losses} with an Elo of ${team.elo}.`;

  // --- Career stats ---
  const statsEl = document.getElementById("team-career-stats");
  const history = team.matchHistory || [];

  if (history.length > 0) {
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const wins     = sorted.filter(m => m.result === "WIN").length;
    const losses   = sorted.length - wins;
    const ppvWins  = sorted.filter(m => m.result === "WIN" && m.match.includes("(PPV)")).length;

    let tempWin = 0, tempLoss = 0, longestWin = 0, longestLoss = 0;
    sorted.forEach(m => {
      if (m.result === "WIN") {
        tempWin++; tempLoss = 0;
        if (tempWin > longestWin) longestWin = tempWin;
      } else {
        tempLoss++; tempWin = 0;
        if (tempLoss > longestLoss) longestLoss = tempLoss;
      }
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

  // --- Match history (most recent 20) ---
  const matchesEl = document.getElementById("team-matches");
  matchesEl.innerHTML = "";

  if (history.length === 0) {
    matchesEl.innerHTML = "<li>No recorded matches yet.</li>";
  } else {
    [...history]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .forEach(m => {
        const li = document.createElement("li");
        const date = new Date(m.timestamp).toLocaleDateString();
        const resultColor = m.result === "WIN" ? "limegreen" : "crimson";
        const isPPV = m.match.includes("(PPV)");
        const ppvBadge = isPPV
          ? ' <span style="color:gold;font-size:0.85em;">[PPV]</span>'
          : "";

        // Parse opponent side — strip meta notes first
        const cleaned = cleanForParsing(m.match);
        const beforeDate = cleaned.split("|")[0].trim();
        const sides = beforeDate.split(" vs ").map(s => s.trim()).filter(Boolean);

        // Opponent = any side that doesn't contain this team's members
        const opponentSides = sides.filter(side =>
          !team.members.some(mem => side.includes(mem))
        );
        const opponent = opponentSides.join(" vs ") || "Unknown";

        li.innerHTML = `
          <span style="color:${resultColor}; font-weight:bold;">${m.result}</span>${ppvBadge}
          vs ${opponent}
          <span style="opacity:0.7;">(${date})</span>
        `;
        matchesEl.appendChild(li);
      });
  }

  // --- Highlights ---
  document.getElementById("team-highlights").innerHTML =
    `<li>Debut season – making waves in the tag team division.</li>`;
});
