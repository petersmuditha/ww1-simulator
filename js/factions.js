const FLAGS = {
  GER: '🇩🇪', FRA: '🇫🇷', GBR: '🇬🇧', ITA: '🇮🇹', AUT: '🇦🇹',
  HUN: '🇭🇺', RUS: '🇷🇺', OTT: '🇹🇷', SRB: '🇷🇸', ROU: '🇷🇴',
  BUL: '🇧🇬', GRE: '🇬🇷', MNE: '🇲🇪', ALB: '🇦🇱', BEL: '🇧🇪',
  NLD: '🇳🇱', CHE: '🇨🇭', ESP: '🇪🇸', PRT: '🇵🇹', SWE: '🇸🇪',
  NOR: '🇳🇴', DNK: '🇩🇰'
};

async function loadFactions() {
  const code = sessionStorage.getItem('selectedCountry');
  if (!code) {
    window.location.href = 'index.html';
    return;
  }

  const res = await fetch('data/countries.json');
  const data = await res.json();
  const country = data[code];

  document.getElementById('country-title').textContent =
    `${FLAGS[code] || ''} ${country.name}`;
  document.getElementById('country-subtitle').textContent =
    `${country.regime} — ${country.headOfState}`;

  const list = document.getElementById('faction-list');

  country.factions.forEach(faction => {
    const card = document.createElement('div');
    card.className = 'faction-card';
    card.innerHTML = `
      <h3>${faction.name}</h3>
      <p style="color:#aaa;font-size:0.9rem">
        <span class="tag">${faction.ideology}</span>
      </p>
      <p style="margin-top:0.6rem"><strong>War position:</strong> ${faction.warPosition}</p>
      <div style="margin-top:0.8rem">
        <span style="font-size:0.8rem;color:#999">Initial support: ${faction.initialSupport}%</span>
        <div class="bar">
          <div class="bar-fill" style="width:${faction.initialSupport}%"></div>
        </div>
      </div>
      <p style="font-size:0.7rem;color:#666;margin-top:0.8rem">Source: ${faction.source}</p>
    `;
    card.addEventListener('click', () => {
      sessionStorage.setItem('selectedFaction', faction.id);
      window.location.href = 'game.html';
    });
    list.appendChild(card);
  });
}

loadFactions();