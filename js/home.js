// Parse a match string into sides, each being an array of player names.
// "A vs B | date"           → [["A"], ["B"]]
// "A & B vs C & D | date"  → [["A","B"], ["C","D"]]
// "A vs B vs C | date"     → [["A"], ["B"], ["C"]]
function parseSides(matchString) {
  const beforeMeta = matchString.split("|")[0].trim();
  const sides = beforeMeta.split(" vs ").map(s => s.trim()).filter(Boolean);

  if (sides.length === 2) {
    // Singles or tag team — expand & groups
    return sides.map(side =>
      side.split("&").map(n => n.trim()).filter(Boolean)
    );
  }

  // Multiman — each name is its own side
  return sides.map(name => [name.trim()]);
}

// Return ALL names on the winning side (first side in the string).
// Singles: ["Kaden"]   Tag team: ["Kaden", "Ginauz"]
function extractWinningSide(matchString) {
  const beforeMeta = matchString.split("|")[0].trim();
  const firstSide = beforeMeta.split(" vs ")[0].trim();
  return firstSide.split("&").map(n => n.trim()).filter(Boolean);
}

// Build the photo group for one side of a match
function buildSideEl(names, data, glowWinners, winningSide) {
  const wrap = document.createElement("div");
  wrap.className = "match-side";

  names.forEach(name => {
    const wrestler = data.players.find(p => p.name === name);

    const img = document.createElement("img");
    img.src = wrestler?.photo || "images/default.png";
    img.alt = name;
    img.onerror = () => { img.src = "images/default.png"; };

    const link = document.createElement("a");
    link.href = `wrestler.html?name=${encodeURIComponent(name)}`;
    link.title = name;
    link.appendChild(img);

    // Glow every member of the winning side
    if (glowWinners && winningSide.includes(name)) {
      link.classList.add("winner-glow");
    }

    wrap.appendChild(link);
  });

  return wrap;
}

function createMatchCard(matchString, data, glowWinners = false) {
  const sides = parseSides(matchString);
  const winningSide = extractWinningSide(matchString);

  // Multiman: randomize display order; 2-sided: keep as-is
  const isMultiman = sides.length > 2;
  const displaySides = isMultiman ? [...sides].sort(() => Math.random() - 0.5) : sides;

  const container = document.createElement("div");
  container.className = "match-card";

  displaySides.forEach((sidePlayers, index) => {
    container.appendChild(buildSideEl(sidePlayers, data, glowWinners, winningSide));

    if (index < displaySides.length - 1) {
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
  const newsEl = document.getElementById("news");

  if (lastWeek) {
    (data.lastWeekMatches || []).forEach(m => {
      lastWeek.appendChild(createMatchCard(m, data, true));
    });
  }

  if (upcoming) {
    (data.weeklyCard || []).forEach(m => {
      upcoming.appendChild(createMatchCard(m, data, false));
    });
  }

  if (newsEl) {
    (data.news || []).forEach(n => {
      const li = document.createElement("li");
      li.textContent = n;
      newsEl.appendChild(li);
    });
  }
});
