// Load universe.json
function loadUniverse(callback) {
  fetch('universe.json')
    .then(res => {
      if (!res.ok) throw new Error(`Failed to load universe.json: ${res.status}`);
      return res.json();
    })
    .then(data => callback(data))
    .catch(err => console.error("Error loading universe.json:", err));
}

// Rotating banner (homepage)
let bannerIndex = 0;
function rotateBanner() {
  const banners = document.querySelectorAll('.banner img');
  if (banners.length === 0) return;
  banners.forEach((img, i) => img.classList.toggle('active', i === bannerIndex));
  bannerIndex = (bannerIndex + 1) % banners.length;
}
setInterval(rotateBanner, 4000);

// Homepage: last week, upcoming matches, news
if (document.getElementById('last-week')) {
  loadUniverse(data => {
    const lastWeek = document.getElementById('last-week');
    const upcoming = document.getElementById('upcoming');
    const news = document.getElementById('news');

    (data.lastWeekMatches || []).forEach(m => {
      const li = document.createElement('li');
      li.textContent = m;
      lastWeek.appendChild(li);
    });

    (data.weeklyCard || []).forEach(m => {
      const li = document.createElement('li');
      li.textContent = m;
      upcoming.appendChild(li);
    });

    (data.news || []).forEach(n => {
      const li = document.createElement('li');
      li.textContent = n;
      news.appendChild(li);
    });
  });
}

// Rankings page
if (document.getElementById('rankings-div1')) {
  loadUniverse(data => {
    const div1 = document.getElementById('rankings-div1');
    const div2 = document.getElementById('rankings-div2');

    data.players.forEach(p => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${p.rank}</td>
        <td><a href="wrestler.html?name=${encodeURIComponent(p.name)}">${p.name}</a></td>
        <td>${p.elo}</td>
        <td>${p.wins}-${p.losses}</td>
      `;
      if (p.division === 'Div 1') div1.appendChild(row);
      else if (p.division === 'Div 2') div2.appendChild(row);
    });
  });
}

// Wrestlers page
if (document.getElementById('wrestler-list')) {
  loadUniverse(data => {
    const champContainer = document.getElementById('champions');
    const rosterContainer = document.getElementById('wrestler-list');

    // Champions first
    (data.championships || []).forEach(title => {
      const champ = data.players.find(p => p.name === title.holder);
      if (champ) {
        const card = document.createElement('div');
        card.className = 'wrestler-card champion-card';
        card.innerHTML = `
          <img src="${champ.photo || 'images/default.png'}" alt="${champ.name}" onerror="this.src='images/default.png'">
          <h3><a href="wrestler.html?name=${encodeURIComponent(champ.name)}">${champ.name}</a></h3>
          <p>${title.name} Champion</p>
          <p>Rank: ${champ.rank} | Elo: ${champ.elo}</p>
          <p>Record: ${champ.wins}-${champ.losses}</p>
          <p>Division: ${champ.division}</p>
        `;
        champContainer.appendChild(card);
      }
    });

    // Rest of roster alphabetically
    const sorted = [...data.players].sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach(p => {
      if (data.championships.some(c => c.holder === p.name)) return;
      const card = document.createElement('div');
      card.className = 'wrestler-card';
      card.innerHTML = `
        <img src="${p.photo || 'images/default.png'}" alt="${p.name}" onerror="this.src='images/default.png'">
        <h3><a href="wrestler.html?name=${encodeURIComponent(p.name)}">${p.name}</a></h3>
        <p>Rank: ${p.rank} | Elo: ${p.elo}</p>
        <p>Record: ${p.wins}-${p.losses}</p>
        <p>Division: ${p.division}</p>
      `;
      rosterContainer.appendChild(card);
    });
  });
}

// News page
if (document.getElementById('news-list')) {
  loadUniverse(data => {
    const newsList = document.getElementById('news-list');
    (data.news || []).forEach(n => {
      const li = document.createElement('li');
      li.textContent = n;
      newsList.appendChild(li);
    });
  });
}
// Wrestler profile page
if (window.location.pathname.endsWith('wrestler.html')) {
  loadUniverse(data => {
    // Get wrestler name from ?name= query parameter
    const params = new URLSearchParams(window.location.search);
    const nameParam = params.get('name');

    if (!nameParam) {
      console.error("No wrestler name in query string.");
      return;
    }

    const wrestlerName = decodeURIComponent(nameParam);
    const wrestler = data.players.find(p => p.name === wrestlerName);

    if (!wrestler) {
      console.error("Wrestler not found:", wrestlerName);
      const nameEl = document.getElementById('wrestler-name');
      if (nameEl) nameEl.textContent = "Wrestler Not Found";
      return;
    }

    // Basic elements
    const photoEl = document.getElementById('wrestler-photo');
    const nameEl = document.getElementById('wrestler-name');
    const divRankEl = document.getElementById('wrestler-division-rank');
    const recordEl = document.getElementById('wrestler-record');
    const eloEl = document.getElementById('wrestler-elo');
    const titlesEl = document.getElementById('wrestler-titles');

    // Fill in core info
    if (photoEl) {
	const imgSrc = wrestler.photo && wrestler.photo.trim() !== "" 
    ? wrestler.photo 
    : "images/default.png";

	photoEl.src = imgSrc;
	photoEl.alt = wrestler.name;

	// If the image fails to load, use default
	photoEl.onerror = () => {
    photoEl.src = "images/default.png";
  };
}

    if (nameEl) nameEl.textContent = wrestler.name;
    if (divRankEl) divRankEl.textContent = `Division: ${wrestler.division} • Rank: ${wrestler.rank}`;
    if (recordEl) recordEl.textContent = `Record: ${wrestler.wins}-${wrestler.losses}`;
    if (eloEl) eloEl.textContent = `Elo Rating: ${wrestler.elo}`;

    // Titles (from championships list)
    const heldTitles = (data.championships || []).filter(c => c.holder === wrestler.name);
    if (titlesEl) {
      if (heldTitles.length === 0) {
        titlesEl.textContent = "Current Championships: None";
      } else {
        const names = heldTitles.map(t => t.name).join(', ');
        titlesEl.textContent = `Current Championships: ${names}`;
      }
    }

    // Recent matches – for now, we don't track per-wrestler matches in JSON,
    // so just show a friendly placeholder.
    const matchesEl = document.getElementById('wrestler-matches');
    if (matchesEl) {
      matchesEl.innerHTML = '';
      const li = document.createElement('li');
      li.textContent = "No individual match history tracked yet. First appearance coming soon.";
      matchesEl.appendChild(li);
    }

    // Highlights – placeholder until you add data fields
    const highlightsEl = document.getElementById('wrestler-highlights');
    if (highlightsEl) {
      highlightsEl.innerHTML = '';
      const li = document.createElement('li');
      li.textContent = "Debut season – poised to make an impact.";
      highlightsEl.appendChild(li);
    }

    // Overview – you can later add a 'bio' field per player if you want
    const overviewEl = document.getElementById('wrestler-overview');
    if (overviewEl) {
      overviewEl.textContent = `${wrestler.name} competes in ${wrestler.division} and is currently ranked #${wrestler.rank} with an Elo of ${wrestler.elo}. Their story in this universe is just beginning.`;
    }
  });
}
// Titles (from championships list)
const heldTitles = (data.championships || []).filter(c => c.holder === wrestler.name);

if (titlesEl) {
  if (heldTitles.length === 0) {
    // Hide the element entirely if no championships
    titlesEl.style.display = "none";
  } else {
    const names = heldTitles.map(t => t.name).join(', ');
    titlesEl.textContent = `Current Championships: ${names}`;
    titlesEl.style.display = "block";
  }}
