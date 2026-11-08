const FLAGS = {
  GER: '🇩🇪', FRA: '🇫🇷', GBR: '🇬🇧', ITA: '🇮🇹', AUT: '🇦🇹',
  HUN: '🇭🇺', RUS: '🇷🇺', OTT: '🇹🇷', SRB: '🇷🇸', ROU: '🇷🇴',
  BUL: '🇧🇬', GRE: '🇬🇷', MNE: '🇲🇪', ALB: '🇦🇱', BEL: '🇧🇪',
  NLD: '🇳🇱', CHE: '🇨🇭', ESP: '🇪🇸', PRT: '🇵🇹', SWE: '🇸🇪',
  NOR: '🇳🇴', DNK: '🇩🇰'
};

async function loadCountries() {
  try {
    const res = await fetch('data/countries.json');
    const data = await res.json();
    const grid = document.getElementById('country-grid');

    for (const [code, country] of Object.entries(data)) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="flag">${FLAGS[code] || '🏳️'}</div>
        <h2>${country.name}</h2>
        <p><strong>Regime:</strong> ${country.regime}</p>
        <p><strong>Head of State:</strong> ${country.headOfState}</p>
        <p style="margin-top:0.5rem;color:#d4af37">
          ${country.factions.length} factions available
        </p>
      `;
      card.addEventListener('click', () => {
        sessionStorage.setItem('selectedCountry', code);
        window.location.href = 'factions.html';
      });
      grid.appendChild(card);
    }
  } catch (err) {
    document.body.innerHTML = `<p style="color:red">Error loading data: ${err.message}<br>
      If you see this, you are probably opening the file directly. Use a local server instead.</p>`;
  }
}

loadCountries();