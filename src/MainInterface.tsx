import { useState, useEffect, useRef } from 'react';
import { Eye, ArrowUp, Settings, X, Power, Sparkles, MessageSquare, Zap, Activity } from 'lucide-react';
import './index.css';

type Message = { id: number; text: string; sender: 'user' | 'ai'; };
type Provider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'groq';
type AppSettings = { provider: Provider; apiKey: string; model: string; systemContext: string; };

const MainInterface = () => {
  const [messages, setMessages] = useState<Message[]>([{ id: 1, text: "Spectre online.", sender: 'ai' }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // LIVE MODE STATE
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0); // For Visualizer

  // REFS
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const sourceRef = useRef<any>(null);
  const isLiveRef = useRef(false);
  const liveIntervalRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // CONFIG
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [config, setConfig] = useState<AppSettings>(() => ({
    provider: (localStorage.getItem('provider') as Provider) || 'ollama',
    apiKey: localStorage.getItem('apiKey') || '',
    model: localStorage.getItem('model') || 'llama3.2',
    systemContext: localStorage.getItem('systemContext') || ''
  }));

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading, input]);
  useEffect(() => { if (config.provider === 'ollama' && showSettings) fetchOllamaModels(); }, [config.provider, showSettings]);
  useEffect(() => { return () => stopEverything(); }, []);

  const stopEverything = () => {
    isLiveRef.current = false;
    setIsLiveMode(false);
    setVolumeLevel(0);
    if (recognitionRef.current) recognitionRef.current.stop();
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
  };

  const toggleLiveMode = () => {
    if (isLiveMode) {
      stopEverything();
      addMessage("Live mode stopped.", 'ai');
    } else {
      isLiveRef.current = true;
      setIsLiveMode(true);
      addMessage("Live Mode Active. Please ensure audio is audible to your mic (use Speakers).", 'ai');
      
      // 1. Screen Watcher
      handleCapture(true);
      liveIntervalRef.current = setInterval(() => { handleCapture(true); }, 5000);

      // 2. Audio Listener & Visualizer
      startAudioListener();
    }
  };

  const startAudioListener = async () => {
    // A. VISUALIZER (To verify input)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      audioContextRef.current = audioContext;
      
      const updateVolume = () => {
        if (!isLiveRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        // Calculate average volume
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) sum += dataArray[i];
        const average = sum / bufferLength;
        setVolumeLevel(average); // 0 to 255
        requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (e) {
      console.error("Mic Access Error for Visualizer:", e);
    }

    // B. DICTATION ENGINE
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
      }
      if (final) {
        setInput(prev => prev + (prev.trim() && !prev.endsWith(' ') ? ' ' : '') + final);
      }
    };

    recognition.onend = () => {
      if (isLiveRef.current) try { recognition.start(); } catch (e) {}
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const fetchOllamaModels = async () => {
    setIsFetchingModels(true);
    try {
      const res = await fetch('http://localhost:11434/api/tags');
      const data = await res.json();
      const names = data.models.map((m: any) => m.name);
      setOllamaModels(names);
      if (!names.includes(config.model) && names.length > 0) setConfig(prev => ({ ...prev, model: names[0] }));
    } catch (e) { console.error(e); } finally { setIsFetchingModels(false); }
  };

  const addMessage = (text: string, sender: 'user' | 'ai') => {
    setMessages(prev => [...prev, { id: Date.now(), text, sender }]);
  };

  const saveSettings = () => {
    localStorage.setItem('provider', config.provider);
    localStorage.setItem('apiKey', config.apiKey);
    localStorage.setItem('model', config.model);
    localStorage.setItem('systemContext', config.systemContext);
    setShowSettings(false);
  };

  const callAI = async (prompt: string, imageBase64: string | null, silent: boolean = false) => {
    if (!silent) setIsLoading(true);
    try {
      const finalPrompt = config.systemContext ? `CONTEXT: ${config.systemContext}\n\nQUESTION: ${prompt}` : prompt;
      let url = '', body: any = {}, headers: any = { 'Content-Type': 'application/json' };
      if (config.provider === 'ollama') {
        url = 'http://localhost:11434/api/generate';
        body = { model: config.model, prompt: finalPrompt, stream: false, images: imageBase64 ? [imageBase64] : undefined };
      } else {
        url = config.provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        const content: any[] = [{ type: "text", text: finalPrompt }];
        if (imageBase64) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
        body = { model: config.model, messages: [{ role: "user", content }] };
      }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const reply = config.provider === 'ollama' ? data.response : data.choices[0].message.content;
      if (!silent) addMessage(reply.replace(/\n/g, '<br/>'), 'ai');
      else console.log("Silent Log:", reply);
    } catch (e: any) { if(!silent) addMessage(`Error: ${e.message}`, 'ai'); } finally { if(!silent) setIsLoading(false); }
  };

  const handleSendText = async () => {
    if (!input.trim() || isLoading) return;
    const txt = input; setInput(""); addMessage(txt, "user");
    await callAI(txt, null);
  };

  const handleCapture = async (silent: boolean = false) => {
    if (isLoading && !silent) return;
    if (!silent) addMessage("Analyzing screen...", "user");
    try {
      const dataURL = await window.electronAPI.captureScreen();
      const base64 = dataURL.split(',')[1];
      const prompt = input || (silent ? "Briefly list major changes." : "What is on this screen?");
      if (!silent) setInput("");
      await callAI(prompt, base64, silent);
    } catch (e: any) { if (!silent) addMessage(`Capture Failed: ${e.message}`, 'ai'); }
  };

  return (
    <div className="app-container">
      <div className="header-drag-area"></div>

      <button className="settings-trigger" onClick={() => setShowSettings(true)}><Settings size={20} /></button>

      <div className="chat-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}><div dangerouslySetInnerHTML={{ __html: msg.text }} /></div>
        ))}
        {isLoading && <div className="message ai">Thinking...</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="input-section">
        <div className="suggestions">
          <button className={`chip ${isLiveMode ? 'active' : ''}`} onClick={toggleLiveMode}>
            {isLiveMode ? <Activity size={12} className="spin" /> : <Zap size={12} />} {isLiveMode ? 'Live Active' : 'Start Live Mode'}
          </button>
          <button className="chip" onClick={() => setInput("Summarize meeting notes")}><MessageSquare size={12} /> Notes</button>
          <button className="chip" onClick={() => setInput("Draft a reply")}><Sparkles size={12} /> Reply</button>
        </div>

        <div className="input-wrapper" style={{position: 'relative', overflow: 'hidden'}}>
          {/* VOLUME VISUALIZER BACKGROUND */}
          {isLiveMode && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, height: '3px',
              width: `${Math.min(volumeLevel * 2, 100)}%`, // Moves based on volume
              background: '#22c55e', transition: 'width 0.05s ease', opacity: 0.8
            }} />
          )}

          <button className="action-btn" onClick={() => handleCapture(false)} title="Analyze Screen"><Eye size={20} /></button>
          <input 
            className="input-field" 
            placeholder={isLiveMode ? "Listening to room audio..." : "Ask Spectre..."} 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()} 
            autoFocus 
          />
          <button className={`action-btn ${input ? 'active' : ''}`} onClick={handleSendText}><ArrowUp size={20} /></button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-overlay">
          {/* Settings UI same as before */}
          <div className="settings-header">
            <span className="settings-title">Spectre Settings</span>
            <button onClick={() => setShowSettings(false)} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}><X size={22}/></button>
          </div>
          <div className="settings-scroll">
            <div className="setting-group">
              <span className="setting-label">System Context</span>
              <textarea className="setting-textarea" placeholder="I am a React Developer..." value={config.systemContext} onChange={(e) => setConfig({...config, systemContext: e.target.value})} />
            </div>
            <div className="setting-group">
              <span className="setting-label">AI Provider</span>
              <select className="setting-select" value={config.provider} onChange={(e) => setConfig({...config, provider: e.target.value as Provider})}>
                <option value="ollama">Ollama (Private)</option>
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
              </select>
            </div>
            {config.provider === 'ollama' ? (
              <div className="setting-group">
                 <div style={{display:'flex', justifyContent:'space-between'}}>
                    <span className="setting-label">Local Model</span>
                    <button className="refresh-btn" onClick={fetchOllamaModels}>Scan</button>
                 </div>
                 {ollamaModels.length > 0 ? (
                   <select className="setting-select" value={config.model} onChange={(e) => setConfig({...config, model: e.target.value})}>{ollamaModels.map(m => <option key={m} value={m}>{m}</option>)}</select>
                 ) : (
                   <input className="setting-input" value={config.model} onChange={(e) => setConfig({...config, model: e.target.value})}/>
                 )}
              </div>
            ) : (
              <div className="setting-group">
                <span className="setting-label">API Key</span>
                <input className="setting-input" type="password" value={config.apiKey} onChange={(e) => setConfig({...config, apiKey: e.target.value})} />
              </div>
            )}
          </div>
          <button className="save-btn" onClick={saveSettings}>Save Configuration</button>
          <button className="quit-btn" onClick={() => window.electronAPI.quitApp()}><Power size={16} /> Quit Spectre</button>
        </div>
      )}
    </div>
  );
};
export default MainInterface;