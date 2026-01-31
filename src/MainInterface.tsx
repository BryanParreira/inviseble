import { useState, useEffect, useRef } from 'react';
import { Eye, ArrowUp, Settings, X, Power } from 'lucide-react';
import './index.css';

// Types
type Message = { id: number; text: string; sender: 'user' | 'ai'; };
type AppSettings = { provider: 'ollama' | 'openai'; apiKey: string; model: string; };

const MainInterface = () => {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "I'm ready. I can see your screen.", sender: 'ai' }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [config, setConfig] = useState<AppSettings>(() => ({
    provider: (localStorage.getItem('provider') as any) || 'ollama',
    apiKey: localStorage.getItem('apiKey') || '',
    model: localStorage.getItem('model') || 'llama3.2-vision'
  }));

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (text: string, sender: 'user' | 'ai') => {
    setMessages(prev => [...prev, { id: Date.now(), text, sender }]);
  };

  const saveSettings = () => {
    localStorage.setItem('provider', config.provider);
    localStorage.setItem('apiKey', config.apiKey);
    localStorage.setItem('model', config.model);
    setShowSettings(false);
    addMessage("Settings updated.", "ai");
  };

  const quitApplication = () => {
    if (window.electronAPI && window.electronAPI.quitApp) {
      window.electronAPI.quitApp();
    }
  };

  const callAI = async (prompt: string, imageBase64: string | null) => {
    setIsLoading(true);
    try {
      let url, body, headers: any = { 'Content-Type': 'application/json' };

      if (config.provider === 'ollama') {
        url = 'http://localhost:11434/api/generate';
        body = {
          model: config.model,
          prompt,
          stream: false,
          images: imageBase64 ? [imageBase64] : undefined
        };
      } else {
        url = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${config.apiKey}`;
        const content: any[] = [{ type: "text", text: prompt }];
        if (imageBase64) {
          content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } });
        }
        body = { model: config.model, messages: [{ role: "user", content }] };
      }

      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error.message || data.error);

      const responseText = config.provider === 'ollama' ? data.response : data.choices[0].message.content;
      addMessage(responseText.replace(/\n/g, '<br/>'), 'ai');

    } catch (e: any) {
      addMessage(`Error: ${e.message}`, 'ai');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = async () => {
    if (isLoading) return;
    addMessage("Scanning screen...", "user");
    try {
      const dataURL = await window.electronAPI.captureScreen();
      const base64 = dataURL.split(',')[1];
      const prompt = input || "What is on this screen?";
      setInput("");
      addMessage("Thinking...", "ai");
      await callAI(prompt, base64);
    } catch (e: any) {
      addMessage(`Capture Error: ${e.message}`, 'ai');
    }
  };

  const handleSend = async () => {
    if (!input || isLoading) return;
    const txt = input;
    setInput("");
    addMessage(txt, "user");
    addMessage("...", "ai");
    await callAI(txt, null);
  };

  return (
    <div className="app-container">
      <div className="header">
        <span className="brand">INVISEBLE</span>
        <button className="icon-btn" onClick={() => setShowSettings(true)}>
          <Settings size={16} />
        </button>
      </div>

      <div className="chat-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.sender}`}>
             <div dangerouslySetInnerHTML={{ __html: msg.text }} />
          </div>
        ))}
        {isLoading && <div className="message ai">...</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="command-bar-container">
        <div className="command-bar">
          <button className="eye-btn" onClick={handleCapture} disabled={isLoading} title="See Screen">
            <Eye size={18} />
          </button>
          <input 
            type="text" 
            placeholder="Ask AI..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button className="send-btn" onClick={handleSend} disabled={!input}>
            <ArrowUp size={18} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-overlay">
          <div className="settings-header">
            <span className="settings-title">Configuration</span>
            <button className="icon-btn" onClick={() => setShowSettings(false)}><X size={18}/></button>
          </div>
          
          <div className="setting-group">
            <label>Provider</label>
            <select 
              className="setting-input"
              value={config.provider} 
              onChange={(e) => setConfig({...config, provider: e.target.value as any})}
            >
              <option value="ollama">Local (Ollama)</option>
              <option value="openai">Cloud (OpenAI / Groq)</option>
            </select>
          </div>

          {config.provider === 'openai' && (
            <div className="setting-group">
              <label>API Key</label>
              <input 
                className="setting-input"
                type="password" 
                value={config.apiKey}
                onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                placeholder="sk-..." 
              />
            </div>
          )}

          <div className="setting-group">
            <label>Model Name</label>
            <input 
              className="setting-input"
              type="text" 
              value={config.model}
              onChange={(e) => setConfig({...config, model: e.target.value})}
            />
          </div>

          <button className="save-btn" onClick={saveSettings}>Save Changes</button>
          
          <button className="quit-btn" onClick={quitApplication}>
            <Power size={14} /> Quit Application
          </button>
        </div>
      )}
    </div>
  );
};

export default MainInterface;