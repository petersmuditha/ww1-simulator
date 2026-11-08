let chatHistory = [];
let currentYear = 1914;
let currentMonth = 7; // Inizia a Luglio 1914
let questionsThisMonth = 0;
const MAX_QUESTIONS_PER_MONTH = 20; 
let currentStats = { manpower: 0, treasury: 0, stability: 0, support: 0 };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Salva la chiave API inserita dall'utente */
function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (key) {
    sessionStorage.setItem('groq_api_key', key);
    const status = document.getElementById('api-key-status');
    status.style.display = 'block';
    setTimeout(() => status.style.display = 'none', 3000);
  }
}

async function initGame() {
  const countryCode = sessionStorage.getItem('selectedCountry');
  const factionId = sessionStorage.getItem('selectedFaction');
  
  if (!countryCode || !factionId) { window.location.href = 'index.html'; return; }

  try {
    const res = await fetch('data/countries.json');
    const data = await res.json();
    const country = data[countryCode];
    const faction = country.factions.find(f => f.id === factionId);

    document.getElementById('game-title').textContent = country.name;
    document.getElementById('game-subtitle').textContent = `Leader: ${faction.name}`;

    if (!sessionStorage.getItem('currentStats')) {
      currentStats = { ...country.resources, support: faction.initialSupport };
      sessionStorage.setItem('currentStats', JSON.stringify(currentStats));
      sessionStorage.setItem('currentYear', currentYear);
      sessionStorage.setItem('currentMonth', currentMonth);
      sessionStorage.setItem('questionsThisMonth', questionsThisMonth);
    } else {
      currentStats = JSON.parse(sessionStorage.getItem('currentStats'));
      currentYear = parseInt(sessionStorage.getItem('currentYear')) || 1914;
      currentMonth = parseInt(sessionStorage.getItem('currentMonth')) || 7;
      questionsThisMonth = parseInt(sessionStorage.getItem('questionsThisMonth')) || 0;
    }

    updateStatsUI();
    document.body.style.backgroundImage = "url('img/map1914.jpeg')";

    // Se siamo a Luglio 1914, leggiamo il file JSON. Altrimenti generiamo con l'AI.
    if (currentYear === 1914 && currentMonth === 7 && questionsThisMonth < MAX_QUESTIONS_PER_MONTH) {
        loadQuestions('1914', countryCode, factionId, false);
    } else {
        generateNextTurnWithAI(countryCode, factionId);
    }
  } catch (error) {
    console.error("Error during initialization:", error);
  }
}

function updateStatsUI() {
  const displayEvent = Math.min(questionsThisMonth + 1, MAX_QUESTIONS_PER_MONTH);
  
  const titleEl = document.getElementById('decisions-title');
  if (titleEl) titleEl.textContent = `Decisions of ${MONTH_NAMES[currentMonth - 1]} ${currentYear}`;

  document.getElementById('stats').innerHTML = `
    <div class="stat"><div class="label">Date</div><div class="value">${MONTH_NAMES[currentMonth - 1].substring(0,3)} ${currentYear}</div></div>
    <div class="stat"><div class="label">Event</div><div class="value">${displayEvent} / ${MAX_QUESTIONS_PER_MONTH}</div></div>
    <div class="stat"><div class="label">Manpower</div><div class="value">${currentStats.manpower.toLocaleString('en-US')}</div></div>
    <div class="stat"><div class="label">Treasury</div><div class="value">${currentStats.treasury}</div></div>
    <div class="stat"><div class="label">Stability</div><div class="value">${currentStats.stability}/100</div></div>
    <div class="stat"><div class="label">Support</div><div class="value">${currentStats.support}%</div></div>
  `;
}

async function loadQuestions(year, countryCode, factionId, append = false) {
  try {
    const res = await fetch('data/events.json'); 
    const data = await res.json();
    
    const questions = data[year]?.[countryCode]?.[factionId] || [];
    const container = document.getElementById('questions-container');
    if (!append) container.innerHTML = ''; 

    if (questionsThisMonth >= MAX_QUESTIONS_PER_MONTH || questions.length === 0) {
      passToNextMonth(countryCode, factionId);
      return;
    }

    const q = questions[questionsThisMonth];
    if (!q) { passToNextMonth(countryCode, factionId); return; }

    const div = document.createElement('div');
    div.style.marginBottom = '15px';
    div.style.marginTop = append ? '20px' : '0';
    div.innerHTML = `<strong>${q.question}</strong><br>`;
    
    q.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.marginRight = '10px';
      btn.style.marginTop = '5px';
      btn.textContent = opt.text;
      btn.onclick = () => handleChoice(opt.effects, div, opt.text, q.id, countryCode, factionId);
      div.appendChild(btn);
    });
    container.appendChild(div);

  } catch (e) {
    console.error("Could not load events.json", e);
  }
}

function applyStats(effects) {
    for (let key in effects) {
        if (currentStats[key] !== undefined) currentStats[key] += effects[key];
    }
    currentStats.stability = Math.max(0, Math.min(100, currentStats.stability));
    currentStats.support = Math.max(0, Math.min(100, currentStats.support));
    currentStats.treasury = Math.max(0, currentStats.treasury);
    currentStats.manpower = Math.max(0, currentStats.manpower);
    sessionStorage.setItem('currentStats', JSON.stringify(currentStats));
}

async function handleChoice(effects, element, choiceText, questionId, countryCode, factionId) {
  const history = JSON.parse(sessionStorage.getItem('gameHistory') || '{}');
  history[questionId || `ai_${currentYear}_${currentMonth}_q${questionsThisMonth}`] = choiceText;
  sessionStorage.setItem('gameHistory', JSON.stringify(history));

  applyStats(effects);
  
  questionsThisMonth++;
  sessionStorage.setItem('questionsThisMonth', questionsThisMonth);
  
  updateStatsUI();
  const buttons = element.querySelectorAll('button');
  buttons.forEach(b => b.disabled = true);
  element.innerHTML += `<p style="color:#d4af37; margin-top:5px;">✔ You chose: "${choiceText}". (Effects applied)</p>`;

  const container = document.getElementById('questions-container');

  // CASO 1: mese finito (20/20) -> passa al mese prossimo
  if (questionsThisMonth >= MAX_QUESTIONS_PER_MONTH) {
    container.innerHTML = `<div style="margin-top:20px; color:#ff9800;"><em>The Game Master is closing the month...</em></div>`;
    setTimeout(() => passToNextMonth(countryCode, factionId), 600);
    return;
  }

  // CASO 2: Luglio 1914 -> domande pre-scritte, ma l'AI scrive il dispaccio
  if (currentYear === 1914 && currentMonth === 7) {
    container.innerHTML = `<div style="margin-top:20px; color:#ff9800;"><em>The Game Master is writing the dispatch...</em></div>`;
    try {
      const dispatch = await generateDispatch(choiceText, effects, countryCode, factionId);
      container.innerHTML = '';
      renderDispatch(dispatch.narrative, dispatch.visual);
      setTimeout(() => loadQuestions('1914', countryCode, factionId, true), dispatch.narrative.length * 20 + 800);
    } catch (err) {
      console.error("Dispatch error:", err);
      container.innerHTML = '';
      loadQuestions('1914', countryCode, factionId, true);
    }
    return;
  }

  // CASO 3: mesi AI (Agosto 1914+) -> generateNextTurnWithAI produce dispaccio + nuova domanda
  container.innerHTML = `<div style="margin-top:20px; color:#ff9800;"><em>The Game Master is writing the next event...</em></div>`;
  setTimeout(() => generateNextTurnWithAI(countryCode, factionId), 600);
}

function passToNextMonth(countryCode, factionId) {
    currentMonth++;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    }
    
    questionsThisMonth = 0;
    sessionStorage.setItem('currentYear', currentYear);
    sessionStorage.setItem('currentMonth', currentMonth);
    sessionStorage.setItem('questionsThisMonth', questionsThisMonth);
    
    if(currentYear > 1919) {
        document.getElementById('questions-container').innerHTML = "<h2 style='color:#d4af37; text-align:center;'>The Great War has ended. Your legacy is written in history.</h2>";
        return;
    }
    
    updateStatsUI();
    generateNextTurnWithAI(countryCode, factionId);
}

/** Chiama il proxy locale per il dispaccio */
async function generateDispatch(choiceText, effects, countryCode, factionId) {
  const apiKey = sessionStorage.getItem('groq_api_key');
  if (!apiKey) throw new Error("API Key mancante. Inseriscila in alto per continuare.");

  const gameHistory = JSON.parse(sessionStorage.getItem('gameHistory') || '{}');

  const systemPrompt = `You are the Game Master of a WW1 grand strategy simulator (Pax Historia style).
Faction: "${factionId}", Nation: "${countryCode}". Date: ${MONTH_NAMES[currentMonth - 1]} ${currentYear}. Event ${questionsThisMonth} of ${MAX_QUESTIONS_PER_MONTH}.
The player just chose: "${choiceText}".
Effects applied: ${JSON.stringify(effects)}.
Current stats: ${JSON.stringify(currentStats)}.
Game history so far: ${JSON.stringify(gameHistory)}.

Write a short, dramatic news report / intelligence dispatch (max 4 sentences) describing the consequences of this choice. Begin with a date and source, e.g. "BERLIN, August 1914:" or "INTELLIGENCE REPORT:".
Also choose ONE visual key from: "trenches", "ballroom", "riot", "strategy", "secret_meeting", "admin".

Return ONLY valid JSON with this exact structure:
{"narrative": "...", "visual": "trenches"}`;

  const response = await fetch('http://localhost:3000/api', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      message: "Write the dispatch for this choice.",
      history: chatHistory,
      system: systemPrompt
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  const reply = data.reply;
  const jsonMatch = reply.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in dispatch reply");
  return JSON.parse(jsonMatch[0]);
}

function renderDispatch(narrative, visual) {
  const container = document.getElementById('questions-container');
  if (visual) document.body.style.backgroundImage = `url('img/${visual}.jpeg')`;

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.borderLeft = '3px solid #ff9800';
  panel.innerHTML = `<p style="color:#ff9800; margin-bottom:10px;"><strong>📰 DISPATCH:</strong></p>
    <p id="dispatch-typewriter" style="font-family: 'Courier New', monospace; font-size: 1.1rem;"></p>`;
  container.appendChild(panel);

  typeWriter(narrative, 'dispatch-typewriter', 20);
}

/** Genera dispaccio + nuova domanda tramite proxy */
async function generateNextTurnWithAI(countryCode, factionId) {
  const apiKey = sessionStorage.getItem('groq_api_key');
  const container = document.getElementById('questions-container');
  
  if (!apiKey) {
    container.innerHTML = `<p style="color:#ff9800; font-weight:bold;">Please enter your Groq API Key in the field above to continue playing.</p>`;
    return;
  }

  container.innerHTML = `<p style='color:#ff9800'>The Game Master is writing event ${questionsThisMonth + 1} of ${MAX_QUESTIONS_PER_MONTH} for ${MONTH_NAMES[currentMonth - 1]} ${currentYear}...</p>`;

  const gameHistory = JSON.parse(sessionStorage.getItem('gameHistory') || '{}');

  const systemPrompt = `You are a Game Master in a Grand Strategy WW1 historical simulator (like Pax Historia).
Player faction: "${factionId}", nation: "${countryCode}". Date: ${MONTH_NAMES[currentMonth - 1]} ${currentYear}. Event: ${questionsThisMonth + 1}/${MAX_QUESTIONS_PER_MONTH} for this month.
Past History: ${JSON.stringify(gameHistory)}.
Stats: ${JSON.stringify(currentStats)}.

Your tasks:
1. Write a short, dramatic "News Report" or "Intelligence Briefing" (max 3 sentences) describing the consequences of the player's PREVIOUS choice. Start it with a date or source (e.g., "BERLIN, Aug 1914: ..." or "INTELLIGENCE REPORT: ...").
2. Generate a NEW historical dilemma appropriate for ${MONTH_NAMES[currentMonth - 1]} ${currentYear}.
3. Create 2 different options for the player to choose from. Each option MUST have an effect on the stats.
4. Add a "visual" key. Choose ONE: "trenches", "ballroom", "riot", "strategy", "secret_meeting", "admin".

You MUST return a JSON object with this EXACT structure:
{
  "narrative": "Your news report here...",
  "question": "The new dilemma...",
  "visual": "trenches",
  "options": [
    { "text": "Option A", "effects": { "stability": 5, "support": -2 } },
    { "text": "Option B", "effects": { "stability": -5, "support": 10 } }
  ]
}
Do NOT output any markdown. Do NOT output any text before or after the JSON. Only output the JSON object.`;

  try {
    const response = await fetch('http://localhost:3000/api', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        message: "Generate next event JSON.",
        history: chatHistory,
        system: systemPrompt
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    let reply = data.reply;
    console.log("Raw AI Response:", reply);

    chatHistory.push({ role: "user", parts: [{ text: "Generate next event" }] });
    chatHistory.push({ role: "model", parts: [{ text: reply }] });

    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No curly braces found.");

    const parsed = JSON.parse(jsonMatch[0]);
    renderAIEvent(parsed, countryCode, factionId);

  } catch (error) {
    console.error("Error generating event:", error);
    container.innerHTML = `
      <p style="color:red">Error: ${error.message}</p>
      <p style="color:#aaa; font-size:0.9rem;">Make sure the local server (server.js) is running and your API key is valid.</p>
      <button class="btn" onclick="generateNextTurnWithAI('${countryCode}', '${factionId}')">Try Again</button>
    `;
  }
}

function renderAIEvent(parsedData, countryCode, factionId) {
  const container = document.getElementById('questions-container');
  container.innerHTML = ''; 

  const visual = parsedData.visual || "trenches";
  document.body.style.backgroundImage = `url('img/${visual}.jpeg')`;

  const narrativeDiv = document.createElement('div');
  narrativeDiv.className = 'panel';
  narrativeDiv.style.borderLeft = '3px solid #ff9800';
  narrativeDiv.innerHTML = `<p style="color:#ff9800; margin-bottom:10px;"><strong>📰 DISPATCH:</strong></p><p id="typewriter-effect" style="font-family: 'Courier New', monospace; font-size: 1.1rem;"></p>`;
  container.appendChild(narrativeDiv);

  typeWriter(parsedData.narrative, 'typewriter-effect', 20);

  setTimeout(() => {
      const qDiv = document.createElement('div');
      qDiv.style.marginTop = '20px';
      qDiv.innerHTML = `<strong>${parsedData.question}</strong><br>`;

      parsedData.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.marginRight = '10px';
        btn.style.marginTop = '5px';
        btn.textContent = opt.text;
        btn.onclick = () => handleChoice(opt.effects, qDiv, opt.text, null, countryCode, factionId);
        qDiv.appendChild(btn);
      });

      container.appendChild(qDiv);
  }, parsedData.narrative.length * 20 + 500);
}

function typeWriter(text, elementId, speed) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.innerHTML = '';
  let i = 0;
  function type() {
    if (i < text.length) {
      element.innerHTML += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  }
  type();
}

async function handleFreeAction() {
  const apiKey = sessionStorage.getItem('groq_api_key');
  const input = document.getElementById('ai-input');
  const action = input.value.trim();
  if (!action) return;

  const responseDiv = document.getElementById('ai-response');
  
  if (!apiKey) {
    responseDiv.style.display = 'block';
    responseDiv.innerHTML = `<p style="color:#ff9800;">Please enter your API Key in the field above first.</p>`;
    return;
  }

  responseDiv.style.display = 'block';
  responseDiv.innerHTML = "<em>The AI is evaluating the historical consequences...</em>";
  input.value = '';

  const countryCode = sessionStorage.getItem('selectedCountry');
  const factionId = sessionStorage.getItem('selectedFaction');
  const gameHistory = JSON.parse(sessionStorage.getItem('gameHistory') || '{}');

  const systemPrompt = `You are a Game Master in a historical simulator. The player leads the faction "${factionId}" of the nation "${countryCode}" in ${MONTH_NAMES[currentMonth - 1]} ${currentYear}. 
  History: ${JSON.stringify(gameHistory)}. Current Stats: ${JSON.stringify(currentStats)}.
  Describe the consequences of their action in a dramatic 3-sentence news report.
  Return EXCLUSIVELY valid JSON without markdown: {"narrative": "your description", "effects": {"stability": 5, "support": -2}}`;

  try {
    const response = await fetch('http://localhost:3000/api', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        message: action,
        history: chatHistory,
        system: systemPrompt
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error);

    let reply = data.reply;
    chatHistory.push({ role: "user", parts: [{ text: action }] });
    chatHistory.push({ role: "model", parts: [{ text: reply }] });

    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      applyStats(parsed.effects);
      updateStatsUI();

      responseDiv.innerHTML = `
        <p style="margin-bottom:8px;">${parsed.narrative}</p>
        <span class="tag" style="background:#333; color:#d4af37;">Effects: ${JSON.stringify(parsed.effects)}</span>
      `;
    } else {
      responseDiv.innerHTML = `<p>${reply}</p>`;
    }
  } catch (error) {
    responseDiv.innerHTML = `<p style="color:red">Error: ${error.message}</p>`;
  }
}

// Avvia il gioco quando la pagina è pronta
window.addEventListener('DOMContentLoaded', initGame);