// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Eye, ArrowUp, Settings, X, Mic, MicOff, Maximize2, Minimize2, RefreshCw, Copy, Activity } from 'lucide-react';
import { MarkdownMessage } from './MarkdownMessage';
import './index.css';

// The URL of our local Python Brain
const BRAIN_URL = "http://127.0.0.1:11435";

const MainInterface = () => {
  // STATE
  const [messages, setMessages] = useState([{ id: 1, text: "Spectre (Local Brain) Ready.", sender: 'ai' }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [attachment, setAttachment] = useState(null);
  
  // POWER FEATURES
  const [isLive, setIsLive] = useState(false);
  const [isHudMode, setIsHudMode] = useState(false);
  const [activeBattlecards, setActiveBattlecards] = useState([]);
  const [transcriptContext, setTranscriptContext] = useState("");
  const [brainHealth, setBrainHealth] = useState("checking"); // checking | online | offline

  const chatEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingIntervalRef = useRef(null);

  // --- INITIALIZATION ---
  useEffect(() => {
    checkBrainHealth();
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeBattlecards]);

  const checkBrainHealth = async () => {
    try {
      const res = await fetch(`${BRAIN_URL}/health`);
      if (res.ok) setBrainHealth("online");
      else setBrainHealth("offline");
    } catch (e) {
      setBrainHealth("offline");
    }
  };

  // --- 1. LOCAL LIVE MODE (Via Python) ---
  const toggleLiveMode = () => { isLive ? stopLiveMode() : startLiveMode(); };

  const startLiveMode = async () => {
    if (brainHealth !== "online") {
      addMessage("❌ Python Brain is offline. Is server.py running?", 'ai');
      await checkBrainHealth(); // Retry check
      return;
    }

    try {
      // Get Microphone Stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.start();
      setIsLive(true);

      // SEND CHUNKS TO PYTHON EVERY 3 SECONDS
      // This creates "Real-time" feeling. Faster interval = lower latency but more API calls.
      recordingIntervalRef.current = setInterval(() => {
        if (mediaRecorder.state === "recording") {
          mediaRecorder.stop(); // Stop to flush data
          // Restart immediately is handled in onstop below to ensure continuity
        }
      }, 3000);

      mediaRecorder.onstop = async () => {
        if (!isLive) return; // Stop requested

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        audioChunksRef.current = []; // Reset buffer
        
        // Send to Python Brain
        sendAudioToBrain(audioBlob);

        // Restart recording immediately if still live
        mediaRecorder.start(); 
      };

    } catch (e) {
      addMessage(`❌ Mic Error: ${e.message}`, 'ai');
      setIsLive(false);
    }
  };

  const stopLiveMode = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop(); // Final flush
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    
    // Stop all tracks to release mic
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    
    setIsLive(false);
  };

  const sendAudioToBrain = async (blob) => {
    const formData = new FormData();
    formData.append("file", blob);

    try {
      const res = await fetch(`${BRAIN_URL}/transcribe`, { method: "POST", body: formData });
      const data = await res.json();
      
      if (data.text && data.text.length > 2) {
        // We got text!
        console.log("🗣️ Heard:", data.text);
        setTranscriptContext(prev => (prev + " " + data.text).slice(-1000));
        
        // Ask Brain for Context/Battlecards
        analyzeContext(data.text);
      }
    } catch (e) {
      console.error("Brain Transcription Failed:", e);
    }
  };

  const analyzeContext = async (text) => {
    try {
      const res = await fetch(`${BRAIN_URL}/analyze-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      
      if (data.matches && data.matches.length > 0) {
        data.matches.forEach(card => triggerBattlecard(card));
      }
    } catch (e) {}
  };

  // --- 2. BATTLECARDS UI ---
  const triggerBattlecard = (card) => {
    setActiveBattlecards(p => {
      if (p.find(c => c.title === card.title)) return p;
      return [...p, { ...card, id: Date.now() }];
    });
    setTimeout(() => setActiveBattlecards(p => p.filter(c => c.title !== card.title)), 20000);
  };

  // --- 3. HUD TOGGLE ---
  const toggleHudMode = async () => {
    const newMode = !isHudMode;
    setIsHudMode(newMode);
    if (newMode) await window.electronAPI.setWindowSize(450, 60);
    else await window.electronAPI.setWindowSize(800, 600);
  };

  // --- 4. STANDARD CHAT & SETTINGS ---
  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;
    const txt = input; setInput(""); setAttachment(null);
    addMessage(txt, "user");
    
    // Call Ollama directly or via Python Brain (Python is better for consistency)
    // For this example, we keep the direct Ollama call for chat, but you could route this to Python too.
    await callOllama(txt);
  };

  const callOllama = async (prompt) => {
    setIsLoading(true);
    try {
      const context = isLive ? `CONTEXT [Live Transcript]: ${transcriptContext}\n\n` : '';
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.model, prompt: context + prompt, stream: false })
      });
      const data = await res.json();
      addMessage(data.response, 'ai');
    } catch (e) { addMessage(`Error: ${e.message}`, 'ai'); }
    finally { setIsLoading(false); }
  };

  const addMessage = (text, sender) => setMessages(p => [...p, { id: Date.now(), text, sender }]);

  // --- RENDER HUD MODE ---
  if (isHudMode) {
    return (
      <div className="app-container hud-mode" style={{overflow:'hidden'}}>
        <div className="hud-drag"
             onMouseEnter={() => window.electronAPI.setIgnoreMouse(false)}
             onMouseLeave={() => window.electronAPI.setIgnoreMouse(true, {forward:true})}>
          
          {/* Status Dot */}
          <div className={`dot ${isLive ? 'pulse-ring' : ''}`} 
               style={{background: brainHealth !== 'online' ? '#555' : (isLive ? '#ef4444' : '#22c55e')}} />
          
          <div style={{flex:1, color:'white', fontSize:13, fontWeight:500, overflow:'hidden', whiteSpace:'nowrap', marginLeft: 10}}>
            {activeBattlecards.length > 0 ? `💡 ${activeBattlecards[activeBattlecards.length-1].title}` : (isLive ? "Listening (Local)..." : "Spectre HUD")}
          </div>

          <div style={{display:'flex', gap:8}}>
            <button onClick={toggleLiveMode} style={{background:'none', border:'none', color: isLive ? '#ef4444':'#aaa'}}>
              {isLive ? <MicOff size={16}/> : <Mic size={16}/>}
            </button>
            <button onClick={toggleHudMode} style={{background:'none', border:'none', color:'white'}}>
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER FULL MODE ---
  return (
    <div className="app-container">
      <div className="header-drag-area"></div>
      
      <div className="battlecard-container">
        {activeBattlecards.map(c => (
          <div key={c.id} className="battlecard">
            <div style={{flex:1}}><span className="battlecard-title">{c.title}</span><div className="battlecard-content">{c.content}</div></div>
            <button className="battlecard-close" onClick={() => setActiveBattlecards(p => p.filter(x => x.id !== c.id))}><X size={14}/></button>
          </div>
        ))}
      </div>

      <div className="status-indicator">
        <div className={`dot ${brainHealth === 'online' ? '' : 'offline'}`} />
        <span>{brainHealth === 'online' ? 'BRAIN ONLINE' : 'BRAIN OFFLINE'}</span>
      </div>
      
      <div style={{position:'absolute', top:16, right:16, zIndex:50, display:'flex', gap:10, WebkitAppRegion:'no-drag'}}>
        <button 
          className={`settings-trigger ${isLive?'pulse-ring':''}`} 
          onClick={toggleLiveMode} 
          style={{color: isLive ? '#ef4444' : (brainHealth==='online' ? '#aaa' : '#555')}}
          disabled={brainHealth !== 'online'}
        >
          {isLive ? <MicOff size={18} /> : <Mic size={18} />}
        </button>
        <button className="settings-trigger" onClick={toggleHudMode}><Minimize2 size={18} /></button>
        <button className="settings-trigger" onClick={() => setShowSettings(true)}><Settings size={18} /></button>
      </div>

      <div className="chat-area">
        {messages.map(m => (
          <div key={m.id} className={`message-group`}>
            <div className={`message ${m.sender}`}>{m.sender==='ai' ? <MarkdownMessage content={m.text}/> : m.text}</div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="input-section">
        <div className="input-wrapper">
          <input className="input-field" placeholder="Ask Spectre..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} autoFocus />
          <button className="action-btn" onClick={handleSend}><ArrowUp size={20}/></button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-header"><span>Settings</span><button onClick={() => setShowSettings(false)}><X size={20}/></button></div>
          <div style={{padding:'20px 0', color:'#888', fontSize:13}}>
            <p><strong>Python Brain Status:</strong> {brainHealth.toUpperCase()}</p>
            <p>Ensure <code>server.py</code> is running on port 11435.</p>
          </div>
          <button className="btn-primary" onClick={() => setShowSettings(false)}>Close</button>
        </div>
      )}
    </div>
  );
};
export default MainInterface;