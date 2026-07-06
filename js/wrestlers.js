loadUniverse(data => {
  const champContainer  = document.getElementById('champions');
  const tagChampContainer = document.getElementById('tag-champions');
  const rosterContainer = document.getElementById('wrestler-list');

  const singlesChamps = (data.championships || []).filter(c => c.type !== 'tag');
  const tagChamps     = (data.championships || []).filter(c => c.type === 'tag');

  // ── Singles Champions ───────────────────────────────────
  singlesChamps.forEach(title => {
    const champ = data.players.find(p => p.name === title.holder);
    if (!champ) return;

    const card = document.createElement('div');
    card.className = 'wrestler-card champion-card';
    card.innerHTML = `
      <img src="${champ.photo || 'images/default.png'}" alt="${champ.name}" onerror="this.src='images/default.png'">
      <h3><a href="wrestler.html?name=${encodeURIComponent(champ.name)}">${champ.name}</a></h3>
      <p>🏆 ${title.name}</p>
      <p>Div Rank: ${champ.divisionRank} | Elo: ${champ.elo}</p>
      <p>Record: ${champ.wins}-${champ.losses}</p>
    `;
    champContainer.appendChild(card);
  });

  // ── Tag Team Champions ───────────────────────────────────
  if (tagChampContainer) {
    tagChamps.forEach(title => {
      const team = (data.tagTeams || []).find(t => t.name === title.holder);
      if (!team) return;

      const card = document.createElement('div');
      card.className = 'wrestler-card champion-card tag-champ-card';

      // Get photos for each member
      const memberPhotos = team.members.map(memberName => {
        const player = data.players.find(p => p.name === memberName);
        return `
          <a href="wrestler.html?name=${encodeURIComponent(memberName)}">
            <img src="${player?.photo || 'images/default.png'}"
                 alt="${memberName}"
                 onerror="this.src='images/default.png'"
                 style="width:70px;height:70px;object-fit:cover;border-radius:6px;border:2px solid gold;">
          </a>`;
      }).join('');

      card.innerHTML = `
        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:0.5rem;">
          ${memberPhotos}
        </div>
        <h3><a href="tagteam.html?id=${team.id}">${team.name}</a></h3>
        <p>🏆 ${title.name}</p>
        <p>Elo: ${team.elo} | Record: ${team.wins}-${team.losses}</p>
        <p style="font-size:0.85em;color:#ccc;">${team.members.join(' & ')}</p>
      `;
      tagChampContainer.appendChild(card);
    });

    // Hide section if no tag titles exist
    if (tagChamps.length === 0) {
      const section = tagChampContainer.closest('section');
      if (section) section.style.display = 'none';
    }
  }

  // ── All Wrestlers (non-champions) ───────────────────────
  const singlesHolders = singlesChamps.map(c => c.holder);
  const sorted = [...data.players].sort((a, b) => a.name.localeCompare(b.name));

  sorted.forEach(p => {
    if (singlesHolders.includes(p.name)) return; // already shown above

    const card = document.createElement('div');
    card.className = 'wrestler-card';
    card.innerHTML = `
      <img src="${p.photo || 'images/default.png'}" alt="${p.name}" onerror="this.src='images/default.png'">
      <h3><a href="wrestler.html?name=${encodeURIComponent(p.name)}">${p.name}</a></h3>
      <p>Div Rank: ${p.divisionRank} | Elo: ${p.elo}</p>
      <p>Record: ${p.wins}-${p.losses}</p>
      <p>Division: ${p.division}</p>
    `;
    rosterContainer.appendChild(card);
  });
});
