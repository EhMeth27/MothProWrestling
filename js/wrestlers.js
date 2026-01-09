loadUniverse(data => {
  const champContainer = document.getElementById('champions');
  const rosterContainer = document.getElementById('wrestler-list');

  (data.championships || []).forEach(title => {
    const champ = data.players.find(p => p.name === title.holder);
    if (champ) {
      const card = document.createElement('div');
      card.className = 'wrestler-card champion-card';
      card.innerHTML = `
        <img src="${champ.photo || 'images/default.png'}" alt="${champ.name}">
        <h3><a href="wrestler.html?name=${encodeURIComponent(champ.name)}">${champ.name}</a></h3>
        <p>${title.name} Champion</p>
        <p>Div Rank: ${champ.divisionRank} | Elo: ${champ.elo}</p>
        <p>Record: ${champ.wins}-${champ.losses}</p>
      `;
      champContainer.appendChild(card);
    }
  });

  const sorted = [...data.players].sort((a, b) => a.name.localeCompare(b.name));
  sorted.forEach(p => {
    if (data.championships.some(c => c.holder === p.name)) return;

    const card = document.createElement('div');
    card.className = 'wrestler-card';
    card.innerHTML = `
      <img src="${p.photo || 'images/default.png'}" alt="${p.name}">
      <h3><a href="wrestler.html?name=${encodeURIComponent(p.name)}">${p.name}</a></h3>
      <p>Div Rank: ${p.divisionRank} | Elo: ${p.elo}</p>
      <p>Record: ${p.wins}-${p.losses}</p>
      <p>Division: ${p.division}</p>
    `;
    rosterContainer.appendChild(card);
  });
});
