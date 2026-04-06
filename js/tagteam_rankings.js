loadUniverse(data => {
  const tbody = document.querySelector("#tagteam-table tbody");
  tbody.innerHTML = "";

  if (!data.tagTeams || data.tagTeams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No tag teams found.</td></tr>`;
    return;
  }

  const teams = [...data.tagTeams].sort((a, b) => b.elo - a.elo);

  teams.forEach((team, i) => {
    const tr = document.createElement("tr");

    const membersText = team.members.join(", ");

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><a href="tagteam.html?id=${team.id}">${team.name}</a></td>
      <td>${team.elo}</td>
      <td>${team.wins}-${team.losses}</td>
      <td>${membersText}</td>
    `;

    tbody.appendChild(tr);
  });
});
