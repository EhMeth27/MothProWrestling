fetch("universe.json")
  .then(res => res.json())
  .then(data => {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get("id"));

    const team = data.tagTeams.find(t => t.id === id);
    if (!team) return;

    document.getElementById("team-name").textContent = team.name;

    // Members
    document.getElementById("team-members").innerHTML =
      `<strong>Members:</strong> ` +
      team.members
        .map(m => `<a href="wrestler.html?name=${encodeURIComponent(m)}">${m}</a>`)
        .join(", ");

    // ELO
    document.getElementById("team-elo").textContent =
      `Team ELO: ${team.elo}`;

    // Record
    document.getElementById("team-record").textContent =
      `Record: ${team.wins}-${team.losses}`;

    // Titles
    const titles = (data.championships || []).filter(c => c.holder === team.name);
    document.getElementById("team-titles").textContent =
      titles.length ? `Titles: ${titles.map(t => t.name).join(", ")}` : "Titles: None";

    // Match History
    const matchesEl = document.getElementById("team-matches");
    matchesEl.innerHTML = "";

    team.matchHistory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .forEach(m => {
        const li = document.createElement("li");
        const date = new Date(m.timestamp).toLocaleDateString();

        li.innerHTML = `
          <strong>${m.result}</strong>: ${m.match}
          <span style="opacity:0.7;">(${date})</span>
        `;

        matchesEl.appendChild(li);
      });
  });
