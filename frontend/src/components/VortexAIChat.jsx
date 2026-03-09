import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Send, User, Loader2, Plus, Mic, ChevronUp, ArrowRight, Sparkles, Zap, Brain } from 'lucide-react';

const GEMINI_API_KEY = 'gen-lang-client-0804196204';

const SYSTEM_CONTEXT = `You are Vortex Prime UI, the built-in assistant for Vortex Prime EMU — an Xbox 360 emulator frontend powered by Xenia. 
You help users with: game compatibility, emulator settings, ROM management, troubleshooting, and general gaming questions.
Be concise, friendly, and knowledgeable about Xbox 360 games and emulation.`;

const VortexAIChat = forwardRef((props, ref) => {
  const [userName, setUserName] = useState(() => localStorage.getItem('vortex_user_name') || '');
  const [messages, setMessages] = useState(() => {
    const savedName = localStorage.getItem('vortex_user_name');
    if (savedName) {
      return [{
        role: 'assistant',
        content: `Hey there, **${savedName}**! How can I help you today?`,
        id: Date.now(),
      }];
    }
    return [{
      role: 'assistant',
      content: "Hey,there user! Welcome to **Vortex Prime Emu!!!**. What's your name? So we can get started!!!",
      id: Date.now(),
    }];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState('fast'); // 'fast' | 'planning'
  const [selectedModel, setSelectedModel] = useState('Gemini 1.5 Flash (Free)');
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const abortRef = useRef(null);
  const recognitionRef = useRef(null);

  useImperativeHandle(ref, () => ({
    clearChat
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.mode-menu-container')) setIsModeMenuOpen(false);
      if (!e.target.closest('.model-menu-container')) setIsModelMenuOpen(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    
    // Initialize Web Speech API
    if (window.webkitSpeechRecognition || window.SpeechRecognition) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + transcript);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
    }
  }, []);

  const buildHistory = useCallback((msgs) => {
    const history = [];
    for (const msg of msgs) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        history.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }
    return history;
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { role: 'user', content: text, id: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Capture name if not already set
    if (!userName) {
      localStorage.setItem('vortex_user_name', text);
      setUserName(text);

      const assistantId = Date.now() + 1;
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Hey there, **${text}**! How can I help you today?`,
          id: assistantId,
          streaming: false
        }]);
        setIsLoading(false);
      }, 600);
      return;
    }

    const assistantId = Date.now() + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId, streaming: true }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const history = buildHistory(newMessages.slice(0, -1)); // exclude current user msg

      const modelMap = {
        'Gemini 1.5 Flash (Free)': 'gemini-1.5-flash',
        'Gemini 3 Flash': 'gemini-1.5-flash',
        'Gemini 3.1 Pro (High)': 'gemini-1.5-pro',
        'Gemini 3.1 Pro (Low)': 'gemini-1.5-pro',
        'Claude Sonnet 4.6 (Thinking)': 'gemini-1.5-pro',
        'Claude Opus 4.6 (Thinking)': 'gemini-1.5-pro',
        'GPT-OSS 120B (Medium)': 'gemini-1.5-pro'
      };
      const apiModel = modelMap[selectedModel] || 'gemini-1.5-flash';
      const dynamicUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:generateContent?key=${GEMINI_API_KEY}`;

      const response = await fetch(dynamicUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_CONTEXT }] },
          contents: [
            ...history,
            { role: 'user', parts: [{ text }] }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err?.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response received.';

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: reply, streaming: false } : m
      ));
    } catch (err) {
      if (err.name === 'AbortError') return;
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `⚠️ Error: ${err.message}`, streaming: false, error: true }
          : m
      ));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, messages, buildHistory, selectedModel]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
      }
    }
  };

  const handleFileClick = () => {
    fileRef.current?.click();
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      alert(`Selected file: ${file.name}\n(In a real implementation, this would be uploaded to the AI context)`);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setIsLoading(false);
    const savedName = localStorage.getItem('vortex_user_name');
    setMessages([{
      role: 'assistant',
      content: savedName
        ? `Chat cleared! How can I help you today, **${savedName}**?`
        : "Welcome to **Vortex Prime Emulator**. What's your name? So we can get started!!!",
      id: Date.now(),
    }]);
  };

  const renderContent = (text) => {
    // Simple markdown: bold, code, line breaks
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.15);padding:3px 6px;border-radius:4px;font-family:monospace;font-size:0.95em;color:#90C31D">$1</code>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'transparent',
      fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif",
    }}>
      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(144,195,29,0.3) transparent',
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              animation: 'fadeSlideIn 0.2s ease',
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 100,
              height: 100,
              borderRadius: '16px',
              background: msg.role === 'user'
                ? 'rgba(144,195,29,0.35)'
                : 'rgba(255,255,255,0.12)',
              border: msg.role === 'user'
                ? '3px solid rgba(144,195,29,0.7)'
                : '3px solid rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 8px 16px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              transition: 'transform 0.3s ease',
            }}>
              {msg.role === 'user'
                ? <User size={48} color="#90C31D" />
                : <img
                  src="/assets/AppIcon/icon.png"
                  style={{
                    width: 90,
                    height: 90,
                    objectFit: 'contain',
                    imageRendering: 'auto'
                  }}
                  alt=""
                />
              }
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: '85%',
              padding: '16px 24px',
              borderRadius: msg.role === 'user' ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
              background: msg.role === 'user'
                ? 'rgba(144,195,29,0.22)'
                : msg.error
                  ? 'rgba(244,67,54,0.18)'
                  : 'rgba(255,255,255,0.1)',
              border: msg.role === 'user'
                ? '2px solid rgba(144,195,29,0.6)'
                : msg.error
                  ? '2px solid rgba(244,67,54,0.4)'
                  : '2px solid rgba(255,255,255,0.2)',
              color: msg.error ? '#ff8a80' : '#ffffff',
              fontSize: '1.2rem',
              fontWeight: '600',
              lineHeight: 1.5,
              backdropFilter: 'blur(20px)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}>
              {msg.streaming && !msg.content ? (
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '2px 0' }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: 'rgba(144,195,29,0.7)',
                      animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
                    }} />
                  ))}
                </div>
              ) : (
                <span dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }} />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 20px 24px',
        background: 'transparent',
        position: 'relative',
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '28px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(30px)',
          padding: '8px 16px 12px',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything."
            rows={1}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              padding: '12px 0 8px',
              color: '#ffffff',
              fontSize: '1.15rem',
              resize: 'none',
              outline: 'none',
              fontFamily: "'Segoe UI', system-ui, sans-serif",
              lineHeight: 1.5,
              maxHeight: 250,
              overflowY: 'auto',
            }}
            onInput={e => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '4px',
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Plus Button */}
              <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={onFileChange} />
              <button
                onClick={handleFileClick}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Plus size={20} />
              </button>

              {/* Mode Selector */}
              <div style={{ position: 'relative' }} className="mode-menu-container">
                <button
                  onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                >
                  <ChevronUp size={14} />
                  <span style={{ textTransform: 'capitalize' }}>{mode}</span>
                </button>

                {isModeMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '12px',
                    width: '320px',
                    background: 'rgb(24, 24, 24)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '8px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                    zIndex: 1000,
                    animation: 'menuIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}>
                    <div style={{ padding: '8px 12px 12px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Conversation mode</div>
                    
                    <button
                      onClick={() => { setMode('planning'); setIsModeMenuOpen(false); }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px',
                        borderRadius: '12px',
                        border: 'none',
                        background: mode === 'planning' ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                        <Brain size={16} /> Planning
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: '400' }}>
                        Agent can plan before executing tasks. Use for deep research, complex tasks, or collaborative work
                      </div>
                    </button>

                    <button
                      onClick={() => { setMode('fast'); setIsModeMenuOpen(false); }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '12px',
                        borderRadius: '12px',
                        border: 'none',
                        background: mode === 'fast' ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        marginTop: '4px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                        <Zap size={16} /> Fast
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', fontWeight: '400' }}>
                        Agent will execute tasks directly. Use for simple tasks that can be completed faster
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Model Selector */}
              <div style={{ position: 'relative' }} className="model-menu-container">
                <button
                  onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                >
                  <ChevronUp size={14} />
                  <span>{selectedModel}</span>
                </button>

                {isModelMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '12px',
                    width: '240px',
                    background: 'rgb(24, 24, 24)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '16px',
                    padding: '8px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                    zIndex: 1000,
                    animation: 'menuIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}>
                    <div style={{ padding: '8px 12px 12px', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Available Models</div>
                    
                    {[
                      { name: 'Gemini 3.1 Pro (High)', new: true },
                      { name: 'Gemini 3.1 Pro (Low)', new: true },
                      { name: 'Gemini 3 Flash' },
                      { name: 'Claude Sonnet 4.6 (Thinking)' },
                      { name: 'Claude Opus 4.6 (Thinking)' },
                      { name: 'GPT-OSS 120B (Medium)' },
                      { name: 'Gemini 1.5 Flash (Free)' }
                    ].map(m => (
                      <button
                        key={m.name}
                        onClick={() => { setSelectedModel(m.name); setIsModelMenuOpen(false); }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 12px',
                          borderRadius: '12px',
                          border: 'none',
                          background: selectedModel === m.name ? 'rgba(255,255,255,0.08)' : 'transparent',
                          color: 'white',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: '500',
                          position: 'relative',
                        }}
                      >
                        <Sparkles size={14} style={{ color: '#90C31D' }} /> 
                        <span>{m.name}</span>
                        {m.new && (
                          <span style={{
                            marginLeft: 'auto',
                            background: 'rgba(255,255,255,0.1)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.6)',
                            fontWeight: '600'
                          }}>New</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Voice Button */}
              <button
                onClick={toggleVoice}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  background: isListening ? 'rgba(144,195,29,0.2)' : 'transparent',
                  color: isListening ? '#90C31D' : 'rgba(255,255,255,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
                onMouseEnter={e => !isListening && (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                onMouseLeave={e => !isListening && (e.currentTarget.style.background = 'transparent')}
              >
                <Mic size={20} />
                {isListening && (
                  <div style={{
                    position: 'absolute',
                    top: -2,
                    left: -2,
                    right: -2,
                    bottom: -2,
                    borderRadius: '50%',
                    border: '2px solid #90C31D',
                    animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
                  }} />
                )}
              </button>

              {/* Send Button */}
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                style={{
                  width: 40,
                  height: 40,
                  background: input.trim() && !isLoading
                    ? '#ffffff'
                    : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  cursor: input.trim() && !isLoading ? 'pointer' : 'default',
                  color: input.trim() && !isLoading ? '#000' : 'rgba(255,255,255,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  flexShrink: 0,
                }}
              >
                {isLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <ArrowRight size={20} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes menuIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
});

export default VortexAIChat;
