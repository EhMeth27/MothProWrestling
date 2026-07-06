loadUniverse(data => {
  const tbody = document.querySelector("#tagteam-table tbody");
  tbody.innerHTML = "";

  if (!data.tagTeams || data.tagTeams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No tag teams found.</td></tr>`;
    return;
  }

  // Find tag team title holders
  const tagTitles = (data.championships || []).filter(c => c.type === 'tag');

  const teams = [...data.tagTeams].sort((a, b) => b.elo - a.elo);

  teams.forEach((team, i) => {
    const tr = document.createElement("tr");

    // Check if this team holds any titles
    const heldTitles = tagTitles.filter(c => c.holder === team.name);
    const isChamp = heldTitles.length > 0;

    if (isChamp) {
      tr.style.border = "2px solid gold";
      tr.style.boxShadow = "0 0 8px rgba(255,215,0,0.4)";
    }

    const titleBadge = heldTitles.map(t =>
      `<span style="color:gold;font-size:0.8em;font-weight:bold;"> 🏆 ${t.name}</span>`
    ).join('');

    const membersText = team.members.join(", ");

    const eloDiff = team.lastElo !== undefined ? team.elo - team.lastElo : null;
    let eloHtml = `${team.elo}`;
    if (eloDiff !== null && eloDiff !== 0) {
      const color = eloDiff > 0 ? '#2ecc71' : '#e74c3c';
      const sign  = eloDiff > 0 ? '+' : '';
      eloHtml += ` <span style="color:${color};font-size:0.85em;font-weight:bold;">${sign}${eloDiff}</span>`;
    }

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>
        <a href="tagteam.html?id=${team.id}">${team.name}</a>
        ${titleBadge}
      </td>
      <td>${eloHtml}</td>
      <td>${team.wins}-${team.losses}</td>
      <td>${membersText}</td>
    `;

    tbody.appendChild(tr);
  });
});
