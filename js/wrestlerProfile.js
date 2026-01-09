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

      // Extract opponent name from "Singles: A vs B"
      let opponent = "Unknown";
      const parts = m.match.split(" vs ");
      if (parts.length === 2) {
        opponent = parts[0].includes(wrestler.name) ? parts[1] : parts[0];
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



  // Highlights placeholder
  document.getElementById('wrestler-highlights').innerHTML =
    `<li>Debut season – poised to make an impact.</li>`;
});
