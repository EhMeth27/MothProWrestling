loadUniverse(data => {
  const div1 = document.getElementById('rankings-div1');
  const div2 = document.getElementById('rankings-div2');

  const div1Players = data.players
    .filter(p => p.division === 'Div 1')
    .sort((a, b) => a.divisionRank - b.divisionRank);

  const div2Players = data.players
    .filter(p => p.division === 'Div 2')
    .sort((a, b) => a.divisionRank - b.divisionRank);

  div1Players.forEach(p => {
    const row = document.createElement('tr');
	row.innerHTML = `
   <td>${p.divisionRank}</td>
   <td><a href="wrestler.html?name=${encodeURIComponent(p.name)}">${p.name}</a></td>
   <td>
    ${p.elo}
   <span class="elo-change">${formatEloChange(p)}</span>
   </td>
  <td>${p.wins}-${p.losses}</td>
  `;

    div1.appendChild(row);
  });

  div2Players.forEach(p => {
    const row = document.createElement('tr');
    row.innerHTML = `
	<td>${p.divisionRank}</td>
	<td><a href="wrestler.html?name=${encodeURIComponent(p.name)}">${p.name}</a></td>
	<td>
    ${p.elo}
    <span class="elo-change">${formatEloChange(p)}</span>
	</td>
	<td>${p.wins}-${p.losses}</td>
	`;

    div2.appendChild(row);
  });
  function formatEloChange(p) {
  if (p.lastElo === undefined) return ""; // no data yet

  const diff = p.elo - p.lastElo;

  if (diff > 0) {
    return `<span style="color: #2ecc71; font-weight:bold;">+${diff}</span>`;
  } else if (diff < 0) {
    return `<span style="color: #e74c3c; font-weight:bold;">${diff}</span>`;
  } else {
    return `<span style="color: #888;">=0</span>`;
  }
}

});
