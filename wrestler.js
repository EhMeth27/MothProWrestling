// Load universe.json
fetch("universe.json")
  .then(res => res.json())
  .then(universe => {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get("id"));

    const player = universe.players.find(p => p.id === id);

    if (!player) {
      document.querySelector(".wrestler-profile-page").innerHTML =
        "<h2>Wrestler not found.</h2>";
      return;
    }

    renderWrestler(player, universe);
  });

// Render wrestler profile
function renderWrestler(player, universe) {
  // Basic info
  document.getElementById("wrestler-photo").src = player.photo;
  document.getElementById("wrestler-name").textContent = player.name;

  // Division + Rank
document.getElementById("wrestler-division-rank").textContent =
  `${player.division} • Div Rank #${player.divisionRank} • Global Rank #${player.rank}`;

	// Tag Teams Section
	const teams = data.tagTeams.filter(t => t.members.includes(wrestler.name));

	const teamList = document.getElementById("wrestler-teams");

	if (teams.length === 0) {
	  teamList.innerHTML = "<li>No tag teams.</li>";
	} else {
	  teamList.innerHTML = teams
		.map(t => `
		  <li>
			<a href="tagteam.html?id=${t.id}">${t.name}</a>
			— ELO: ${t.elo}
		  </li>
		`)
		.join("");
	}

  // Record
  document.getElementById("wrestler-record").textContent =
    `Record: ${player.wins} - ${player.losses}`;

  // ELO
  document.getElementById("wrestler-elo").textContent =
    `ELO: ${player.elo}`;

  // Titles (if any)
  const titles = universe.championships
    .filter(c => c.holder === player.name)
    .map(c => c.name);

  document.getElementById("wrestler-titles").textContent =
    titles.length > 0 ? `Titles: ${titles.join(", ")}` : "Titles: None";

  // Overview / Bio
  document.getElementById("wrestler-overview").textContent =
    player.bio || "Bio coming soon.";

  // Highlights
  renderHighlights(player);

  // Match History
  renderMatchHistory(player);
}

// Render match history
	function renderMatchHistory(player) {
  const container = document.getElementById("wrestler-matches");
  container.innerHTML = "";

  if (!player.matchHistory || player.matchHistory.length === 0) {
    container.innerHTML = "<li>No recorded matches yet.</li>";
    return;
  }

  player.matchHistory.slice(0, 20).forEach(entry => {
    const li = document.createElement("li");

    // Extract the part before the date
    const beforeDate = entry.match.split("|")[0].trim();

    // Extract all names in the match
    const names = beforeDate.split("vs").map(n => n.trim());

    // Remove the current wrestler to get all opponents
    const opponents = names.filter(n => n !== player.name);

    // Format opponents list
    const opponentText = opponents.join(", ");

    // Extract date
    const date = entry.match.includes("|")
      ? entry.match.split("|")[1].trim()
      : "";

    // Display
    li.textContent = `${entry.result}: vs ${opponentText} (${date})`;
    li.style.color = entry.result === "WIN" ? "limegreen" : "crimson";

    container.appendChild(li);
  });
}

	<li>
    <a href="tagteam.html?id=${t.id}">${t.name}</a>
    <span style="color:#0af; font-weight:bold;">(${t.elo})</span>
	</li>


// Render highlights
function renderHighlights(player) {
  const container = document.getElementById("wrestler-highlights");
  container.innerHTML = "";

  if (!player.highlights || player.highlights.length === 0) {
    container.innerHTML = "<li>No highlights yet.</li>";
    return;
  }

  player.highlights.forEach(h => {
    const li = document.createElement("li");
    li.textContent = h;
    container.appendChild(li);
  });
}
