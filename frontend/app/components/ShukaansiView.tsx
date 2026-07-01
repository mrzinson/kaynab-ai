"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

/* ─────────────────── types ─────────────────── */
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  status?: 'thinking' | 'streaming' | 'complete' | 'generating_image';
  timestamp?: string;
}

interface ShukaansiViewProps {
  onOpenSidebar: () => void;
  onBack?: () => void;
}

/* ─────────────────── icon helpers ─────────────────── */
const IconHamburger = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#10B981" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconNav = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
);
const IconSend = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
);
const IconMic = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
  </svg>
);
const IconHeart = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white animate-pulse">
    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
  </svg>
);

function renderMarkdown(text: string) {
  if (!text) return '';
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
  formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-xs font-mono text-pink-300">$1</code>');
  return formatted.split('\n').join('<br />');
}

export default function ShukaansiView({ onOpenSidebar, onBack }: ShukaansiViewProps) {
  const { language } = useTheme();

  const [messages,         setMessages]         = useState<Message[]>([]);
  const [inputText,        setInputText]        = useState('');
  const [isAiTyping,       setIsAiTyping]       = useState(false);
  const [thinkingStatus,   setThinkingStatus]   = useState('Fikiraya…');
  const [coins,            setCoins]            = useState<number | null>(null);
  const [deductRate,       setDeductRate]       = useState<number>(1);
  const [userData,         setUserData]         = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const FREE_TEXT_LIMIT = 10;
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const activeXhr       = useRef<XMLHttpRequest | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages, isAiTyping]);

  useEffect(() => {
    const cachedText = language === 'so'
      ? "Kusoo dhawoow! Anigu waxaan ahay 'My Love'. Maxaan kaa caawin karaa maanta?"
      : "Welcome! I am 'My Love'. How can I help you today?";

    let uId = 'guest';
    const cachedUser = localStorage.getItem('userData');
    if (cachedUser) {
      const parsed = JSON.parse(cachedUser);
      uId = parsed.id?.toString() || 'guest';
      setUserData(parsed);
    }

    const cached = localStorage.getItem(`shukaansi_chat_messages_${uId}`);
    if (cached) {
      setMessages(JSON.parse(cached));
    } else {
      setMessages([{ id: '1', text: cachedText, sender: 'ai', timestamp: new Date().toISOString() }]);
    }

    const syncHistory = async () => {
      const token = localStorage.getItem('userToken');
      if (!token) return;
      try {
        const res = await fetch(`https://darkpen-backend.onrender.com/api/chat/shukaansi-history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            const mapped: Message[] = data.messages.map((m: any) => ({
              id: m.id.toString(),
              text: m.message || m.text || '',
              sender: m.sender,
              timestamp: m.created_at || new Date().toISOString()
            }));
            setMessages(mapped);
            localStorage.setItem(`shukaansi_chat_messages_${uId}`, JSON.stringify(mapped));
          }
        }
      } catch {}
    };

    syncHistory();
    fetchShukaansiProfile();

    return () => { if (activeXhr.current) activeXhr.current.abort(); };
  }, [language]); // eslint-disable-line

  const fetchShukaansiProfile = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) return;
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/chat/shukaansi-profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.profile) {
        setCoins(data.profile.balance || 0);
        setDeductRate(data.profile.deduct_rate || 1);
      }
    } catch {}
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAiTyping) return;

    const userText = inputText.trim();
    setInputText('');
    setIsAiTyping(true);

    const newUserMsg: Message = { id: Date.now().toString(), text: userText, sender: 'user', timestamp: new Date().toISOString() };
    const aiMsgId = (Date.now() + 1).toString();
    const newAiMsg: Message = { id: aiMsgId, text: '', sender: 'ai', status: 'thinking', timestamp: new Date().toISOString() };

    setMessages(prev => [...prev, newUserMsg, newAiMsg]);
    setThinkingStatus('Fikiraya…');

    try {
      const token = localStorage.getItem('userToken');
      const sendRequest = (isRetry = false) => {
        if (isRetry) setThinkingStatus('Server-ka ayaa toosaya…');
        const xhr = new XMLHttpRequest();
        activeXhr.current = xhr;
        xhr.open('POST', `https://darkpen-backend.onrender.com/api/chat/ask`);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        let accumulatedText = "";
        let offset = 0;

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 3 || xhr.readyState === 4) {
            const responseText = xhr.responseText;
            const chunk = responseText.substring(offset);
            offset = responseText.length;

            if (chunk) {
              const lines = chunk.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                  const dataStr = trimmed.slice(6).trim();
                  if (dataStr === '[DONE]') break;
                  try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.text) {
                      accumulatedText += parsed.text;
                      setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                        ...m, text: accumulatedText,
                        status: parsed.status === 'complete' ? 'complete' : 'streaming'
                      } : m));
                    }
                  } catch {}
                }
              }
            }

            if (xhr.readyState === 4) {
              activeXhr.current = null;
              if (xhr.status >= 400) {
                let errText = "Cilad ayaa dhacday. Mar kale isku day.";
                let isFreeTrialError = false;
                try {
                  const j = JSON.parse(xhr.responseText);
                  errText = j.message || errText;
                  if (j.freeTrialExhausted || j.error === 'free_trial_exhausted') {
                    isFreeTrialError = true;
                  }
                } catch {}
                if (isFreeTrialError) {
                  setMessages(prev => prev.filter(m => m.id !== aiMsgId));
                  setShowPaymentModal(true);
                } else {
                  setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: errText, status: 'complete' } : m));
                }
                setIsAiTyping(false);
              } else if (!accumulatedText && !isRetry) {
                setThinkingStatus('Server toosaya, sabar yar…');
                setTimeout(() => sendRequest(true), 3000);
              } else {
                setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                  ...m, text: accumulatedText || m.text || "Jawaab ma jiro.", status: 'complete'
                } : m));
                fetchShukaansiProfile();
                setIsAiTyping(false);
              }
              // save local
              let uId = 'guest';
              try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId = String(u.id); } catch {}
              setMessages(cur => { localStorage.setItem(`shukaansi_chat_messages_${uId}`, JSON.stringify(cur)); return cur; });
            }
          }
        };

        xhr.send(JSON.stringify({
          message: userText, chatType: 'shukaansi', stream: true, sessionId: `shukaansi_${Date.now()}`
        }));
      };

      sendRequest();
    } catch {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: 'Cilad dhinaca internet-ka ah.', status: 'complete' } : m));
      setIsAiTyping(false);
    }
  };

  const glassBtn = "flex items-center justify-center rounded-full transition-all active:scale-90 select-none";

  const clearHistory = async () => {
    if (!window.confirm('Taariikhda tirtirta?')) return;
    const token = localStorage.getItem('userToken');
    let uId = 'guest';
    try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId = String(u.id); } catch {}
    try {
      await fetch('https://darkpen-backend.onrender.com/api/chat/history/clear', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ chatType: 'shukaansi' }),
      });
    } catch {}
    setMessages([]);
    localStorage.removeItem(`shukaansi_chat_messages_${uId}`);
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col relative select-none overflow-hidden" style={{ background: '#090B10' }}>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border" style={{ background: '#0D0C22', borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="relative h-28 bg-gradient-to-br from-pink-600 via-rose-500 to-pink-700 flex flex-col items-center justify-center gap-1.5">
              <IconHeart />
              <span className="text-white font-black text-sm tracking-wider uppercase">Free Trial-ku wuu Dhammaaday</span>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4">
              <p className="text-center text-white/80 font-bold text-xs leading-relaxed">
                Fariimaha bilaashka ah ee Shukaansiga ({FREE_TEXT_LIMIT}) wuu ka dhammaaday akoonkaaga.
              </p>
              <div className="rounded-2xl p-4 flex flex-col gap-2 border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                <div className="flex items-center justify-between text-xs"><span className="font-bold text-white/60">📅 Monthly Basic</span><span className="text-pink-400 font-black">$3 / 30 Maalmood</span></div>
                <div className="flex items-center justify-between text-xs"><span className="font-bold text-white/60">⭐ Monthly Premium</span><span className="text-pink-400 font-black">$11 / 30 Maalmood</span></div>
                <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <p className="text-[10px] text-white/40 text-center leading-relaxed">💳 EVC Plus/eDahab: <span className="font-bold text-white/70">637930329</span><br />📸 WhatsApp: <span className="font-bold text-white/70">+252637930329</span></p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white/40 hover:text-white/80 hover:bg-white/5 transition-all">
                  Khaas
                </button>
                <a href="https://wa.me/252637930329?text=Waxaan%20rabaa%20inaan%20iibsado%20Darkpen%20Shukaansi%20subscription" target="_blank" rel="noopener noreferrer"
                  className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-600 text-white font-black text-xs text-center shadow-lg active:scale-95 transition-all flex items-center justify-center">
                  💰 Lacag ku Shubo
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HEADER — matches mockup 5 style */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-[#0E1118]" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Left: circular hamburger + pill name */}
        <div className="flex items-center gap-3">
          <button onClick={onOpenSidebar} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border transition-all active:scale-95" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <IconHamburger />
          </button>

          {/* Pill name badge */}
          <div className="px-5 py-1.5 rounded-full bg-[#161B22] border flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="text-white font-bold text-sm tracking-wide select-none">Gacalo</span>
          </div>
        </div>

        {/* Right: coins badge + combined pill */}
        <div className="flex items-center gap-3">
          {coins !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/70 text-[10px] font-black border" style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.08)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-pink-400 inline-block" />
              {coins}
            </div>
          )}

          {/* Unified combined pill */}
          <div className="flex items-center rounded-full bg-white/5 border px-1 py-1" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <button onClick={clearHistory} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-rose-400 hover:bg-white/5 transition-all active:scale-90" title="Clear history">
              <IconTrash />
            </button>
            <div className="w-[1px] h-4 bg-white/20 mx-1" />
            <button onClick={onBack || onOpenSidebar} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-pink-400 hover:bg-white/5 transition-all active:scale-90" title="Back / Menu">
              <IconNav />
            </button>
          </div>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 relative">
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          const prevMsg = index > 0 ? messages[index - 1] : null;
          const showQuote = !isUser && prevMsg && prevMsg.sender === 'user' && prevMsg.text;

          return (
            <div key={msg.id} className={`dp-fade-up flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[82%] flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}>
                
                {showQuote && (
                  <div className="border-l-3 border-pink-500 px-2.5 py-1.5 rounded-r-lg text-[11px] text-left text-white/50 select-none max-w-[90%] mb-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)', borderLeft: '3px solid #EC4899' }}>
                    <span className="font-extrabold text-pink-400 block text-[9px] uppercase">Adiga</span>
                    <span className="block mt-0.5 truncate">{prevMsg.text}</span>
                  </div>
                )}

                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${isUser ? 'rounded-tr-sm text-white' : 'rounded-tl-sm text-white/90 bg-white/4'}`}
                  style={isUser ? { background: 'linear-gradient(135deg,#E5436F,#F05C8A)', boxShadow: '0 4px 18px rgba(229,67,111,0.3)' } : { border: '1px solid rgba(255,255,255,0.06)' }}>
                  
                  {!isUser && msg.status === 'thinking' ? (
                    <div className="flex items-center gap-2 py-0.5 select-none">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                      <span className="text-[10px] text-white/30 font-medium ml-0.5">{thinkingStatus}</span>
                    </div>
                  ) : (
                    <div className="markdown-content select-text" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="shrink-0 px-4 pb-5 pt-3 relative" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <form onSubmit={handleSend} className="flex items-center gap-2.5">
          <input
            type="text"
            placeholder={language === 'so' ? "U dir farriin My Love..." : "Message My Love..."}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            disabled={isAiTyping}
            className="flex-1 min-w-0 text-sm text-white placeholder-white/20 focus:outline-none bg-transparent"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '999px',
              padding: '10px 18px',
            }}
          />

          {inputText.trim() === '' ? (
            <button type="button" onClick={() => alert('Duubista codku hadda ma shaqaynayo.')}
              className={`${glassBtn} w-10 h-10 text-white/80 bg-white/5 hover:bg-white/10`}
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <IconMic />
            </button>
          ) : (
            <button type="submit" disabled={isAiTyping}
              className={`${glassBtn} w-10 h-10 text-white transition-all disabled:opacity-40 hover:scale-105`}
              style={{ background: 'linear-gradient(135deg,#E5436F,#F05C8A)', boxShadow: '0 4px 16px rgba(229,67,111,0.4)', border: '1px solid rgba(240,92,138,0.5)' }}>
              <IconSend />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
