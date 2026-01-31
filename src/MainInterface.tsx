// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { Eye, ArrowUp, Settings, X, Power, Sparkles, Copy, RefreshCw, Image as ImageIcon, Terminal, Search, Bug } from 'lucide-react';
import './index.css';

const MainInterface = () => {
  const [messages, setMessages] = useState([{ id: 1, text: "Spectre Ready. Local AI Connected.", sender: 'ai' }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  
  // ATTACHMENT STATE (The "Capture & Ask" Feature)
  const [attachment, setAttachment] = useState<string | null>(null);

  // CONFIG
  const [config, setConfig] = useState({
    provider: (localStorage.getItem('provider') || 'ollama'),
    apiKey: localStorage.getItem('apiKey') || '',
    model: localStorage.getItem('model') || 'llama3.2',
    systemContext: localStorage.getItem('systemContext') || ''
  });
  const [ollamaModels, setOllamaModels] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading, attachment]);

  useEffect(() => {
    if (config.provider === 'ollama') fetchOllamaModels();
  }, []);

  // --- API ---
  const fetchOllamaModels = async () => {
    try {
      const res = await fetch('http://localhost:11434/api/tags');
      const data = await res.json();
      setOllamaModels(data.models.map((m) => m.name));
    } catch (e) { console.error("Ollama offline"); }
  };

  const saveSettings = () => {
    localStorage.setItem('provider', config.provider);
    localStorage.setItem('apiKey', config.apiKey);
    localStorage.setItem('model', config.model);
    localStorage.setItem('systemContext', config.systemContext);
    setShowSettings(false);
  };

  const addMessage = (text, sender) => setMessages(p => [...p, { id: Date.now(), text, sender }]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // --- CORE LOGIC ---
  const handleCapture = async () => {
    try {
      const dataURL = await window.electronAPI.captureScreen();
      const base64 = dataURL.split(',')[1];
      // Instead of sending immediately, set as attachment
      setAttachment(base64);
    } catch (e) {
      addMessage("Error capturing screen.", 'ai');
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;
    
    const txt = input;
    const img = attachment;
    
    setInput("");
    setAttachment(null); // Clear attachment after sending
    setShowPrompts(false);

    // UX: Show user message with icon if image attached
    const userDisplay = img ? `<i>[Screenshot Attached]</i><br/>${txt}` : txt;
    addMessage(userDisplay, "user");

    await callAI(txt, img);
  };

  const callAI = async (prompt, imageBase64) => {
    setIsLoading(true);
    try {
      const finalPrompt = config.systemContext ? `SYSTEM: ${config.systemContext}\n\nUSER: ${prompt}` : prompt;
      let url = '', body = {}, headers = { 'Content-Type': 'application/json' };
      
      if (config.provider === 'ollama') {
        url = 'http://localhost:11434/api/generate';
        // Ollama image support
        body = { model: config.model, prompt: finalPrompt, stream: false, images: imageBase64 ? [imageBase64] : undefined };
      } else {
        url = config.provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        const content = [{ type: "text", text: finalPrompt }];
        if (imageBase64) content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
        body = { model: config.model, messages: [{ role: "user", content }] };
      }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      const reply = config.provider === 'ollama' ? data.response : data.choices[0].message.content;
      
      addMessage(reply.replace(/\n/g, '<br/>'), 'ai');
    } catch (e) { 
      addMessage(`Error: ${e.message}. Is Ollama running?`, 'ai'); 
    } finally { 
      setIsLoading(false); 
    }
  };

  // --- PROMPT LIBRARY ---
  const usePrompt = (p) => {
    setInput(p);
    setShowPrompts(false);
    // Optional: Auto-send if desired, but letting user edit is better
  };

  return (
    <div className="app-container">
      <div className="header-drag-area"></div>
      
      {/* STATUS INDICATOR */}
      <div className="status-indicator">
        <div className={`dot ${config.provider === 'ollama' ? '' : 'offline'}`} />
        <span>{config.provider === 'ollama' ? 'LOCAL' : 'CLOUD'}</span>
      </div>

      <button className="settings-trigger" onClick={() => setShowSettings(true)}><Settings size={18} /></button>

      {/* CHAT AREA */}
      <div className="chat-area">
        {messages.map((msg) => (
          <div key={msg.id} className="message-group">
            {msg.sender === 'ai' && (
              <div className="message-actions">
                <button className="msg-btn" onClick={() => copyToClipboard(msg.text.replace(/<br\/>/g, '\n'))} title="Copy"><Copy size={12} /></button>
                <button className="msg-btn" title="Regenerate"><RefreshCw size={12} /></button>
              </div>
            )}
            <div className={`message ${msg.sender}`}>
              <div dangerouslySetInnerHTML={{ __html: msg.text }} />
            </div>
          </div>
        ))}
        {isLoading && <div className="message ai">Thinking...</div>}
        <div ref={chatEndRef} />
      </div>

      {/* PROMPT LIBRARY POPUP */}
      {showPrompts && (
        <div className="prompt-menu">
          <div className="prompt-item" onClick={() => usePrompt("Explain this code logic")}>
            <Terminal size={14} className="prompt-icon"/> Explain Code
          </div>
          <div className="prompt-item" onClick={() => usePrompt("Extract text from this image")}>
            <Search size={14} className="prompt-icon"/> Extract Text
          </div>
          <div className="prompt-item" onClick={() => usePrompt("Find bugs in this snippet")}>
            <Bug size={14} className="prompt-icon"/> Find Bugs
          </div>
          <div className="prompt-item" onClick={() => usePrompt("Summarize this content")}>
            <Sparkles size={14} className="prompt-icon"/> Summarize
          </div>
        </div>
      )}

      {/* INPUT AREA */}
      <div className="input-section">
        {/* ATTACHMENT PREVIEW */}
        {attachment && (
          <div className="attachment-preview">
            <img src={`data:image/jpeg;base64,${attachment}`} className="preview-thumb" />
            <span className="preview-text">Screenshot Ready</span>
            <button className="preview-close" onClick={() => setAttachment(null)}><X size={14}/></button>
          </div>
        )}

        <div className="input-wrapper">
          {/* Eye Button captures screen but DOESNT send yet */}
          <button className={`action-btn ${attachment ? 'active' : ''}`} onClick={handleCapture} title="Capture Screen">
            <Eye size={20} />
          </button>
          
          <input 
            className="input-field" 
            placeholder="Ask Spectre... (Type / for prompts)" 
            value={input} 
            onChange={(e) => {
              setInput(e.target.value);
              if(e.target.value === '/') setShowPrompts(true);
              else setShowPrompts(false);
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            autoFocus 
          />
          
          <button className={`action-btn ${input || attachment ? 'active' : ''}`} onClick={handleSend}>
            <ArrowUp size={20} />
          </button>
        </div>
      </div>

      {/* SETTINGS OVERLAY */}
      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-header">
            <span>Settings</span>
            <button onClick={() => setShowSettings(false)} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}><X size={20}/></button>
          </div>
          
          <div className="setting-row">
            <label style={{fontSize:12, color:'#888', display:'block', marginBottom:5}}>AI Provider</label>
            <select className="styled-select" value={config.provider} onChange={(e) => setConfig({...config, provider: e.target.value})}>
              <option value="ollama">Ollama (Local / Private)</option>
              <option value="openai">OpenAI</option>
              <option value="groq">Groq</option>
            </select>
          </div>

          {config.provider === 'ollama' ? (
             <div className="setting-row">
               <label style={{fontSize:12, color:'#888', display:'block', marginBottom:5}}>Local Model</label>
               <select className="styled-select" value={config.model} onChange={(e) => setConfig({...config, model: e.target.value})}>
                 {ollamaModels.length > 0 ? ollamaModels.map(m => <option key={m} value={m}>{m}</option>) : <option>Loading...</option>}
               </select>
             </div>
          ) : (
            <>
              <div className="setting-row">
                <label style={{fontSize:12, color:'#888', display:'block', marginBottom:5}}>API Key</label>
                <input className="styled-input" type="password" value={config.apiKey} onChange={(e) => setConfig({...config, apiKey: e.target.value})} />
              </div>
              <div className="setting-row">
                <label style={{fontSize:12, color:'#888', display:'block', marginBottom:5}}>Model Name</label>
                <input className="styled-input" value={config.model} onChange={(e) => setConfig({...config, model: e.target.value})} />
              </div>
            </>
          )}

          <div className="setting-row">
            <label style={{fontSize:12, color:'#888', display:'block', marginBottom:5}}>System Context (Persona)</label>
            <textarea className="styled-input" style={{height:80, resize:'none'}} placeholder="You are a senior developer..." value={config.systemContext} onChange={(e) => setConfig({...config, systemContext: e.target.value})} />
          </div>

          <button className="btn-primary" onClick={saveSettings}>Save Changes</button>
          <button className="btn-danger" onClick={() => window.electronAPI.quitApp()}>Quit App</button>
        </div>
      )}
    </div>
  );
};
export default MainInterface;