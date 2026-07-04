"use client";

import React, { useState, useEffect } from 'react';
import { useRouter }    from 'next/navigation';
import Image            from 'next/image';
import { AuthGuard }    from './components/AuthGuard';
import { useTheme }     from './context/ThemeContext';
import Terms            from './components/Terms';
import Onboarding       from './components/Onboarding';
import ChatView         from './components/ChatView';
import ExamsView        from './components/ExamsView';
import QuizView         from './components/QuizView';
import ShukaansiView    from './components/ShukaansiView';
import PdfReader        from './components/PdfReader';
import ProfileView      from './components/ProfileView';
import ExamGeneratorView from './components/ExamGeneratorView';
import GroupsView       from './components/GroupsView';
import BillingView      from './components/BillingView';
import UsageView        from './components/UsageView';
import SettingsView     from './components/SettingsView';
import AboutView        from './components/AboutView';

/* ─────────────────── constants ─────────────────── */
const DP_BG    = '#05070B'; // Deep space black
const DP_SIDE  = 'rgba(10, 12, 18, 0.6)'; // Glassmorphism dark side
const DP_BORD  = 'rgba(255,255,255,0.07)'; 
const DP_ACCENT = '#0084FF'; 

/* ─────────────────── icon helpers ─────────────────── */
const Ico = ({ d, cls = 'w-4 h-4' }: { d: string; cls?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={cls}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const PATHS = {
  chat:   'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025 4.479 4.479 0 00-.115-1.68C3.753 15.82 3 13.987 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z',
  books:  'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  quiz:   'M12 21.75c-4.5 0-8.25-3.75-8.25-8.25v-3.75A2.25 2.25 0 016 7.5h12a2.25 2.25 0 012.25 2.25v3.75c0 4.5-3.75 8.25-8.25 8.25zm0 0v1.5m-3-1.5h6M3 9.75h1.5m15 0H21m-16.5 0a3.75 3.75 0 013.75-3.75h9.75a3.75 3.75 0 013.75 3.75',
  heart:  'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z',
  groups: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z',
  person: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
  exam:   'M9.813 15.904 9 21l8.982-8.983m-9 9 9-9m-9 9-2.25-2.25m11.25-6.75 2.25-2.25m-13.5 0h13.5M9 7.5h.008v.008H9V7.5Z',
  billing:'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-5.625-10.125h16.5a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 21 21.75H3a2.25 2.25 0 0 1-2.25-2.25V5.625a2.25 2.25 0 0 1 2.25-2.25Z',
  usage:  'M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z',
  settings:'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.991l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z',
  about:  'M11.25 11.25l.041-.02a.75.75 0 1 1 1.063.852l-.708.283a.75.75 0 00-.475.695v.283m0-.005H12m-.25-4.125h.008v.008h-.008V7.5Z',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75',
  moon:   'M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998Z',
  lang:   'M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138A14.25 14.25 0 0010.5 9.75',
  close:  'M6 18 18 6M6 6l12 12',
};

/* ─────────────────── sidebar nav item ─────────────────── */
function SideItem({ icon, label, active, badge, onClick }: { icon: string; label: string; active?: boolean; badge?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all text-left group relative ${active ? 'text-white' : 'text-white/40 hover:text-white/90 hover:bg-white/5'}`}
      style={active ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' } : {}}>
      {active && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r bg-blue-500" />}
      <Ico d={icon} cls={`w-4 h-4 shrink-0 transition-all ${active ? 'text-blue-500' : 'text-white/30 group-hover:text-white/70'}`} />
      <span className="flex-1">{label}</span>
      {badge && <span className="px-1.5 py-0.5 rounded text-[8px] font-black text-white bg-blue-600">{badge}</span>}
      {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
    </button>
  );
}

/* ─────────────────── toggle ─────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      className="rounded-full relative flex items-center p-0.5 transition-all"
      style={{ width: 38, height: 20, background: on ? DP_ACCENT : 'rgba(255,255,255,0.1)', border: `1px solid ${on ? DP_ACCENT : 'rgba(255,255,255,0.12)'}` }}>
      <div style={{ width: 14, height: 14 }} className={`rounded-full bg-white shadow transition-all duration-300 ${on ? 'translate-x-[18px]' : 'translate-x-0'}`} />
    </button>
  );
}

/* ─────────────────── main app ─────────────────── */
export default function AppWorkspace() {
  const router = useRouter();
  const { colors, isDark, setTheme, language, setLanguage, t } = useTheme();

  const [currentView,    setCurrentView]    = useState<string>('chat');
  const [userData,       setUserData]       = useState<any>(null);
  const [leftOpen,       setLeftOpen]       = useState(false);
  const [navOpen,        setNavOpen]        = useState(false);
  const [openPdf,        setOpenPdf]        = useState<{ url: string; title: string; type: string } | null>(null);

  /* ── load user instantly from localcache first, then sync ── */
  useEffect(() => {
    const cached = localStorage.getItem('userData');
    if (cached) { try { setUserData(JSON.parse(cached)); } catch {} }

    const token = localStorage.getItem('userToken');
    if (token) {
      fetch((process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com') + '/api/user/profile', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (res.ok) return res.json();
          if (res.status === 401) {
            localStorage.removeItem('userToken'); localStorage.removeItem('userData');
            setUserData(null); router.push('/login');
          }
        })
        .then(d => {
          if (d?.user) { setUserData(d.user); localStorage.setItem('userData', JSON.stringify(d.user)); }
        })
        .catch(() => {});
    }
  }, [router]);

  const logout = () => {
    localStorage.removeItem('userToken'); localStorage.removeItem('userData');
    setUserData(null); router.push('/login');
  };

  const nav = (v: string) => { setCurrentView(v); setLeftOpen(false); setNavOpen(false); setOpenPdf(null); };

  /* ── left sidebar (full info + settings) ── */
  const LeftSidebar = () => (
    <div className="flex flex-col h-full py-6 px-4 gap-5 overflow-y-auto scrollbar-none backdrop-blur-lg" style={{ background: 'rgba(10, 12, 18, 0.45)' }}>

      {/* Logo + close on mobile */}
      <div className="flex items-center justify-between shrink-0 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-md shadow-blue-500/25">
            <span className="text-white font-black text-xs tracking-wider">KB</span>
          </div>
          <span className="text-white font-black text-sm tracking-wider bg-clip-text bg-gradient-to-r from-white to-gray-400">KAYNAB AI</span>
        </div>
        <button onClick={() => setLeftOpen(false)} className="lg:hidden text-white/30 hover:text-white/80 p-1">
          <Ico d={PATHS.close} cls="w-4 h-4" />
        </button>
      </div>

      {/* User card with Gradient Border Ring */}
      <div className="shrink-0 rounded-2xl p-4 flex flex-col items-center text-center gap-3 relative overflow-hidden" 
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-tr from-blue-500 to-indigo-500">
          <div className="w-full h-full rounded-full bg-[#161B22] flex items-center justify-center text-white text-lg font-black">
            {userData?.name ? userData.name.substring(0, 2).toUpperCase() : 'KB'}
          </div>
        </div>
        <div>
          <p className="text-white text-sm font-semibold">@{userData?.username || 'Kaynab AI User'}</p>
          <p className="text-white/40 text-[10px] mt-0.5 font-medium">{userData?.whatsapp_number || ''}</p>
        </div>
        <button onClick={() => nav('billing')} 
          className="flex items-center gap-2 px-5 py-2 rounded-full text-white text-[10px] font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/20 active:scale-95 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M12 7.5a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
            <path fillRule="evenodd" d="M1.5 4.875C1.5 3.839 2.34 3 3.375 3h17.25c1.035 0 1.875.84 1.875 1.875v9.75c0 1.036-.84 1.875-1.875 1.875H3.375A1.875 1.875 0 0 1 1.5 14.625v-9.75ZM8.25 9.75a3.75 3.75 0 1 1 7.5 0 3.75 3.75 0 0 1-7.5 0ZM18.75 9a.75.75 0 0 0-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 0 0 .75-.75V9.75a.75.75 0 0 0-.75-.75h-.008ZM4.5 9.75A.75.75 0 0 1 5.25 9h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H5.25a.75.75 0 0 1-.75-.75V9.75Z" clipRule="evenodd" />
            <path d="M2.25 18a.75.75 0 0 0 0 1.5c5.4 0 10.63.722 15.6 2.117a.75.75 0 0 0 .9-1.336 48.46 48.46 0 0 0-16.5-2.28Z" />
          </svg>
          <span>{userData?.balance ?? 0} Credits</span>
        </button>
      </div>

      {/* Navigation */}
      <div className="flex flex-col gap-1">
        <p className="text-white/20 text-[9px] font-black uppercase tracking-widest px-2 mb-2">RESEARCH & ASSISTANCE</p>
        <SideItem icon={PATHS.chat}    label="AI Search Assistant" active={currentView==='chat'}           onClick={() => nav('chat')} />
        <SideItem icon={PATHS.books}   label="My Library"         active={currentView==='notebooks'}      onClick={() => nav('notebooks')} />
        <SideItem icon={PATHS.groups}  label="Shared Spaces"      active={currentView==='spaces'}         onClick={() => nav('spaces')} />
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-white/20 text-[9px] font-black uppercase tracking-widest px-2 mb-2">ACCOUNT & SETTINGS</p>
        <SideItem icon={PATHS.person}  label="Profile"            active={currentView==='profile'}        onClick={() => nav('profile')} />
        <SideItem icon={PATHS.billing} label="Billing & Credits"  active={currentView==='billing'}        onClick={() => nav('billing')} />
        <SideItem icon={PATHS.settings}label="Settings"           active={currentView==='settings'}       onClick={() => nav('settings')} />
        <SideItem icon={PATHS.about}   label="About Platform"     active={currentView==='about'}          onClick={() => nav('about')} />
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-4 px-3 py-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between text-xs font-bold text-white/50">
          <div className="flex items-center gap-2"><Ico d={PATHS.moon} /><span>Dark Mode</span></div>
          <Toggle on={isDark} onChange={() => setTheme(isDark ? 'light' : 'dark')} />
        </div>
        <div className="flex items-center justify-between text-xs font-bold text-white/50">
          <div className="flex items-center gap-2"><Ico d={PATHS.lang} /><span>Somali (SO)</span></div>
          <Toggle on={language==='so'} onChange={() => setLanguage(language==='en' ? 'so' : 'en')} />
        </div>
      </div>

      {/* Logout */}
      <button onClick={logout} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition-all w-fit mt-auto" style={{ border: '1px solid rgba(239,68,68,0.12)' }}>
        <Ico d={PATHS.logout} cls="w-4 h-4 shrink-0" />
        <span>{t('logout')}</span>
      </button>
    </div>
  );

  /* ── nav panel (right drawer) ── */
  const NavPanel = () => (
    <div className="flex flex-col h-full py-6 px-4 gap-4 overflow-y-auto scrollbar-none" style={{ background: 'rgba(10, 12, 18, 0.45)' }}>
      <div className="flex items-center justify-between shrink-0 mb-2">
        <p className="text-white/80 text-sm font-bold">Navigation</p>
        <button onClick={() => setNavOpen(false)} className="text-white/30 hover:text-white/80 p-1">
          <Ico d={PATHS.close} cls="w-4 h-4" />
        </button>
      </div>

      {[
        { icon: PATHS.chat,   label: 'AI Search Assistant', view: 'chat',      accent: DP_ACCENT },
        { icon: PATHS.books,  label: 'My Library',         view: 'notebooks', accent: '#3CADA0' },
        { icon: PATHS.groups, label: 'Shared Spaces',      view: 'spaces',    accent: '#5B8CE5' },
      ].map(item => {
        const active = currentView === item.view;
        return (
          <button key={item.view} onClick={() => nav(item.view)}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: active ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${active ? DP_ACCENT+'50' : DP_BORD}`,
            }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: active ? `${DP_ACCENT}25` : 'rgba(255,255,255,0.04)' }}>
              <Ico d={item.icon} cls="w-4.5 h-4.5" />
            </div>
            <span className={`text-sm font-bold ${active ? 'text-white' : 'text-white/50'}`}>{item.label}</span>
            {active && <span className="ml-auto w-2 h-2 rounded-full" style={{ background: DP_ACCENT }} />}
          </button>
        );
      })}
    </div>
  );

  /* ── content switcher ── */
  const Content = () => {
    if (openPdf) return <PdfReader pdfUrl={openPdf.url} title={openPdf.title} type={openPdf.type} onClose={() => setOpenPdf(null)} />;
    switch (currentView) {
      case 'chat':          return <ChatView onOpenLeftSidebar={() => setLeftOpen(true)} onOpenNavPanel={() => setNavOpen(true)} onBack={() => nav('chat')} />;
      case 'profile':       return <ProfileView userData={userData} onUpdateUser={u => setUserData(u)} onClose={() => nav('chat')} />;
      case 'billing':       return <BillingView onClose={() => nav('chat')} />;
      case 'settings':      return <SettingsView onClose={() => nav('chat')} />;
      case 'about':         return <AboutView onClose={() => nav('chat')} />;
      case 'notebooks':
        return (
          <div className="flex-1 flex flex-col p-8 text-white">
            <h2 className="text-xl font-bold mb-4">My Library (Notebooks)</h2>
            <p className="text-white/60 text-sm mb-6">Grounded AI workspace. Upload PDFs or web links to constrain the AI's search directly to your documents.</p>
            <div className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center bg-white/2">
              <Ico d={PATHS.books} cls="w-12 h-12 text-blue-400 mb-4" />
              <p className="font-bold text-sm">No notebooks created yet</p>
              <p className="text-xs text-white/40 mt-1 max-w-sm">Create a notebook and start uploading PDFs to query them directly in your chat session.</p>
              <button onClick={() => nav('chat')} className="mt-6 px-5 py-2.5 bg-blue-500 rounded-full font-bold text-xs shadow-lg hover:opacity-90 transition-all">
                + New Chat & Grounding Session
              </button>
            </div>
          </div>
        );
      case 'spaces':
        return (
          <div className="flex-1 flex flex-col p-8 text-white">
            <h2 className="text-xl font-bold mb-4">Shared Spaces</h2>
            <p className="text-white/60 text-sm mb-6">Collaborate on research projects, share source folders, and prompt the AI together as a team.</p>
            <div className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center flex flex-col items-center justify-center bg-white/2">
              <Ico d={PATHS.groups} cls="w-12 h-12 text-blue-400 mb-4" />
              <p className="font-bold text-sm">No active shared spaces</p>
              <p className="text-xs text-white/40 mt-1 max-w-sm">Create a shared workspace and invite collaborators via email or link to share research resources.</p>
              <button className="mt-6 px-5 py-2.5 bg-blue-500 rounded-full font-bold text-xs shadow-lg hover:opacity-90 transition-all">
                Create Shared Space
              </button>
            </div>
          </div>
        );
      default:              return <ChatView onOpenLeftSidebar={() => setLeftOpen(true)} onOpenNavPanel={() => setNavOpen(true)} />;
    }
  };

  const sideStyle: React.CSSProperties = { background: DP_SIDE, borderRight: `1px solid ${DP_BORD}` };
  const navStyle: React.CSSProperties  = { background: DP_SIDE, borderLeft: `1px solid ${DP_BORD}` };

  return (
    <AuthGuard>
      {!userData?.terms_accepted_at ? (
        <Terms onComplete={u => setUserData(u)} />
      ) : (!userData?.gender || !userData?.country) ? (
        <Onboarding onComplete={u => setUserData(u)} />
      ) : (
        <div className="h-screen w-screen flex overflow-hidden relative bg-[#05070B]" style={{ background: DP_BG }}>
          
          {/* Atmospheric Glow Mesh & Grids */}
          <div className="absolute inset-0 bg-grid-overlay pointer-events-none opacity-80" />
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] mesh-glow-1 pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] mesh-glow-2 pointer-events-none" />

          {/* ── DESKTOP: persistent left sidebar ── */}
          <div className="hidden lg:flex w-[250px] h-full flex-col shrink-0 overflow-hidden relative z-10" style={sideStyle}>
            <LeftSidebar />
          </div>

          {/* ── MAIN CONTENT ── */}
          <div className="flex-1 h-full overflow-hidden flex flex-col relative z-10">
            <Content />
          </div>

          {/* ── LEFT DRAWER (mobile + desktop overlay) ── */}
          {leftOpen && (
            <div className="fixed inset-0 z-[9999] flex lg:hidden">
              <div onClick={() => setLeftOpen(false)} className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.92)' }} />
              <div className="relative w-[280px] h-full overflow-hidden animate-in slide-in-from-left duration-300" style={sideStyle}>
                <LeftSidebar />
              </div>
            </div>
          )}

          {/* ── NAV PANEL (right drawer, both breakpoints) ── */}
          {navOpen && (
            <div className="fixed inset-0 z-[9999] flex justify-end">
              <div onClick={() => setNavOpen(false)} className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.92)' }} />
              <div className="relative w-[290px] h-full overflow-hidden animate-in slide-in-from-right duration-300" style={navStyle}>
                <NavPanel />
              </div>
            </div>
          )}

        </div>
      )}
    </AuthGuard>
  );
}
