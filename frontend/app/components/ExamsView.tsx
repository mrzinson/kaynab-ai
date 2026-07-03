"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useTheme } from '../context/ThemeContext';

interface ExamsViewProps {
  onOpenPdf: (pdfUrl: string, title: string, type: string) => void;
  onOpenSidebar: () => void;
}

const CATEGORIES = [
  'All', 'Biology', 'History', 'Physics', 'Chemistry', 'Geography',
  'Mathematics', 'Maths', 'Science', 'Social', 'English',
  'Somali', 'Suugaan', 'Arabic', 'Islamic', 'General'
];

export default function ExamsView({ onOpenPdf, onOpenSidebar }: ExamsViewProps) {
  const { colors, language, isDark } = useTheme();
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeYear, setActiveYear] = useState('All');
  const [activeGrade, setActiveGrade] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Exams list
  useEffect(() => {
    const fetchExams = async () => {
      const token = localStorage.getItem('userToken');
      try {
        const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com') + '/api/user/exams', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setExams(data);
        }
      } catch (e) {
        console.log('Error exams list:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, []);

  const filteredExams = useMemo(() => {
    if (!Array.isArray(exams)) return [];
    return exams.filter(exam => {
      const matchesCategory = activeCategory === 'All' || exam.category === activeCategory;
      const matchesYear = activeYear === 'All' || exam.year === activeYear;
      
      const matchesGrade = activeGrade === 'All' || (exam.grade && (
        String(exam.grade).toLowerCase() === activeGrade.toLowerCase() || 
        (activeGrade === 'Class 8' && (
          String(exam.grade).toLowerCase().includes('8') || 
          String(exam.grade).toLowerCase().includes('eight') ||
          String(exam.grade).toLowerCase().includes('class 8') ||
          String(exam.grade).toLowerCase().includes('grade 8') ||
          String(exam.grade).toLowerCase().includes('8aad')
        )) ||
        (activeGrade === 'Form 4' && (
          String(exam.grade).toLowerCase().includes('form 4') || 
          String(exam.grade).toLowerCase().includes('form4') || 
          String(exam.grade).toLowerCase().includes('four') ||
          String(exam.grade).toLowerCase().includes('4') ||
          String(exam.grade).toLowerCase().includes('grade 12') ||
          String(exam.grade).toLowerCase().includes('12')
        ))
      ));

      const matchesSearch = (exam.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesYear && matchesGrade && matchesSearch;
    });
  }, [exams, activeCategory, activeYear, activeGrade, searchQuery]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add('All');
    exams.forEach(exam => {
      const matchesCategory = activeCategory === 'All' || exam.category === activeCategory;
      const matchesGrade = activeGrade === 'All' || (exam.grade && (
        String(exam.grade).toLowerCase() === activeGrade.toLowerCase() || 
        (activeGrade === 'Class 8' && (
          String(exam.grade).toLowerCase().includes('8') || 
          String(exam.grade).toLowerCase().includes('eight') ||
          String(exam.grade).toLowerCase().includes('class 8') ||
          String(exam.grade).toLowerCase().includes('grade 8') ||
          String(exam.grade).toLowerCase().includes('8aad')
        )) ||
        (activeGrade === 'Form 4' && (
          String(exam.grade).toLowerCase().includes('form 4') || 
          String(exam.grade).toLowerCase().includes('form4') || 
          String(exam.grade).toLowerCase().includes('four') ||
          String(exam.grade).toLowerCase().includes('4') ||
          String(exam.grade).toLowerCase().includes('grade 12') ||
          String(exam.grade).toLowerCase().includes('12')
        ))
      ));
      if (matchesCategory && matchesGrade && exam.year) {
        years.add(exam.year);
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [exams, activeCategory, activeGrade]);

  const getMediaUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return (process.env.NEXT_PUBLIC_API_URL || "https://kaynab-ai-backend.onrender.com") + `${path.startsWith('/') ? '' : '/'}${path}`;
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-6 py-6 scrollbar-none flex flex-col gap-6 bg-[#0D1117]">
      
      {/* Header Titles */}
      <div className="flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <button 
            onClick={onOpenSidebar}
            className="w-10 h-10 rounded-full flex lg:hidden items-center justify-center bg-gray-850 hover:bg-gray-800 text-blue-500 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-extrabold text-white">EXAM'S</h2>
            <p className="text-xs text-gray-500 font-medium">Access your past papers and answer keys.</p>
          </div>
        </div>
      </div>

      {/* Search Box */}
      <div className="relative w-full flex items-center border border-gray-850 bg-[#161B22] rounded-xl px-4 py-3 text-gray-400 focus-within:border-blue-500 transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-blue-500 mr-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="text"
          placeholder="Search for an exam..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
        />
        {searchQuery.length > 0 && (
          <button onClick={() => setSearchQuery('')}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-gray-500 hover:text-white transition-colors">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Grade Filters */}
      <div className="flex gap-2 select-none">
        {['All', 'Class 8', 'Form 4'].map((grade) => (
          <button
            key={grade}
            onClick={() => {
              setActiveGrade(grade);
              setActiveYear('All');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${activeGrade === grade ? 'bg-blue-500 border-blue-500 text-white' : 'bg-[#161B22] border-gray-800 text-gray-450 hover:bg-gray-800'}`}
          >
            {grade === 'All' ? 'All Classes' : grade}
          </button>
        ))}
      </div>

      {/* Categories Filter list */}
      <div className="w-full overflow-x-auto flex gap-2 pb-1 scrollbar-none select-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => {
              setActiveCategory(cat);
              setActiveYear('All');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border flex-shrink-0 ${activeCategory === cat ? 'bg-blue-500 border-blue-500 text-white' : 'bg-[#161B22] border-gray-800 text-gray-400 hover:bg-gray-800'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Year Filter dynamic list */}
      {availableYears.length > 1 && (
        <div className="flex flex-col gap-2 select-none">
          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest ml-1">years</span>
          <div className="w-full overflow-x-auto flex gap-2 pb-1 scrollbar-none">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => setActiveYear(year)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border flex-shrink-0 ${activeYear === year ? 'bg-blue-500 border-blue-500 text-white' : 'bg-[#161B22] border-gray-800 text-gray-400 hover:bg-gray-800'}`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Exams list grid */}
      <div className="flex-1 w-full">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[80px] w-full rounded-2xl bg-gray-800/50 animate-pulse border border-gray-800" />
            ))}
          </div>
        ) : filteredExams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredExams.map((exam) => (
              <div
                key={exam.id}
                onClick={() => {
                  if (exam.pdf_url) {
                    onOpenPdf(exam.pdf_url, exam.title, 'exam');
                  } else {
                    alert('Imtixaankan malaha PDF');
                  }
                }}
                className="flex items-center justify-between p-4 bg-[#161B22] border border-gray-800 rounded-2xl hover:border-blue-500 active:scale-[0.99] transition-all cursor-pointer shadow-sm group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden relative flex-shrink-0 bg-gray-800">
                    <img
                      src={getMediaUrl(exam.image_url) || 'https://images.unsplash.com/photo-1546410531-df4cb71576bd?w=100'}
                      alt={exam.title}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white truncate leading-snug group-hover:text-blue-500 transition-colors">{exam.title}</h4>
                    <span className="text-[10px] text-gray-500 block truncate mt-1">{exam.category || 'General'} • {exam.year || '2025'}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D1117] border border-gray-800 group-hover:bg-blue-500/10 group-hover:border-blue-500 transition-all">
                  <span className="text-[10px] font-bold text-blue-500">Read</span>
                  <svg xmlns="http://www.w3.org/2500/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 text-blue-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full py-12 text-center text-xs text-gray-500 bg-[#161B22] border border-gray-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 select-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-gray-600 mb-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span className="font-bold text-gray-400">{language === 'so' ? 'Gobolkaaga' : 'Your Region'}</span>
            <p className="max-w-xs leading-relaxed mt-1">Imtixaanadii aad u baahan tahay wali kuma jiraan nidaamka. Dhawr casho ka bacdi ayaa lasoo dari doonaa.</p>
          </div>
        )}
      </div>

    </div>
  );
}
