"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface QuizViewProps {
  onOpenSidebar: () => void;
  onBack?: () => void;
}

export default function QuizView({ onOpenSidebar, onBack }: QuizViewProps) {
  const { language } = useTheme();
  
  const [optedIn, setOptedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [optInLoading, setOptInLoading] = useState(false);
  
  // Quiz running states
  const [activeQuiz, setActiveQuiz] = useState<any>(null);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: number }>({});
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<any>(null);
  const [quizError, setQuizError] = useState('');

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    fetchQuizStatus();
    fetchLeaderboard();
  }, []);

  const fetchQuizStatus = async () => {
    const token = localStorage.getItem('userToken');
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/chat/quiz/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOptedIn(data.opted_in || false);
        if (data.today_quiz_completed) {
          setQuizResult({
            score: data.today_score,
            total: data.today_total,
            already_done: true
          });
        }
      }
    } catch (e) {
      console.log('Error quiz status:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    const token = localStorage.getItem('userToken');
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/chat/quiz/leaderboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setLeaderboard(data);
      }
    } catch (e) {
      console.log('Error leaderboard:', e);
    }
  };

  const handleOptIn = async () => {
    setOptInLoading(true);
    const token = localStorage.getItem('userToken');
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/chat/quiz/opt-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setOptedIn(true);
        fetchQuizStatus();
      }
    } catch (e) {
      alert('Opt-in failed');
    } finally {
      setOptInLoading(false);
    }
  };

  const generateQuiz = async () => {
    setLoading(true);
    setQuizError('');
    const token = localStorage.getItem('userToken');
    try {
      const res = await fetch('https://darkpen-backend.onrender.com/api/chat/quiz/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.quiz) {
        setActiveQuiz(data.quiz);
        setUserAnswers({});
      } else {
        setQuizError(data.message || 'Lama dhalin karin quiz challenge maanta.');
      }
    } catch (e) {
      setQuizError('Cilad dhalinta su\'aalaha.');
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (qIdx: number, oIdx: number) => {
    setUserAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
  };

  const submitQuiz = async () => {
    if (!activeQuiz) return;
    const questionsCount = activeQuiz.questions?.length || 0;
    const answeredCount = Object.keys(userAnswers).length;
    
    if (answeredCount < questionsCount) {
      alert(language === 'so' ? 'Fadlan ka jawaab dhammaan su\'aalaha!' : 'Please answer all questions!');
      return;
    }

    setSubmitting(true);
    const token = localStorage.getItem('userToken');
    try {
      const answersList = activeQuiz.questions.map((q: any, idx: number) => ({
        question_index: idx,
        selected_option: userAnswers[idx]
      }));

      const res = await fetch('https://darkpen-backend.onrender.com/api/chat/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          quizId: activeQuiz.id,
          answers: answersList
        })
      });

      const data = await res.json();
      if (res.ok) {
        setQuizResult({
          score: data.score,
          total: questionsCount,
          correctAnswers: data.correctAnswers || []
        });
        setActiveQuiz(null);
        fetchLeaderboard();
      } else {
        alert(data.message || 'Submission failed');
      }
    } catch (e) {
      alert('Error submitting answers.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 w-full overflow-y-auto scrollbar-none flex flex-col bg-white dark:bg-[#0D1117]">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-[#161B22] border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          {/* Back arrow */}
          <button
            onClick={onBack || onOpenSidebar}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-500 transition-all active:scale-95 shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          {/* Icon + Title */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4.5 h-4.5 text-blue-500">
                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v8a7.003 7.003 0 01-6 6.917V21h3a.75.75 0 010 1.5h-10a.75.75 0 010-1.5h3v-1.083A7.003 7.003 0 013 14V6zm3.06 1.5a1.5 1.5 0 100 3h.142A7.037 7.037 0 016 7.5zm11.88 3a1.5 1.5 0 100-3c-.097.807-.323 1.58-.665 2.296A1.5 1.5 0 0017.94 10.5z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">Quiz Challenge</span>
              <span className="text-[10px] text-blue-500 font-medium">Daily · Educational</span>
            </div>
          </div>
        </div>
        {/* Right: menu toggle (desktop hidden) */}
        <button
          onClick={onOpenSidebar}
          className="w-9 h-9 rounded-full flex lg:hidden items-center justify-center bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-500 transition-all active:scale-95 shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
          </svg>
        </button>
      </div>

      {/* Body content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">

      {loading ? (
        <div className="flex flex-col gap-4 py-8 items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : !optedIn ? (
        /* Opt-in banner screen */
        <div className="w-full bg-[#161B22] border border-gray-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center shadow-lg animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.9c2.785 0 5.421-.712 7.731-1.977.103-.308.162-.624.162-.953v-2.864c0-.987-.789-1.796-1.773-1.819a48.114 48.114 0 0 0-4.88-.29h-.007V12.5a3.75 3.75 0 0 0-3.75-3.75h-.007a3.75 3.75 0 0 0-3.75 3.75v.478a48.093 48.093 0 0 0-4.88.29Z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Join Quiz Challenge</h3>
          <p className="text-xs text-gray-400 max-w-xs leading-relaxed mb-6">
            Ka qayb qaado tartan aqooneedka maalinlaha ah si aad u kordhiso dhibcahaaga aadna u gasho Leaderboard-ka!
          </p>
          <button
            onClick={handleOptIn}
            disabled={optInLoading}
            className="w-full max-w-[240px] py-3.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {optInLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Opt-In Now'}
          </button>
        </div>
      ) : activeQuiz ? (
        /* Render Questions */
        <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="bg-[#161B22] border border-gray-800 rounded-3xl p-6 flex flex-col gap-6">
            {activeQuiz.questions.map((q: any, qIdx: number) => (
              <div key={qIdx} className="flex flex-col gap-3">
                <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Question {qIdx + 1}</span>
                <p className="text-sm font-bold text-white leading-relaxed">{q.question_text}</p>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {q.options.map((opt: string, oIdx: number) => {
                    const isSelected = userAnswers[qIdx] === oIdx;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => selectAnswer(qIdx, oIdx)}
                        className={`w-full py-3.5 px-4 rounded-xl text-xs font-semibold text-left transition-all border ${isSelected ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#0D1117] border-gray-850 hover:border-gray-700 text-gray-300'}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              onClick={submitQuiz}
              disabled={submitting}
              className="w-full py-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
            >
              {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Submit Quiz'}
            </button>
          </div>
        </div>
      ) : (
        /* Quiz Finished or Generate Page */
        <div className="w-full flex flex-col gap-6 animate-in fade-in duration-300">
          <div className="bg-[#161B22] border border-gray-800 rounded-3xl p-6 sm:p-8 flex flex-col items-center text-center">
            
            {quizResult ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-4 select-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">Quiz Challenge Done!</h3>
                <span className="text-3xl font-extrabold text-blue-500 mt-3 select-none">
                  {quizResult.score} / {quizResult.total}
                </span>
                <p className="text-xs text-gray-500 mt-2">Guul! Waxaad si guul leh u dhamaysatay caqabaddii maanta.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4 select-none">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 animate-pulse">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l8.982-8.983m-9 9 9-9m-9 9-2.25-2.25m11.25-6.75 2.25-2.25m-13.5 0h13.5M9 7.5h.008v.008H9V7.5Z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">Daily Challenge Available</h3>
                <p className="text-xs text-gray-400 max-w-xs leading-relaxed mt-2 mb-6">Tarjumo iyo xujooyin gaagaaban oo xiiso leh ayaa kuu diyaarsan hadda.</p>
                
                {quizError && <p className="text-red-500 text-xs font-semibold mb-4">{quizError}</p>}
                
                <button
                  onClick={generateQuiz}
                  className="w-full max-w-[240px] py-3.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all active:scale-95"
                >
                  Start Quiz
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-bold text-white tracking-wide select-none">Leaderboard (Xiddigaha)</h3>
        <div className="bg-[#161B22] border border-gray-800 rounded-3xl p-4 flex flex-col divide-y divide-gray-800/50">
          {leaderboard.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-500 select-none">Loading leaderboard...</div>
          ) : (
            leaderboard.map((user, idx) => (
              <div key={idx} className="flex items-center justify-between py-3.5 px-2 select-text selection:bg-blue-500/20">
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-xs font-extrabold select-none ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                    #{idx + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-white">@{user.username || user.name}</h4>
                    <span className="text-[9px] text-gray-550 block mt-0.5">{user.country || 'Global'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-black text-blue-500">{user.quiz_score || 0}</span>
                  <span className="text-[9px] text-gray-500 font-bold select-none">XP</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </div>

    </div>
  );
}
