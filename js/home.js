function createMatchCard(matchString, data, glowWinners = false) {

  function extractNames(matchString) {
    // Grab the part before the date or finish tag
    const beforeMeta = matchString.split("|")[1] && matchString.includes("MatchType")
      ? matchString.split("|")[1].trim() // MatchType format
      : matchString.split("|")[0].trim(); // Standard format

    // Extract all names separated by "vs"
    return beforeMeta.split("vs").map(n => n.trim()).filter(n => n.length > 0);
  }

  const names = extractNames(matchString);

  // Winner is always the first name
  const winnerName = names[0];

  // Randomize display order
  const shuffled = [...names];
  if (Math.random() < 0.5) shuffled.reverse();

  const container = document.createElement("div");
  container.className = "match-card";

  shuffled.forEach((name, index) => {
    const wrestler = data.players.find(p => p.name === name);

    const img = document.createElement("img");
    img.src = wrestler?.photo || "images/default.png";
    img.alt = name;

    const link = document.createElement("a");
    link.href = `wrestler.html?name=${encodeURIComponent(name)}`;
    link.appendChild(img);

    if (glowWinners && name === winnerName) {
      link.classList.add("winner-glow");
    }

    container.appendChild(link);

    if (index < shuffled.length - 1) {
      const vs = document.createElement("span");
      vs.className = "vs-text";
      vs.textContent = "VS";
      container.appendChild(vs);
    }
  });

  return container;
}


loadUniverse(data => {
  const lastWeek = document.getElementById("last-week");
  const upcoming = document.getElementById("upcoming");

  // LAST WEEK — glow ON
  (data.lastWeekMatches || []).forEach(m => {
    lastWeek.appendChild(createMatchCard(m, data, true));
  });

  // UPCOMING — glow OFF
  (data.weeklyCard || []).forEach(m => {
    upcoming.appendChild(createMatchCard(m, data, false));
  });
});
