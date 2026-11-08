'use client';

import { useState, useEffect, useRef } from 'react';
import { puter } from '@heyputer/puter.js';

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MAX_QUESTIONS_PER_MONTH = 20;

export default function App() {
  // Stati per la selezione
  const [view, setView] = useState<'select_country' | 'select_faction' | 'game'>('select_country');
  const [countriesData, setCountriesData] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);

  // Stati del gioco
  const [currentYear, setCurrentYear] = useState(1914);
  const [currentMonth, setCurrentMonth] = useState(7);
  const [questionsThisMonth, setQuestionsThisMonth] = useState(0);
  const [currentStats, setCurrentStats] = useState({ manpower: 0, treasury: 0, stability: 0, support: 0 });
  const [gameTitle, setGameTitle] = useState('');
  const [gameSubtitle, setGameSubtitle] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [dispatch, setDispatch] = useState<string>('');
  const [isLoadingGame, setIsLoadingGame] = useState(false);
  const [bgImage, setBgImage] = useState('/img/map1914.jpeg');
  const [freeActionText, setFreeActionText] = useState('');
  const [freeActionResponse, setFreeActionResponse] = useState('');

  // Stati per la Musica
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleMusic = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.volume = 0.3;
        audioRef.current.play().catch(e => console.log("Autoplay bloccato dal browser."));
      }
      setIsPlaying(!isPlaying);
    }
  };

  // 1. Carica i dati dei paesi all'avvio
  useEffect(() => {
    fetch('/data/countries.json')
      .then(res => res.json())
      .then(data => setCountriesData(data))
      .catch(err => console.error("Errore nel caricamento di countries.json.", err));
  }, []);

  // 2. Avvia il gioco quando viene scelta una fazione
  useEffect(() => {
    if (view === 'game' && selectedCountry && selectedFaction && countriesData) {
      const country = countriesData[selectedCountry];
      const faction = country.factions.find((f: any) => f.id === selectedFaction);
      
      setGameTitle(country.name);
      setGameSubtitle(`Leader: ${faction.name}`);
      
      const initialStats = { ...country.resources, support: faction.initialSupport };
      setCurrentStats(initialStats);
      
      setCurrentYear(1914);
      setCurrentMonth(7);
      setQuestionsThisMonth(0);
      setCurrentQuestion(null);
      setDispatch('');
      
      // Avviamo direttamente l'AI per generare la prima mossa di Luglio 1914!
      generateNextTurnWithAI(""); 
    }
  }, [view, selectedCountry, selectedFaction, countriesData]);

  const applyStats = (effects: any) => {
    const newStats = { ...currentStats };
    for (let key in effects) {
      if (newStats[key as keyof typeof newStats] !== undefined) {
        newStats[key as keyof typeof newStats] += effects[key];
      }
    }
    newStats.stability = Math.max(0, Math.min(100, newStats.stability));
    newStats.support = Math.max(0, Math.min(100, newStats.support));
    newStats.treasury = Math.max(0, newStats.treasury);
    newStats.manpower = Math.max(0, newStats.manpower);
    setCurrentStats(newStats);
  };

  const handleChoice = async (effects: any, choiceText: string) => {
    applyStats(effects);
    const nextQ = questionsThisMonth + 1;
    setQuestionsThisMonth(nextQ);
    setCurrentQuestion(null);
    setIsLoadingGame(true);

    if (nextQ >= MAX_QUESTIONS_PER_MONTH) {
      passToNextMonth();
      return;
    }

    // Ora usiamo sempre l'AI, in ogni mese!
    await generateNextTurnWithAI(choiceText);
  };

  const passToNextMonth = () => {
    let nextMonth = currentMonth + 1;
    let nextYear = currentYear;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    setCurrentMonth(nextMonth);
    setCurrentYear(nextYear);
    setQuestionsThisMonth(0);

    if (nextYear > 1919) {
      setDispatch("The Great War has ended. Your legacy is written in history.");
      setIsLoadingGame(false);
      return;
    }
    generateNextTurnWithAI("A new month begins.");
  };

  // --- FUNZIONI PUTER.JS ---

  const callPuterAI = async (systemPrompt: string, userMessage: string) => {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ];

    try {
      const response = await puter.ai.chat(messages, {
        model: "openai/gpt-4o-mini", 
      });

      const textResponse = response.message.content;
      const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("L'AI non ha restituito un JSON valido.");
      
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error("Errore Puter AI:", error);
      throw error;
    }
  };

  const generateNextTurnWithAI = async (choiceText: string = "") => {
    setIsLoadingGame(true);
    
    // Se choiceText è vuoto, siamo all'inizio del gioco o di un nuovo mese.
    const isFirstTurn = choiceText === "" || choiceText === "A new month begins.";
    
    const systemPrompt = `You are a Game Master in a WW1 simulator. Faction: "${selectedFaction}", Nation: "${selectedCountry}". Date: ${MONTH_NAMES[currentMonth - 1]} ${currentYear}. Event: ${questionsThisMonth + 1}/${MAX_QUESTIONS_PER_MONTH}.
Stats: ${JSON.stringify(currentStats)}. 
${isFirstTurn ? "This is the START of the game/month. There is no previous choice." : `Previous choice: "${choiceText}".`}

Tasks: 
1. Write a short dispatch (max 3 sentences) ${isFirstTurn ? "setting the historical scene." : "about the consequences of the previous choice."} 
2. Generate a NEW historical dilemma. 
3. Create 2 options with effects.

IMPORTANT: The "text" field in the options MUST contain a full, descriptive sentence for the action. DO NOT just output "A" or "B".
Return ONLY JSON: {"narrative": "...", "question": "...", "visual": "trenches", "options": [{"text": "Here you write the full text for the first option", "effects": {"stability": 5}}, {"text": "Here you write the full text for the second option", "effects": {"stability": -5}}]}`;

    try {
      const parsed = await callPuterAI(systemPrompt, "Generate event.");
      setDispatch(parsed.narrative);
      setCurrentQuestion({ question: parsed.question, options: parsed.options });
      if (parsed.visual) setBgImage(`/img/${parsed.visual}.jpeg`);
    } catch (err: any) {
      console.error(err);
      setDispatch(`Errore API: ${err.message}`);
    } finally {
      setIsLoadingGame(false);
    }
  };

  const handleFreeAction = async () => {
    if (!freeActionText.trim()) return;
    setIsLoadingGame(true);
    const systemPrompt = `You are a Game Master. Faction: "${selectedFaction}". Action: "${freeActionText}". Stats: ${JSON.stringify(currentStats)}.
Describe the consequences in 3 sentences. Return ONLY JSON: {"narrative": "...", "effects": {"stability": 5}}`;

    try {
      const parsed = await callPuterAI(systemPrompt, freeActionText);
      setFreeActionResponse(parsed.narrative);
      applyStats(parsed.effects);
    } catch (err: any) {
      console.error(err);
      setFreeActionResponse(`Errore: ${err.message}`);
    } finally {
      setFreeActionText('');
      setIsLoadingGame(false);
    }
  };

  // --- RENDERING ---

  const AudioElement = <audio ref={audioRef} loop src="/dies.mp3" />;

  // SCHERMATA 1: Selezione Nazione
  if (view === 'select_country') {
    return (
      <div style={{ padding: '2rem', fontFamily: 'Georgia, serif', color: '#e8e2d0', minHeight: '100vh', backgroundImage: `url('/img/map1914.jpeg')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
        {AudioElement}
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(20,20,20,0.85)', zIndex: -1 }}></div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
          <h1 style={{ color: '#d4af37', margin: 0 }}>Select a Nation</h1>
          <button onClick={toggleMusic} style={{ background: '#d4af37', color: '#000', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {isPlaying ? '🔇 Pause Music' : '🎵 Play Music'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {countriesData && Object.entries(countriesData).map(([code, country]: any) => (
            <div key={code} onClick={() => { setSelectedCountry(code); setView('select_faction'); }} style={{ background: '#262626', padding: '1rem', border: '1px solid #3a3a3a', borderRadius: '6px', cursor: 'pointer' }}>
              <h2 style={{ color: '#d4af37', margin: '0 0 0.5rem 0' }}>{country.name}</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#999' }}>{country.regime}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // SCHERMATA 2: Selezione Fazione
  if (view === 'select_faction' && selectedCountry && countriesData) {
    const country = countriesData[selectedCountry];
    return (
      <div style={{ padding: '2rem', fontFamily: 'Georgia, serif', color: '#e8e2d0', minHeight: '100vh', backgroundImage: `url('/img/map1914.jpeg')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
        {AudioElement}
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(20,20,20,0.85)', zIndex: -1 }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button onClick={() => setView('select_country')} style={{ background: 'transparent', color: '#d4af37', border: '1px solid #d4af37', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>&larr; Back to Nations</button>
          <button onClick={toggleMusic} style={{ background: '#d4af37', color: '#000', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {isPlaying ? '🔇 Pause Music' : '🎵 Play Music'}
          </button>
        </div>
        
        <h1 style={{ color: '#d4af37' }}>{country.name} - Factions</h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {country.factions.map((faction: any) => (
            <div key={faction.id} onClick={() => { setSelectedFaction(faction.id); setView('game'); }} style={{ background: '#262626', padding: '1rem', border: '1px solid #3a3a3a', borderRadius: '6px', cursor: 'pointer' }}>
              <h3 style={{ color: '#d4af37', margin: '0 0 0.5rem 0' }}>{faction.name}</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#aaa' }}>{faction.ideology}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // SCHERMATA 3: Gioco
  return (
    <div style={{ padding: '2rem', fontFamily: 'Georgia, serif', color: '#e8e2d0', minHeight: '100vh', backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      {AudioElement}
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(20,20,20,0.85)', zIndex: -1 }}></div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #d4af37', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', color: '#d4af37', margin: 0 }}>{gameTitle}</h1>
          <p style={{ color: '#999', margin: 0, fontStyle: 'italic' }}>{gameSubtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={toggleMusic} style={{ background: '#d4af37', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
            {isPlaying ? '🔇 Pause Music' : '🎵 Play Music'}
          </button>
          <button onClick={() => { setView('select_country'); setSelectedCountry(null); setSelectedFaction(null); }} style={{ background: '#d4af37', padding: '0.5rem 1rem', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Change Nation</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#262626', padding: '1rem', borderRadius: '6px', border: '1px solid #3a3a3a' }}>
          <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Date</div>
          <div style={{ fontSize: '1.5rem', color: '#d4af37', fontWeight: 'bold' }}>{MONTH_NAMES[currentMonth - 1].substring(0,3)} {currentYear}</div>
        </div>
        <div style={{ background: '#262626', padding: '1rem', borderRadius: '6px', border: '1px solid #3a3a3a' }}>
          <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Event</div>
          <div style={{ fontSize: '1.5rem', color: '#d4af37', fontWeight: 'bold' }}>{Math.min(questionsThisMonth + 1, MAX_QUESTIONS_PER_MONTH)} / {MAX_QUESTIONS_PER_MONTH}</div>
        </div>
        <div style={{ background: '#262626', padding: '1rem', borderRadius: '6px', border: '1px solid #3a3a3a' }}>
          <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Manpower</div>
          <div style={{ fontSize: '1.5rem', color: '#d4af37', fontWeight: 'bold' }}>{currentStats.manpower.toLocaleString()}</div>
        </div>
        <div style={{ background: '#262626', padding: '1rem', borderRadius: '6px', border: '1px solid #3a3a3a' }}>
          <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Treasury</div>
          <div style={{ fontSize: '1.5rem', color: '#d4af37', fontWeight: 'bold' }}>{currentStats.treasury}</div>
        </div>
        <div style={{ background: '#262626', padding: '1rem', borderRadius: '6px', border: '1px solid #3a3a3a' }}>
          <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Stability</div>
          <div style={{ fontSize: '1.5rem', color: '#d4af37', fontWeight: 'bold' }}>{currentStats.stability}/100</div>
        </div>
        <div style={{ background: '#262626', padding: '1rem', borderRadius: '6px', border: '1px solid #3a3a3a' }}>
          <div style={{ fontSize: '0.75rem', color: '#999', textTransform: 'uppercase' }}>Support</div>
          <div style={{ fontSize: '1.5rem', color: '#d4af37', fontWeight: 'bold' }}>{currentStats.support}%</div>
        </div>
      </div>

      <div style={{ background: '#262626', padding: '1.5rem', borderRadius: '6px', border: '1px solid #3a3a3a', marginBottom: '1.5rem' }}>
        <h2 style={{ color: '#d4af37', marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Decisions of {MONTH_NAMES[currentMonth - 1]} {currentYear}</h2>
        {dispatch && (
          <div style={{ borderLeft: '3px solid #ff9800', paddingLeft: '15px', marginBottom: '20px', fontFamily: 'Courier New, monospace' }}>
            <strong style={{ color: '#ff9800' }}>📰 DISPATCH:</strong>
            <p>{dispatch}</p>
          </div>
        )}
        {isLoadingGame && <p style={{ color: '#ff9800' }}><em>The Game Master is writing...</em></p>}
        {currentQuestion && !isLoadingGame && (
          <div>
            <strong>{currentQuestion.question}</strong><br/>
            <div style={{ marginTop: '10px' }}>
              {currentQuestion.options.map((opt: any, idx: number) => (
                <button key={idx} onClick={() => handleChoice(opt.effects, opt.text)} style={{ background: '#d4af37', color: '#000', padding: '0.7rem 1.5rem', margin: '5px 10px 5px 0', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
                  {opt.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: '#262626', padding: '1.5rem', borderRadius: '6px', border: '1px solid #3a3a3a' }}>
        <h2 style={{ color: '#d4af37', marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Orders to the Government (Free Action)</h2>
        <p style={{ color: '#999', fontSize: '0.9rem', marginBottom: '10px' }}>Write your move in natural language.</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" value={freeActionText} onChange={(e) => setFreeActionText(e.target.value)} placeholder="Write your move..." style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #555', background: '#1a1a1a', color: 'white' }} />
          <button onClick={handleFreeAction} style={{ background: '#d4af37', color: '#000', padding: '0.7rem 1.5rem', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Send</button>
        </div>
        {freeActionResponse && (
          <div style={{ marginTop: '15px', padding: '15px', background: '#1f1f1f', borderLeft: '3px solid #d4af37' }}>{freeActionResponse}</div>
        )}
      </div>
    </div>
  );
}