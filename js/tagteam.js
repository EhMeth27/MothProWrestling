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
    img.id = "wrestler-photo"; // reuse profile photo style
    img.src = player?.photo || "images/default.png";
    img.alt = memberName;
    img.onerror = () => { img.src = "images/default.png"; };

    wrap.appendChild(img);
    photosEl.appendChild(wrap);
  });

  // --- Members list with links ---
  document.getElementById("team-members").innerHTML =
    "Members: " +
    team.members
      .map(m => `<a href="wrestler.html?name=${encodeURIComponent(m)}">${m}</a>`)
      .join(" &amp; ");

  // --- Record ---
  document.getElementById("team-record").textContent =
    `Record: ${team.wins}-${team.losses}`;

  // --- ELO with change ---
  const eloDiff = team.lastElo !== undefined ? team.elo - team.lastElo : null;
  let eloChangeHtml = "";
  if (eloDiff !== null) {
    if (eloDiff > 0)      eloChangeHtml = ` <span style="color:#2ecc71;font-weight:bold;">+${eloDiff}</span>`;
    else if (eloDiff < 0) eloChangeHtml = ` <span style="color:#e74c3c;font-weight:bold;">${eloDiff}</span>`;
    else                  eloChangeHtml = ` <span style="color:#888;">±0</span>`;
  }
  document.getElementById("team-elo").innerHTML = `Elo Rating: ${team.elo}${eloChangeHtml}`;

  // --- Titles ---
  const titles = (data.championships || []).filter(c => c.holder === team.name);
  document.getElementById("team-titles").textContent = titles.length
    ? `Current Championships: ${titles.map(t => t.name).join(", ")}`
    : "Current Championships: None";

  // --- Overview ---
  document.getElementById("team-overview").textContent =
    `${team.name} is a tag team consisting of ${team.members.join(" and ")}. ` +
    `They hold a record of ${team.wins}-${team.losses} with an Elo of ${team.elo}. Their story in this universe is just beginning.`;

  // --- Career stats ---
  const statsEl = document.getElementById("team-career-stats");
  const history = team.matchHistory || [];

  if (history.length > 0) {
    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const wins = sorted.filter(m => m.result === "WIN").length;
    const losses = sorted.length - wins;

    let tempWin = 0, tempLoss = 0;
    let longestWin = 0, longestLoss = 0;
    sorted.forEach(m => {
      if (m.result === "WIN") { tempWin++; tempLoss = 0; if (tempWin > longestWin) longestWin = tempWin; }
      else                    { tempLoss++; tempWin = 0; if (tempLoss > longestLoss) longestLoss = tempLoss; }
    });

    const last = sorted[sorted.length - 1];
    const currentStreak = last.result === "WIN" ? `W${tempWin}` : `L${tempLoss}`;

    statsEl.innerHTML = `
      <strong>Career Stats:</strong><br>
      Total Matches: ${sorted.length}<br>
      Wins: ${wins} | Losses: ${losses}<br>
      Current Streak: ${currentStreak}<br>
      Longest Win Streak: ${longestWin}<br>
      Longest Losing Streak: ${longestLoss}
    `;
  } else {
    statsEl.textContent = "Career Stats: No matches yet.";
  }

  // --- Match history list ---
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

        // Extract the opponent from the match string
        // Format: "TeamA & TeamB vs TeamC & TeamD | date"
        const beforeDate = m.match.split("|")[0].trim();
        const sides = beforeDate.split(" vs ").map(s => s.trim());
        const memberStr = team.members.join(" & ");
        const opponent = sides.find(s => !team.members.some(mem => s.includes(mem))) || "Unknown";

        li.innerHTML = `
          <span style="color:${resultColor}; font-weight:bold;">${m.result}</span>
          vs ${opponent}
          <span style="opacity:0.7;">(${date})</span>
        `;
        matchesEl.appendChild(li);
      });
  }

  // --- Highlights placeholder ---
  document.getElementById("team-highlights").innerHTML =
    `<li>Debut season – making waves in the tag team division.</li>`;
});
