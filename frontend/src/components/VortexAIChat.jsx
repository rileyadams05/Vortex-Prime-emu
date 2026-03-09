import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Send, User, Loader2 } from 'lucide-react';

const GEMINI_API_KEY = 'gen-lang-client-0804196204';
const GEMINI_MODEL = 'gemini-1.5-flash';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const SYSTEM_CONTEXT = `You are Vortex AI, the built-in assistant for Vortex Prime EMU — an Xbox 360 emulator frontend powered by Xenia. 
You help users with: game compatibility, emulator settings, ROM management, troubleshooting, and general gaming questions.
Be concise, friendly, and knowledgeable about Xbox 360 games and emulation.`;

const VortexAIChat = forwardRef((props, ref) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey! I'm **Vortex AI** — your built-in gaming assistant. Ask me anything about Xbox 360 games, Xenia settings, or game compatibility.",
      id: Date.now(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  
  useImperativeHandle(ref, () => ({
    clearChat
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
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

    const assistantId = Date.now() + 1;
    setMessages(prev => [...prev, { role: 'assistant', content: '', id: assistantId, streaming: true }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const history = buildHistory(newMessages.slice(0, -1)); // exclude current user msg

      const response = await fetch(API_URL, {
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
  }, [input, isLoading, messages, buildHistory]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setIsLoading(false);
    setMessages([{
      role: 'assistant',
      content: "Chat cleared! I'm Vortex AI — ready to help with your Xbox 360 gaming questions.",
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
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: msg.role === 'user'
                ? 'rgba(144,195,29,0.3)'
                : 'rgba(255,255,255,0.1)',
              border: msg.role === 'user'
                ? '2px solid rgba(144,195,29,0.6)'
                : '2px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
              overflow: 'hidden'
            }}>
              {msg.role === 'user'
                ? <User size={32} color="#90C31D" />
                : <img src="/assets/AppIcon/icon.png" style={{ width: 56, height: 56, objectFit: 'contain' }} alt="" />
              }
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: '85%',
              padding: '12px 20px',
              borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
              background: msg.role === 'user'
                ? 'rgba(144,195,29,0.2)'
                : msg.error
                  ? 'rgba(244,67,54,0.15)'
                  : 'rgba(255,255,255,0.08)',
              border: msg.role === 'user'
                ? '1px solid rgba(144,195,29,0.5)'
                : msg.error
                  ? '1px solid rgba(244,67,54,0.3)'
                  : '1px solid rgba(255,255,255,0.15)',
              color: msg.error ? '#ff8a80' : '#ffffff',
              fontSize: '1.05rem',
              fontWeight: '500',
              lineHeight: 1.6,
              backdropFilter: 'blur(16px)',
              boxShadow: '0 6px 15px rgba(0,0,0,0.4)',
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
        padding: '10px 12px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end',
        background: 'rgba(0,0,0,0.15)',
      }}>


        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about games, compatibility, settings..."
          rows={1}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 10,
            padding: '8px 12px',
            color: '#ffffff',
            fontSize: '0.92rem',
            resize: 'none',
            outline: 'none',
            fontFamily: "'Segoe UI', sans-serif",
            lineHeight: 1.4,
            maxHeight: 80,
            overflowY: 'auto',
            transition: 'border-color 0.2s',
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(144,195,29,0.5)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
          }}
        />

        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          style={{
            background: input.trim() && !isLoading
              ? 'rgba(144,195,29,0.85)'
              : 'rgba(255,255,255,0.06)',
            border: '1px solid ' + (input.trim() && !isLoading ? 'rgba(144,195,29,0.6)' : 'rgba(255,255,255,0.1)'),
            borderRadius: 10,
            padding: '7px 10px',
            cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
            color: input.trim() && !isLoading ? '#0a1a00' : 'rgba(255,255,255,0.25)',
            display: 'flex',
            alignItems: 'center',
            transition: 'all 0.2s',
            flexShrink: 0,
          }}
        >
          {isLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
        </button>
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
      `}</style>
    </div>
  );
});

export default VortexAIChat;
