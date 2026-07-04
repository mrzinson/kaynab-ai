"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

/* ─────────────────── types ─────────────────── */
interface Source {
  title: string;
  url: string;
  domain: string;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  status?: 'thinking' | 'streaming' | 'complete' | 'generating_image';
  image?: string;
  images?: string[];   // base64 data-URLs
  timestamp?: string;
  sources?: Source[];
}

interface Attachment {
  dataUrl: string;
  base64: string;
  mimeType: string;
  name: string;
  isDocument?: boolean;
}

interface ChatViewProps {
  onOpenLeftSidebar: () => void;
  onOpenNavPanel:    () => void;
  onBack?:           () => void;
}

/* ─────────────────── markdown renderer ─────────────────── */
function ensureTableTags(text: string): string {
  if (!text) return text;
  let cleaned = text.replace(/<\/?table_data>/gi, '');
  const lines = cleaned.split('\n');
  const out: string[] = [];
  let cur: string[] = [];

  const isTableLine = (l: string) => {
    const t = l.trim();
    return t.includes('|') && !t.startsWith('```') && !t.startsWith('<');
  };
  const isRealTable = (block: string[]) => {
    if (block.length < 2) return false;
    const first = block[0].split('|').length - 1;
    return first >= 1 && block.every(l => (l.split('|').length - 1) === first && l.length < 180);
  };

  for (const line of lines) {
    if (isTableLine(line)) { cur.push(line); }
    else {
      if (cur.length) {
        if (isRealTable(cur)) { out.push('<table_data>', ...cur, '</table_data>'); }
        else out.push(...cur);
        cur = [];
      }
      out.push(line);
    }
  }
  if (cur.length) {
    if (isRealTable(cur)) out.push('<table_data>', ...cur, '</table_data>');
    else out.push(...cur);
  }
  return out.join('\n');
}

function renderMarkdown(text: string): string {
  if (!text) return '';
  const tagged = ensureTableTags(text);

  let processed = tagged.replace(/<table_data>([\s\S]*?)<\/table_data>/gi, (_, inner) => {
    const rows = inner.trim().split('\n').filter((r: string) => r.trim());
    if (!rows.length) return '';
    const tableRows = rows.map((row: string, rIdx: number) => {
      let clean = row.trim();
      if (clean.startsWith('|')) clean = clean.slice(1);
      if (clean.endsWith('|'))   clean = clean.slice(0, -1);
      const cols = clean.split('|');
      const isH = rIdx === 0;
      const cells = cols.map((col: string, cIdx: number) => {
        const cls = isH
          ? 'px-3 py-2 text-xs font-bold text-left text-white bg-white/10 border-r border-white/10 last:border-r-0'
          : cIdx === 0
            ? 'px-3 py-2 text-xs font-semibold text-left text-blue-400 border-r border-white/8 last:border-r-0'
            : 'px-3 py-2 text-xs text-left text-white/80 border-r border-white/8 last:border-r-0';
        return `<td class="${cls}">${col.trim()}</td>`;
      }).join('');
      const rowCls = isH ? '' : rIdx % 2 === 0 ? 'bg-white/4' : 'bg-white/2';
      return `<tr class="${rowCls} border-b border-white/8 last:border-b-0">${cells}</tr>`;
    }).join('');
    return `<div class="my-3 rounded-xl overflow-hidden border border-white/12 shadow-sm"><table class="w-full border-collapse">${tableRows}</table></div>`;
  });

  let out = processed
    .replace(/<green>(.*?)<\/green>/gi, '<span class="text-blue-400 font-bold">$1</span>')
    .replace(/<red>(.*?)<\/red>/gi,     '<span class="text-rose-400 font-bold">$1</span>')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-black/40 rounded-xl p-3 my-2 text-xs font-mono text-blue-300 overflow-x-auto leading-relaxed border border-white/8">$1</pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono text-blue-350">$1</code>')
    .replace(/\[(\d+)\]/g, '<a href="#source-$1" class="text-blue-400 hover:underline text-xs ml-0.5 inline-block bg-blue-500/10 px-1 rounded">[$1]</a>');

  const lines = out.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('- ') || t.startsWith('* '))
      result.push(`<div class="flex gap-2 my-0.5"><span class="text-blue-400 mt-0.5 shrink-0">•</span><span>${t.slice(2)}</span></div>`);
    else if (t === '')
      result.push('<div class="h-1.5"></div>');
    else
      result.push(`<div>${line}</div>`);
  }
  return result.join('');
}

/* ─────────────────── Icons ─────────────────── */
const IconSend = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
  </svg>
);
const IconMic = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
  </svg>
);
const IconFile = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);
const IconGlob = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-.778.099-1.533.284-2.253" />
  </svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const IconHamburger = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#3B82F6" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
  </svg>
);
const IconNav = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-gray-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
);
const IconCopy = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
  </svg>
);

/* ─────────────────── main component ─────────────────── */
export default function ChatView({ onOpenLeftSidebar, onOpenNavPanel }: ChatViewProps) {
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [inputText,      setInputText]      = useState('');
  const [isAiTyping,     setIsAiTyping]     = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('Researching the web…');
  const [sessionId,      setSessionId]      = useState('');
  const [attachments,    setAttachments]    = useState<Attachment[]>([]);
  const [credits,        setCredits]        = useState<number | null>(null);
  const [isRecording,    setIsRecording]    = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copiedId,       setCopiedId]       = useState<string | null>(null);
  
  // Custom global research states
  const [focusMode,      setFocusMode]      = useState<'all' | 'academic' | 'writing'>('all');
  const [viewMode,       setViewMode]       = useState<'chat' | 'graph'>('chat');
  const [selectedNode,   setSelectedNode]   = useState<any>(null);

  const fileInputRef  = useRef<HTMLInputElement>(null);
  const messagesEnd  = useRef<HTMLDivElement>(null);

  const scrollBottom = () => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollBottom(); }, [messages, isAiTyping]);

  /* ── load messages ── */
  useEffect(() => {
    let uId = 'guest';
    try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId = String(u.id); } catch {}

    let sid = localStorage.getItem(`active_session_id_${uId}`);
    if (!sid) { sid = `chat_${Date.now()}_${Math.random().toString(36).slice(7)}`; localStorage.setItem(`active_session_id_${uId}`, sid); }
    setSessionId(sid);

    const welcome: Message = {
      id: '1',
      text: 'Where knowledge begins. Ask anything, upload research files, or search the live web with Perplexity Sonar grounding.',
      sender: 'ai',
      status: 'complete',
      timestamp: new Date().toISOString(),
    };

    const cached = localStorage.getItem(`education_chat_messages_${uId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setMessages(Array.isArray(parsed) && parsed.length > 0 ? parsed : [welcome]);
      } catch { setMessages([welcome]); }
    } else { setMessages([welcome]); }

    // Fetch actual credits
    const token = localStorage.getItem('userToken');
    if (token) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com';
      fetch(`${apiUrl}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user && data.user.balance !== undefined) {
          setCredits(data.user.balance);
        }
      })
      .catch(() => {});
    }
  }, []);

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachments(prev => [...prev, {
        name: file.name,
        mimeType: file.type,
        base64: (reader.result as string).split(',')[1],
        dataUrl: reader.result as string,
        isDocument: true
      }]);
    };
    reader.readAsDataURL(file);
  };

  const fetchCredits = () => {
    const token = localStorage.getItem('userToken');
    if (token) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com';
      fetch(`${apiUrl}/api/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user && data.user.balance !== undefined) {
          setCredits(data.user.balance);
        }
      })
      .catch(() => {});
    }
  };

  /* ── send message ── */
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const userText = inputText.trim();
    if (!userText && !attachments.length) return;
    if (isAiTyping) return;

    setIsAiTyping(true);
    setInputText('');
    const curAttach = [...attachments];
    setAttachments([]);

    const userMsg: Message = {
      id: Date.now().toString(),
      text: userMsgText(userText, curAttach),
      sender:    'user',
      images:    curAttach.length ? curAttach.map(a => a.dataUrl) : undefined,
      status:    'complete',
      timestamp: new Date().toISOString(),
    };
    const aiMsgId = (Date.now() + 1).toString();
    const aiMsg: Message = { 
      id: aiMsgId, 
      text: '', 
      sender: 'ai', 
      status: 'thinking', 
      timestamp: new Date().toISOString(),
      sources: focusMode !== 'writing' ? getMockSources(userText) : undefined
    };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setThinkingStatus('Researching the web…');

    const token = localStorage.getItem('userToken');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com';

    try {
      const response = await fetch(`${apiUrl}/api/chat/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          message: userText,
          sessionId: sessionId || null,
          stream: true,
          chatType: 'private',
          attachment: curAttach.length ? {
            name: curAttach[0].name,
            mimeType: curAttach[0].mimeType,
            base64: curAttach[0].base64
          } : null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Gelitaanka wuu fashilmay ama credits kuuma filna.');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response stream unavailable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let aiText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;

          if (cleanLine.startsWith('data: ')) {
            const dataStr = cleanLine.slice(6);
            if (dataStr === '[DONE]') {
              continue;
            }

            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.status) {
                if (data.status === 'thinking') {
                  setThinkingStatus('Analyzing results...');
                } else if (data.status === 'searching') {
                  setThinkingStatus('Searching the web...');
                }
              }
              if (data.text) {
                aiText += data.text;
                setMessages(prev => prev.map(m => m.id === aiMsgId ? {
                  ...m,
                  text: aiText,
                  status: 'complete'
                } : m));
              }
            } catch (e) {
              // Ignore partial JSON parse errors
            }
          }
        }
      }

      // Complete the typing
      setMessages(prev => prev.map(m => m.id === aiMsgId ? {
        ...m,
        status: 'complete'
      } : m));
      setIsAiTyping(false);
      fetchCredits();

      // Persist
      let uId = 'guest';
      try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId = String(u.id); } catch {}
      setMessages(cur => { localStorage.setItem(`education_chat_messages_${uId}`, JSON.stringify(cur)); return cur; });

    } catch (err: any) {
      setMessages(prev => prev.map(m => m.id === aiMsgId ? {
        ...m,
        text: err.message || 'Cilad ayaa dhacday. Fadlan mar kale isku day ama ku shubo credits.',
        status: 'complete'
      } : m));
      setIsAiTyping(false);
    }
  };

  const userMsgText = (txt: string, atts: any[]) => {
    if (atts.length) {
      return `[Grounded Chat] ${txt} (Sources: ${atts.map(a => a.name).join(', ')})`;
    }
    return txt;
  };

  const getMockSources = (query: string): Source[] => {
    return [
      { title: `Exploring ${query} - Wikipedia`, url: 'https://en.wikipedia.org', domain: 'wikipedia.org' },
      { title: `Advanced Research Paper on ${query}`, url: 'https://arxiv.org', domain: 'arxiv.org' },
      { title: `Latest updates regarding ${query}`, url: 'https://techcrunch.com', domain: 'techcrunch.com' },
    ];
  };

  const getMockAiResponse = (query: string, mode: string, files: any[]): string => {
    const hasFiles = files.length > 0;
    if (mode === 'writing') {
      return `Here is a structured draft output based on your request:\n\n**Draft:**\nYour query "${query}" has been processed directly without any external web search or grounding. Feel free to refine this draft by adding files.`;
    }
    if (hasFiles) {
      return `I have analyzed your uploaded document (**${files[0].name}**) regarding "${query}".\n\nBased *only* on the provided source text [1], the core concept is explained as a structured mechanism. There are no mentions of external topics outside the document [2].\n\nLet me know if you would like me to extract key figures or draw a concept graph!`;
    }
    return `Based on real-time web search results from Sonar [1], "${query}" is understood as a key global trend. Highly cited papers on ArXiv [2] indicate that this concept connects to several related disciplines.\n\nHere is a summary:\n- **Primary focus:** Real-time web groundings.\n- **Secondary aspects:** Direct citation references [3].\n\nI have generated an interactive **Concept Mind Map** for this query. Switch to **Graph View** in the top bar to visualize the connections.`;
  };

  /* ── clear history ── */
  const clearHistory = async () => {
    if (!window.confirm('Clear chat history?')) return;
    try {
      setMessages([{
        id: '1',
        text: 'Where knowledge begins. Ask anything, upload research files, or search the live web with Perplexity Sonar grounding.',
        sender: 'ai',
        status: 'complete',
        timestamp: new Date().toISOString(),
      }]);
      let uId = 'guest';
      try { const u = JSON.parse(localStorage.getItem('userData') || '{}'); if (u.id) uId = String(u.id); } catch {}
      localStorage.removeItem(`education_chat_messages_${uId}`);
    } catch { alert('Failed to clear history.'); }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const isEmpty = messages.length === 0 || (messages.length === 1 && messages[0].sender === 'ai' && !isAiTyping);

  // Generate Interactive Mind Map Node Data based on the last message
  const getGraphNodes = () => {
    const lastMsg = messages[messages.length - 1];
    const centerText = lastMsg && lastMsg.sender === 'user' ? lastMsg.text : 'AI Workspace';
    return [
      { id: '1', label: centerText.slice(0, 15) + '...', x: 200, y: 200, type: 'center', desc: 'Main research focus' },
      { id: '2', label: 'Web Source [1]', x: 80, y: 100, type: 'web', desc: 'Real-time grounded knowledge node from search engines.' },
      { id: '3', label: 'Academic Reference [2]', x: 320, y: 100, type: 'academic', desc: 'Peer-reviewed research and citations node.' },
      { id: '4', label: 'Core Concept A', x: 100, y: 300, type: 'concept', desc: 'Synthesized core idea extracted from conversation context.' },
      { id: '5', label: 'Core Concept B', x: 300, y: 300, type: 'concept', desc: 'Related theme connected to the primary query.' },
    ];
  };

  const graphNodes = getGraphNodes();

  return (
    <div className="flex flex-col w-full h-full select-none overflow-hidden relative bg-[#05070B]" style={{ background: '#05070B' }}>

      {/* ── HEADER ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-black/30 backdrop-blur-md" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3.5">
          <button onClick={onOpenLeftSidebar} className="w-10 h-10 rounded-full flex items-center justify-center text-white/80 bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-95 lg:hidden">
            <IconHamburger />
          </button>
          
          <div className="px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <span className="text-blue-400 font-extrabold text-xs tracking-wider uppercase select-none">Workspace</span>
          </div>

          {/* Chat vs Graph View toggler */}
          {!isEmpty && (
            <div className="flex rounded-full bg-white/5 border border-white/8 p-0.5">
              <button onClick={() => setViewMode('chat')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all duration-200 ${viewMode === 'chat' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'text-white/40 hover:text-white'}`}>
                Chat
              </button>
              <button onClick={() => setViewMode('graph')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all duration-200 ${viewMode === 'graph' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20' : 'text-white/40 hover:text-white'}`}>
                Graph Map
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {credits !== null && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white/70 text-[10px] font-black border border-white/8 bg-white/2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block animate-pulse" />
              {credits} API Credits
            </div>
          )}

          <div className="flex items-center rounded-full bg-white/5 border border-white/8 p-0.5">
            <button onClick={clearHistory} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-rose-400 hover:bg-white/5 transition-all active:scale-90" title="Clear history">
              <IconTrash />
            </button>
            <button onClick={onOpenNavPanel} className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-blue-400 hover:bg-white/5 transition-all active:scale-90 lg:hidden" title="Navigation">
              <IconNav />
            </button>
          </div>
        </div>
      </div>

      {/* ── CENTRAL CONTAINER (Split View support) ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* ── CHAT VIEW ── */}
        <div className={`flex-1 flex flex-col overflow-hidden ${viewMode === 'graph' ? 'hidden md:flex' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 relative scrollbar-none">
            {isEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none overflow-y-auto pointer-events-none">
                <div className="max-w-xl w-full flex flex-col items-center gap-6">
                  <div className="w-14 h-14 rounded-3xl flex items-center justify-center bg-gradient-to-tr from-blue-500 to-indigo-500 shadow-xl shadow-blue-500/25 animate-float pointer-events-auto">
                    <span className="text-white font-black text-lg">KB</span>
                  </div>
                  <div>
                    <h1 className="text-white text-3xl font-black tracking-tight leading-none bg-clip-text bg-gradient-to-r from-white via-white to-gray-400">Where knowledge begins.</h1>
                    <p className="text-white/40 text-sm max-w-sm mt-3 mx-auto">Ask anything, upload research files, or search the live web with citation mapping.</p>
                  </div>
                  
                  {/* Focus filters */}
                  <div className="flex gap-2 justify-center mt-2 pointer-events-auto">
                    {[
                      { id: 'all', label: '🌐 All Web', desc: 'Search all public websites' },
                      { id: 'academic', label: '🎓 Academic', desc: 'Filter peer reviewed papers' },
                      { id: 'writing', label: '✍️ Writing', desc: 'Direct writing assistance' },
                    ].map(focus => {
                      const active = focusMode === focus.id;
                      return (
                        <button key={focus.id} type="button" onClick={() => setFocusMode(focus.id as any)}
                          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all border ${active ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-[#161B22]/45 border-white/5 text-white/50 hover:text-white hover:border-white/10'}`}
                          title={focus.desc}>
                          {focus.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Render message bubbles */}
            {!isEmpty && messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div key={msg.id} className={`dp-fade-up flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  {isUser ? (
                    <div className="max-w-[82%] flex flex-col items-end gap-2">
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end">
                          {msg.images.map((src, i) => (
                            <div key={i} className="w-[130px] h-[130px] rounded-2xl overflow-hidden shadow-lg border border-blue-500/20">
                              <img src={src} alt="attachment" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.text && (
                        <div className="px-4 py-3 rounded-2xl rounded-tr-sm text-white text-sm leading-relaxed shadow-lg font-semibold bg-white/[0.04] border border-white/10">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[88%] w-full flex flex-col items-start gap-3 bg-white/[0.01] border border-white/5 rounded-2xl p-4 shadow-xl">
                      {/* Citations / Sources Block */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="w-full">
                          <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Sources</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {msg.sources.map((src, idx) => (
                              <a key={idx} href={src.url} target="_blank" rel="noreferrer" id={`source-${idx+1}`}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 transition-all text-xs text-white max-w-[200px] truncate">
                                <span className="w-4 h-4 rounded-full bg-blue-500/10 text-[9px] text-blue-400 font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                                <div className="truncate">
                                  <div className="font-semibold truncate">{src.title}</div>
                                  <div className="text-[9px] text-white/40">{src.domain}</div>
                                </div>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Thinking Status */}
                      {msg.status === 'thinking' && (
                        <div className="flex items-center gap-2 px-2 py-2">
                          {[0, 150, 300].map(d => (
                            <span key={d} className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                          ))}
                          <span className="text-xs text-white/40 font-medium ml-1">{thinkingStatus}</span>
                        </div>
                      )}

                      {/* AI Text output */}
                      {msg.text && msg.status !== 'thinking' && (
                        <div className="text-sm leading-relaxed text-white/90 select-text font-medium w-full" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                      )}

                      {msg.text && msg.status !== 'thinking' && (
                        <button onClick={() => handleCopy(msg.text, msg.id)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white/30 hover:text-white/70 text-[10px] font-bold transition-all hover:bg-white/5 mt-0.5">
                          <IconCopy />
                          {copiedId === msg.id ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEnd} />
          </div>

          {/* ── INPUT BOX ── */}
          <div className="shrink-0 px-6 pb-6 pt-3 relative bg-gradient-to-t from-black/50 to-transparent">
            {/* Attachment preview pills */}
            {attachments.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                {attachments.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                    <IconFile />
                    <span className="max-w-[120px] truncate">{att.name}</span>
                    <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-blue-400 hover:text-rose-400 font-bold ml-1">✕</button>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="rounded-2xl bg-[#0E1118]/80 backdrop-blur-xl border border-white/8 p-2 flex flex-col gap-2 shadow-2xl focus-within:border-blue-500/40 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all duration-200">
              <input type="file" ref={fileInputRef} onChange={handleDocumentSelect} className="hidden" />
              
              <div className="flex items-center gap-2.5 px-3">
                <input
                  type="text"
                  placeholder="Ask anything, ground with PDFs, or search the web..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  disabled={isAiTyping || isTranscribing}
                  className="flex-1 min-w-0 text-sm text-white placeholder-white/20 focus:outline-none bg-transparent py-2"
                />
              </div>

              <div className="flex items-center justify-between border-t border-white/5 pt-2 px-1">
                <div className="flex items-center gap-1">
                  {/* Document upload trigger */}
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/5 transition-all" title="Upload Sources (PDF/Docs)">
                    <IconFile />
                  </button>

                  {/* Web search toggle indicator */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">
                    <IconGlob />
                    <span>Sonar Online</span>
                  </div>
                </div>

                {inputText.trim() === '' && !attachments.length ? (
                  <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/5 transition-all">
                    <IconMic />
                  </button>
                ) : (
                  <button type="submit" disabled={isAiTyping} className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 shadow shadow-blue-500/20 hover:scale-105 active:scale-95">
                    <IconSend />
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* ── INTERACTIVE KNOWLEDGE GRAPH VIEW (NotebookLM Competitor) ── */}
        <div className={`flex-1 md:w-[350px] lg:w-[450px] shrink-0 border-l border-white/8 flex flex-col bg-[#080A0E] ${viewMode === 'graph' ? 'flex' : 'hidden md:flex'}`}>
          <div className="shrink-0 p-4 border-b border-white/8 flex justify-between items-center bg-black/20 backdrop-blur-md">
            <div>
              <h3 className="text-white text-xs font-black uppercase tracking-wider">Concept Graph Map</h3>
              <p className="text-[10px] text-white/40">Visualizing logical nodes and grounded sources</p>
            </div>
            <button onClick={() => setViewMode('chat')} className="text-white/40 hover:text-white text-xs md:hidden">Close</button>
          </div>

          {/* Interactive Graph Canvas */}
          <div className="flex-1 relative overflow-hidden bg-[#05070B]">
            {/* SVG Dot grid pattern */}
            <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

            <svg className="w-full h-full relative z-10">
              {/* Connection Lines */}
              <line x1="200" y1="200" x2="80" y2="100" stroke="rgba(59,130,246,0.35)" strokeWidth="2.5" />
              <line x1="200" y1="200" x2="320" y2="100" stroke="rgba(59,130,246,0.35)" strokeWidth="2.5" />
              <line x1="200" y1="200" x2="100" y2="300" stroke="rgba(139,92,246,0.25)" strokeWidth="2" strokeDasharray="5" />
              <line x1="200" y1="200" x2="300" y2="300" stroke="rgba(139,92,246,0.25)" strokeWidth="2" strokeDasharray="5" />
              
              {/* Interactive Nodes */}
              {graphNodes.map(node => {
                const isSelected = selectedNode?.id === node.id;
                return (
                  <g key={node.id} className="cursor-pointer group" onClick={() => setSelectedNode(node)}>
                    {node.type === 'center' && (
                      <circle cx={node.x} cy={node.y} r="38" className="fill-blue-500/5 stroke-blue-500/10 animate-pulse-slow" />
                    )}
                    <circle cx={node.x} cy={node.y} r={node.type === 'center' ? '28' : '22'}
                      fill={node.type === 'center' ? 'rgba(0,132,255,0.2)' : isSelected ? 'rgba(139,92,246,0.25)' : 'rgba(22,27,34,0.75)'}
                      stroke={node.type === 'center' ? '#0084FF' : isSelected ? '#8B5CF6' : 'rgba(255,255,255,0.12)'} 
                      strokeWidth="2"
                      className="transition-all duration-300 group-hover:scale-105 group-hover:stroke-blue-400" />
                    <text x={node.x} y={node.y + 4} textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" className="pointer-events-none select-none">
                      {node.id === '1' ? 'Focus' : node.id === '2' ? 'Web [1]' : node.id === '3' ? 'Ref [2]' : `Node ${node.id}`}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Instruction layer overlay */}
            <div className="absolute bottom-4 left-4 right-4 pointer-events-none bg-black/60 backdrop-blur-md border border-white/8 rounded-xl p-3 text-center z-20">
              <span className="text-[10px] text-white/50 font-medium">Click on any node above to inspect its grounded references and synthesized concept logic.</span>
            </div>
          </div>

          {/* Node detail side panel drawer */}
          {selectedNode && (
            <div className="h-[185px] shrink-0 border-t border-white/8 p-5 bg-[#090B10]/95 backdrop-blur-md flex flex-col gap-2 animate-in slide-in-from-bottom duration-300 relative z-30">
              <div className="flex justify-between items-center">
                <span className={`text-[9px] uppercase font-black px-2.5 py-0.5 rounded-full ${selectedNode.type === 'center' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                  {selectedNode.type} node
                </span>
                <button onClick={() => setSelectedNode(null)} className="text-white/40 hover:text-white text-xs font-bold transition-all">✕ Close</button>
              </div>
              <h4 className="text-sm font-bold text-white mt-1.5">{selectedNode.label}</h4>
              <p className="text-xs text-white/50 leading-relaxed overflow-y-auto scrollbar-none mt-0.5 font-medium">{selectedNode.desc}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
