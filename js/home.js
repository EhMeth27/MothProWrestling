function createMatchCard(matchString, data, glowWinners = false) {
  let names = [];

  // FORMAT B: "MatchType: Singles | A vs B | Finish: TBD"
  if (matchString.includes("|")) {
    const parts = matchString.split("|").map(p => p.trim());
    const vsPart = parts.find(p => p.includes("vs"));
    names = vsPart.split("vs").map(n => n.trim());
  }

  // FORMAT A: "Singles: A vs B"
  else {
    names = matchString
      .replace("(PPV)", "")
      .split(":")[1]
      .split("vs")
      .map(n => n.trim());
  }

  const winnerName = names[0];

  // Randomize order
  if (Math.random() < 0.5) {
    names.reverse();
  }

  const container = document.createElement("div");
  container.className = "match-card";

  names.forEach((name, index) => {
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

    if (index < names.length - 1) {
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


