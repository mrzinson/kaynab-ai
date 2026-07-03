"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useTheme } from '../context/ThemeContext';

interface HomeViewProps {
  userData: any;
  onSelectTab: (tab: string) => void;
  onOpenPdf: (pdfUrl: string, title: string, type: string) => void;
}

export default function HomeView({ userData, onSelectTab, onOpenPdf }: HomeViewProps) {
  const { language, isDark } = useTheme();
  const [promoCards, setPromoCards] = useState<any[]>([]);
  const [activePromoIndex, setActivePromoIndex] = useState(0);
  const [books, setBooks] = useState<any[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [exams, setExams] = useState<any[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);

  const FALLBACK_PROMO_CARDS = [
    {
      id: 'f1',
      title_en: 'Books',
      title_so: 'Books',
      desc_en: 'Explore and read all educational and curriculum books.',
      desc_so: 'Baro oo akhriso dhammaan buugaagta la heli karo ee waxtarka leh.',
      button_text_en: 'Get Started',
      button_text_so: 'Hada Bilow',
      image_url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?q=80&w=600',
      route: 'exams', // Will switch tab to exams/books
      overlay_color_light: 'rgba(29, 78, 216, 0.65)',
      overlay_color_dark: 'rgba(30, 41, 59, 0.75)'
    },
    {
      id: 'f2',
      title_en: 'Exams',
      title_so: 'Imtixaanada',
      desc_en: 'Train yourself and prepare for official national exams.',
      desc_so: 'Tababar naftaada oo ku diyaargarow imtixaanada shahaadiga ah.',
      button_text_en: 'Start Exam',
      button_text_so: 'Bilow Imtixaan',
      image_url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=600',
      route: 'exams',
      overlay_color_light: 'rgba(109, 40, 217, 0.65)',
      overlay_color_dark: 'rgba(46, 16, 101, 0.75)'
    },
    {
      id: 'f3',
      title_en: 'AI Assistance',
      title_so: 'Caawimaada AI',
      desc_en: 'Ask the smart AI assistant any question and get quick answers.',
      desc_so: 'Weydii caawiyaha AI wixii su\'aal ah oo hel jawaab degdeg ah.',
      button_text_en: 'Chat Now',
      button_text_so: 'Hada Bilow',
      image_url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=600',
      route: 'chat',
      overlay_color_light: 'rgba(4, 120, 87, 0.65)',
      overlay_color_dark: 'rgba(6, 78, 59, 0.75)'
    }
  ];

  const displayCards = promoCards.length > 0 ? promoCards : FALLBACK_PROMO_CARDS;

  // Auto scroll promos
  useEffect(() => {
    if (displayCards.length === 0) return;
    const timer = setInterval(() => {
      setActivePromoIndex((prevIndex) => (prevIndex + 1) % displayCards.length);
    }, 8000); // 8 seconds
    return () => clearInterval(timer);
  }, [displayCards.length]);

  // Fetch all resources
  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('userToken');
      
      // Promo cards
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com') + '/api/user/promo-cards', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setPromoCards(data);
      } catch (e) {
        console.log('Error promos:', e);
      }

      // Books
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com') + '/api/user/books', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setBooks(data.slice(0, 5));
      } catch (e) {
        console.log('Error books:', e);
      } finally {
        setLoadingBooks(false);
      }

      // Exams
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com') + '/api/user/exams', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) setExams(data.slice(0, 5));
      } catch (e) {
        console.log('Error exams:', e);
      } finally {
        setLoadingExams(false);
      }
    };

    fetchData();
  }, []);

  const handlePromoClick = (card: any) => {
    if (card.route) {
      if (card.route.startsWith('http')) {
        window.open(card.route, '_blank');
      } else if (card.route.includes('chat')) {
        onSelectTab('chat');
      } else if (card.route.includes('exam')) {
        onSelectTab('exams');
      } else {
        onSelectTab('chat');
      }
    }
  };

  const getMediaUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `https://darkpen-backend.onrender.com${path.startsWith('/') ? '' : '/'}${path}`;
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-6 py-6 scrollbar-none flex flex-col gap-6 bg-white dark:bg-[#0D1117] transition-colors duration-200">
      
      {/* Greetings Header */}
      <div className="flex flex-col gap-1 select-none">
        <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Kuso dhawaaw Darkpen</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium max-w-md">
          waa madal ka caawinaysa ardayda qaybaha kala duwan ee waxbarshada
        </p>
      </div>

      {/* Promos Carousel */}
      <div className="w-full relative h-[180px] rounded-3xl overflow-hidden shadow-lg group">
        {displayCards.map((card, idx) => {
          const isActive = idx === activePromoIndex;
          const displayTitle = language === 'so' ? card.title_so : card.title_en;
          const displayDesc = language === 'so' ? card.desc_so : card.desc_en;
          const displayBtnText = language === 'so' ? card.button_text_so : card.button_text_en;
          const overlayColor = isDark
            ? (card.overlay_color_dark || 'rgba(30, 41, 59, 0.75)')
            : (card.overlay_color_light || 'rgba(29, 78, 216, 0.65)');

          return (
            <div
              key={card.id || idx}
              style={{
                backgroundImage: `url(${getMediaUrl(card.image_url)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              className={`absolute inset-0 w-full h-full p-6 flex flex-col justify-between transition-all duration-700 ease-in-out ${isActive ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 z-0'}`}
            >
              {/* Overlay */}
              <div 
                className="absolute inset-0" 
                style={{ backgroundColor: overlayColor }}
              />

              {/* Title & Desc */}
              <div className="relative z-10 flex flex-col gap-1 max-w-[80%]">
                <h3 className="text-lg font-bold text-white tracking-wide">{displayTitle}</h3>
                <p className="text-xs text-gray-200 line-clamp-2 leading-relaxed">{displayDesc}</p>
              </div>

              {/* Button */}
              <button
                onClick={() => handlePromoClick(card)}
                className="relative z-10 self-start px-5 py-2.5 rounded-xl text-xs font-bold bg-white text-blue-600 hover:bg-gray-100 active:scale-95 transition-all shadow-md"
              >
                {displayBtnText}
              </button>
            </div>
          );
        })}
        
        {/* Indicators */}
        <div className="absolute bottom-4 right-6 z-20 flex gap-1.5">
          {displayCards.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActivePromoIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${idx === activePromoIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`}
            />
          ))}
        </div>
      </div>

      {/* Books Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-wide">Books</h3>
          <button 
            onClick={() => onSelectTab('exams')}
            className="text-xs font-semibold text-blue-500 hover:underline"
          >
            View All
          </button>
        </div>

        <div className="w-full flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
          {loadingBooks ? (
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-[140px] h-[190px] rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse flex-shrink-0" />
              ))}
            </div>
          ) : books.length > 0 ? (
            books.map((book) => (
              <div
                key={book.id}
                onClick={() => {
                  if (book.pdf_url) {
                    onOpenPdf(book.pdf_url, book.title, 'book');
                  } else {
                    alert('Buuggan malaha PDF');
                  }
                }}
                style={{
                  backgroundImage: `url(${getMediaUrl(book.image_url)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                className="w-[140px] h-[190px] rounded-2xl flex-shrink-0 relative overflow-hidden flex flex-col justify-end p-3 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all snap-start shadow-md"
              >
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/40 hover:bg-black/20 transition-colors" />
                
                {/* Info Box */}
                <div className="relative z-10 w-full p-2 rounded-xl backdrop-blur-md bg-black/60 border border-white/10 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-bold text-white truncate leading-tight">{book.title}</h4>
                    <span className="text-[8px] text-gray-400 block truncate mt-0.5">{book.grade || 'Form 4'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="w-full py-6 text-center text-xs text-gray-500 bg-gray-50 dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              Buugaagtii manhajka ee aad u baahan tahay wali kuma jiraan nidaamka.
            </div>
          )}
        </div>
      </div>

      {/* Exams Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-wide">Exams</h3>
          <button 
            onClick={() => onSelectTab('exams')}
            className="text-xs font-semibold text-blue-500 hover:underline"
          >
            View All
          </button>
        </div>

        <div className="w-full flex gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
          {loadingExams ? (
            <div className="flex gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-[140px] h-[190px] rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse flex-shrink-0" />
              ))}
            </div>
          ) : exams.length > 0 ? (
            exams.map((exam) => (
              <div
                key={exam.id}
                onClick={() => {
                  if (exam.pdf_url) {
                    onOpenPdf(exam.pdf_url, exam.title, 'exam');
                  } else {
                    alert('Imtixaankan malaha PDF');
                  }
                }}
                style={{
                  backgroundImage: `url(${getMediaUrl(exam.image_url)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
                className="w-[140px] h-[190px] rounded-2xl flex-shrink-0 relative overflow-hidden flex flex-col justify-end p-3 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all snap-start shadow-md"
              >
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/40 hover:bg-black/20 transition-colors" />
                
                {/* Info Box */}
                <div className="relative z-10 w-full p-2 rounded-xl backdrop-blur-md bg-black/60 border border-white/10 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[10px] font-bold text-white truncate leading-tight">{exam.title}</h4>
                    <span className="text-[8px] text-gray-400 block truncate mt-0.5">{exam.category || 'General'} • {exam.year || '2025'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="w-full py-6 text-center text-xs text-gray-500 bg-gray-50 dark:bg-[#161B22] border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
              Imtixaanadii aad u baahan tahay wali kuma jiraan nidaamka.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
