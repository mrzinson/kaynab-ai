"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface ExamGeneratorViewProps {
  userData: any;
  onUpdateUser: (updatedUser: any) => void;
  onOpenPdf: (pdfUrl: string, title: string, type: string) => void;
  onClose: () => void;
}

const SUBJECTS = ['Biology', 'History', 'Physics', 'Chemistry', 'Geography', 'Mathematics', 'English', 'Somali', 'Islamic'];
const GRADES = ['Form 1', 'Form 2', 'Form 3', 'Form 4'];
const QUESTION_COUNTS = [5, 10, 15, 20];
const LANGUAGES = ['Somali', 'English', 'Bilingual (English/Somali)', 'Arabic'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

export default function ExamGeneratorView({ userData, onUpdateUser, onOpenPdf, onClose }: ExamGeneratorViewProps) {
  const { language } = useTheme();
  
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  
  // Form State
  const [subject, setSubject] = useState('Biology');
  const [grade, setGrade] = useState('Form 4');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [examLanguage, setExamLanguage] = useState('Somali');
  const [instructions, setInstructions] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);

  // Status & History Data
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [historyExams, setHistoryExams] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(userData?.balance || 0);

  useEffect(() => {
    fetchHistory();
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "https://kaynab-ai-backend.onrender.com") + "/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setWalletBalance(data.user.balance || 0);
        onUpdateUser(data.user);
      }
    } catch (e) {
      console.warn("Error fetching balance:", e);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "https://kaynab-ai-backend.onrender.com") + "/api/chat/quiz/my-exams", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setHistoryExams(data);
      }
    } catch (e) {
      console.error("Error fetching exams history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const calculateEstimatedCost = () => {
    const baseCost = 5;
    const perQuestionCost = 1.5;
    const answerKeyCost = 4;

    let cost = baseCost;
    cost += questionCount * perQuestionCost;
    if (includeAnswerKey) cost += answerKeyCost;

    return Math.ceil(cost);
  };

  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      alert('Fadlan qor casharka ama mawduuca aad rabto in laga sameeyo imtixaanka.');
      return;
    }

    const cost = calculateEstimatedCost();
    if (walletBalance < cost) {
      alert(`Credit kugu filan mahaysatid. Imtixaankan wuxuu u baahan yahay ${cost} Credits, laakiin waxaad haysataa ${walletBalance} Credits.`);
      return;
    }

    setLoading(true);
    setLoadingStep('AI is researching curriculum...');
    
    // Simulate stages
    const steps = [
      'Applying custom instructions & advanced formatting...',
      'Generating high-quality exam questions with marking guides...',
      'Creating/attaching illustrations & school logo...',
      'Compiling professional PDF and Word (.docx) formats...'
    ];
    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setLoadingStep(steps[stepIdx]);
        stepIdx++;
      }
    }, 2800);

    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "https://kaynab-ai-backend.onrender.com") + "/api/chat/quiz/generate-exam-pdf", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          subject,
          grade,
          topic: topic.trim(),
          questionCount,
          instructions: instructions.trim(),
          language: examLanguage,
          fontStyle: 'Times New Roman',
          pageCount: 'Auto',
          paragraphStyle: 'Standard',
          difficulty,
          includeAnswerKey
        })
      });

      clearInterval(interval);
      const data = await response.json();

      if (response.ok && data.pdfUrl) {
        fetchHistory();
        fetchWalletBalance();
        alert('✅ Imtixaankii Waa Diyaar! Furo PDF-ka si aad u akhrisato.');
        onOpenPdf(data.pdfUrl, data.title || topic, 'exam');
      } else {
        alert(data.message || 'Error generating exam');
      }
    } catch (err) {
      clearInterval(interval);
      alert('Cilad ayaa dhacday intii lagu guda jiray abuurista imtihan-ka.');
    } finally {
      setLoading(false);
    }
  };

  const getMediaUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return (process.env.NEXT_PUBLIC_API_URL || "https://kaynab-ai-backend.onrender.com") + `${path.startsWith('/') ? '' : '/'}${path}`;
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-6 py-6 scrollbar-none flex flex-col gap-6 bg-[#0D1117]">
      {/* Header */}
      <div className="flex items-center justify-between select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[#161B22] border border-gray-800 hover:bg-gray-800 text-blue-500 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-extrabold text-white">AI EXAM GENERATOR</h2>
            <p className="text-xs text-gray-500 font-medium">Create print-ready PDF exam papers automatically.</p>
          </div>
        </div>

        {/* Balance Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold select-none">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-blue-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a3 3 0 1 1 6 0M9 14a3 3 0 1 1 6 0" />
          </svg>
          <span>{walletBalance} Credits</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800 select-none">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-6 py-3.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'create' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-white'}`}
        >
          Create Exam
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3.5 text-xs font-bold border-b-2 transition-all ${activeTab === 'history' ? 'border-blue-500 text-blue-500' : 'border-transparent text-gray-500 hover:text-white'}`}
        >
          History ({historyExams.length})
        </button>
      </div>

      {activeTab === 'create' ? (
        /* Create Form */
        <form onSubmit={handleGenerateExam} className="w-full max-w-lg bg-[#161B22] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col gap-4">
          
          <div className="grid grid-cols-2 gap-4">
            {/* Subject */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-blue-500">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="px-4 py-3 bg-[#0D1117] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s} className="bg-[#161B22]">{s}</option>
                ))}
              </select>
            </div>

            {/* Grade */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-blue-500">Grade / Class</label>
              <select
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="px-4 py-3 bg-[#0D1117] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g} className="bg-[#161B22]">{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Topic */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-blue-500">Topic / Lesson</label>
            <input
              type="text"
              placeholder="e.g., Photosynthesis, Somaliland Civil War, Quadratic Equations"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="px-4 py-3 bg-[#0D1117] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Questions Count */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-blue-500">Questions Count</label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                className="px-4 py-3 bg-[#0D1117] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {QUESTION_COUNTS.map((q) => (
                  <option key={q} value={q} className="bg-[#161B22]">{q} Questions</option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-blue-500">Language</label>
              <select
                value={examLanguage}
                onChange={(e) => setExamLanguage(e.target.value)}
                className="px-4 py-3 bg-[#0D1117] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l} className="bg-[#161B22]">{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Special Instructions */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-blue-500">Special Instructions (Optional)</label>
            <textarea
              placeholder="e.g., Include questions about light reactions, make it multiple choice..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="px-4 py-3 h-20 bg-[#0D1117] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Difficulty */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-blue-500">Difficulty</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="px-4 py-3 bg-[#0D1117] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d} className="bg-[#161B22]">{d}</option>
                ))}
              </select>
            </div>

            {/* Answer Key */}
            <div className="flex items-center gap-3 pt-6 pl-1 select-none">
              <button
                type="button"
                onClick={() => setIncludeAnswerKey(!includeAnswerKey)}
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${includeAnswerKey ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-700'}`}
              >
                {includeAnswerKey && (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </button>
              <span className="text-xs text-gray-300 font-semibold">Include Answer Key</span>
            </div>
          </div>

          {/* Cost Preview */}
          <div className="flex justify-between items-center bg-[#0D1117] border border-gray-800 rounded-2xl p-4 mt-2 text-sm select-none">
            <span className="text-gray-400">Estimated Cost:</span>
            <span className="font-extrabold text-blue-500">{calculateEstimatedCost()} Credits</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-4 bg-gray-900/40 rounded-xl border border-gray-800 animate-pulse mt-4 select-none">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <span className="text-xs text-gray-400 font-bold text-center leading-relaxed">{loadingStep}</span>
            </div>
          ) : (
            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all active:scale-[0.98] mt-4"
            >
              Generate Exam Paper
            </button>
          )}

        </form>
      ) : (
        /* History list */
        <div className="w-full max-w-2xl flex flex-col gap-4">
          {loadingHistory ? (
            <div className="py-12 text-center text-xs text-gray-500 select-none">Loading history...</div>
          ) : historyExams.length > 0 ? (
            historyExams.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between p-5 bg-[#161B22] border border-gray-800 rounded-3xl hover:border-blue-555 transition-all shadow-sm select-text"
              >
                <div className="min-w-0 flex-1 pr-4">
                  <h4 className="text-sm font-bold text-white truncate leading-snug">{exam.title || exam.topic}</h4>
                  <div className="flex flex-wrap gap-2 items-center mt-2 text-[10px] text-gray-500 select-none font-medium">
                    <span className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700/30 uppercase">{exam.subject}</span>
                    <span>•</span>
                    <span>{exam.grade}</span>
                    <span>•</span>
                    <span>{new Date(exam.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {exam.status === 'pending' ? (
                  <span className="text-xs text-blue-500 font-bold animate-pulse select-none bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl">
                    Generating...
                  </span>
                ) : (
                  <div className="flex gap-2 select-none">
                    <button
                      onClick={() => onOpenPdf(exam.pdf_url, exam.title, 'exam')}
                      className="px-3.5 py-2 rounded-xl bg-blue-500 hover:bg-blue-605 text-white text-xs font-bold transition-all active:scale-95"
                    >
                      Read
                    </button>
                    {exam.word_url && (
                      <a
                        href={getMediaUrl(exam.word_url)}
                        download
                        className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-750 text-white text-xs font-bold transition-all active:scale-95 flex items-center justify-center"
                      >
                        Word
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="w-full py-12 text-center text-xs text-gray-500 bg-[#161B22] border border-gray-800 rounded-3xl p-6 select-none">
              Aad uma aadan abuurin wax imtixaan ah weli.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
