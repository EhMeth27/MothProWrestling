loadUniverse(data => {
  const params = new URLSearchParams(window.location.search);
  const nameParam = params.get('name');
  if (!nameParam) return;

  const wrestler = data.players.find(p => p.name === decodeURIComponent(nameParam));
  if (!wrestler) return;

  document.getElementById('wrestler-photo').src = wrestler.photo || "images/default.png";
  document.getElementById('wrestler-name').textContent = wrestler.name;
  document.getElementById('wrestler-division-rank').textContent =
    `Division: ${wrestler.division} • Division Rank: ${wrestler.divisionRank}`;
  document.getElementById('wrestler-record').textContent =
    `Record: ${wrestler.wins}-${wrestler.losses}`;
  document.getElementById('wrestler-elo').textContent =
    `Elo Rating: ${wrestler.elo}`;

  // Titles
  const titlesEl = document.getElementById('wrestler-titles');
  const heldTitles = (data.championships || []).filter(c => c.holder === wrestler.name);
  titlesEl.textContent = heldTitles.length
    ? `Current Championships: ${heldTitles.map(t => t.name).join(', ')}`
    : "Current Championships: None";

  // Overview
  document.getElementById('wrestler-overview').textContent =
    `${wrestler.name} competes in ${wrestler.division} and is currently ranked #${wrestler.divisionRank}.`;

// Match history (last 5)
const matchesEl = document.getElementById('wrestler-matches');
matchesEl.innerHTML = '';

if (wrestler.matchHistory && wrestler.matchHistory.length > 0) {
  wrestler.matchHistory
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5)
    .forEach(m => {
      const li = document.createElement('li');

      // Color result
      const resultColor = m.result === "WIN" ? "green" : "red";

      // Extract opponent name from ANY match format
		let opponent = "Unknown";
		let names = [];

		// FORMAT B: "MatchType: Singles | A vs B | Finish: TBD"
		if (m.match.includes("|")) {
		  const parts = m.match.split("|").map(p => p.trim());
		  const vsPart = parts.find(p => p.includes("vs"));
		  if (vsPart) {
			names = vsPart.split("vs").map(n => n.trim());
		  }
		}

		// FORMAT A: "Singles: A vs B"
		else if (m.match.includes(":") && m.match.includes("vs")) {
		  const afterColon = m.match.split(":")[1];
		  names = afterColon.split("vs").map(n => n.trim());
		}

		// Determine opponent based on THIS wrestler
		if (names.length === 2) {
		  opponent = names[0] === wrestler.name ? names[1] : names[0];
		}


      const date = new Date(m.timestamp).toLocaleDateString();

      li.innerHTML = `
        <span style="color:${resultColor}; font-weight:bold;">${m.result}</span>:
        <a href="wrestler.html?name=${encodeURIComponent(opponent)}">${opponent}</a>
        <span style="opacity:0.7;">(${date})</span>
      `;

      matchesEl.appendChild(li);
    });
} else {
  matchesEl.innerHTML = `<li>No matches recorded yet.</li>`;
}

// Career stats
const statsEl = document.getElementById('wrestler-career-stats');

if (wrestler.matchHistory && wrestler.matchHistory.length > 0) {
  const matches = wrestler.matchHistory.sort((a, b) => a.timestamp - b.timestamp);

  let total = matches.length;
  let wins = matches.filter(m => m.result === "WIN").length;
  let losses = total - wins;

  // Streaks
  let currentStreak = 0;
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWin = 0;
  let tempLoss = 0;

  matches.forEach(m => {
    if (m.result === "WIN") {
      tempWin++;
      tempLoss = 0;
      if (tempWin > longestWinStreak) longestWinStreak = tempWin;
    } else {
      tempLoss++;
      tempWin = 0;
      if (tempLoss > longestLossStreak) longestLossStreak = tempLoss;
    }
  });

  // Current streak (based on last match)
  const last = matches[matches.length - 1];
  if (last.result === "WIN") {
    currentStreak = tempWin;
  } else {
    currentStreak = -tempLoss; // negative means losing streak
  }

  const streakText =
    currentStreak > 0 ? `W${currentStreak}` :
    currentStreak < 0 ? `L${Math.abs(currentStreak)}` :
    "None";

  statsEl.innerHTML = `
    <strong>Career Stats:</strong><br>
    Total Matches: ${total}<br>
    Wins: ${wins}<br>
    Losses: ${losses}<br>
    Current Streak: ${streakText}<br>
    Longest Win Streak: ${longestWinStreak}<br>
    Longest Losing Streak: ${longestLossStreak}
  `;
} else {
  statsEl.textContent = "Career Stats: No matches yet.";
}


  // Highlights placeholder
  document.getElementById('wrestler-highlights').innerHTML =
    `<li>Debut season – poised to make an impact.</li>`;
});
