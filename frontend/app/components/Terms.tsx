"use client";

import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

interface TermsProps {
  onComplete: (updatedUser: any) => void;
}

export default function Terms({ onComplete }: TermsProps) {
  const { language } = useTheme();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showContentModal, setShowContentModal] = useState(false);

  const handleAcceptTerms = async () => {
    if (!accepted) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('userToken');
      if (!token) throw new Error(language === 'so' ? "Fadlan dib u gal App-ka (Login)" : "Session expired. Please login again.");

      const response = await fetch((process.env.NEXT_PUBLIC_API_URL || "https://kaynab-ai-backend.onrender.com") + "/api/auth/terms", {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Waa la keydin waayay');

      const cached = localStorage.getItem('userData');
      let updatedUser = {};
      if (cached) {
        const user = JSON.parse(cached);
        updatedUser = { ...user, terms_accepted_at: new Date().toISOString() };
        localStorage.setItem('userData', JSON.stringify(updatedUser));
      }

      onComplete(updatedUser);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-6 bg-[#0D1117]">
      <div className="w-full max-w-[390px] bg-[#161B22] border border-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[480px]">
        
        <div className="flex flex-col">
          <h1 className="text-3xl font-extrabold text-blue-500 tracking-wide uppercase mb-3">
            {language === 'so' ? 'shuruudaha' : 'terms'}
          </h1>
          <h2 className="text-sm font-bold text-gray-300 mb-6 uppercase">
            {language === 'so' ? 'Iyo Xeerarka Nidaamka' : 'and conditions'}
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            {language === 'so'
              ? 'Fadlan akhri oo aqbal shuruudaha iyo xeerarka isticmaalka nidaamka si aad u sii waddo isticmaalka adeegyadeena.'
              : 'Please review our updated policies and agree to the terms of service to continue using the application.'}
          </p>

          {errorMsg && (
            <p className="text-red-500 text-xs font-semibold mb-6">
              {errorMsg}
            </p>
          )}

          {/* Checkbox */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setAccepted(!accepted)}
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${accepted ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-600 bg-transparent'}`}
            >
              {accepted && (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              )}
            </button>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-300">{language === 'so' ? 'Waxaan aqbalay' : 'I accept'}</span>
              <button 
                onClick={() => setShowContentModal(true)}
                className="text-blue-500 font-bold hover:underline"
              >
                {language === 'so' ? 'Shuruudaha Isticmaalka' : 'terms and conditions'}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={handleAcceptTerms}
          disabled={!accepted || loading}
          className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${accepted && !loading ? 'bg-blue-500 hover:bg-blue-600 text-white active:scale-[0.98]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            language === 'so' ? 'Furan App-ka' : 'open the app'
          )}
        </button>

      </div>

      {/* Terms Content Modal */}
      {showContentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-[#161B22] border border-gray-800 rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Shuruudaha & Xeerarka</h3>
              <button 
                onClick={() => setShowContentModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-300 space-y-4 leading-relaxed scrollbar-thin">
              <p className="font-bold text-blue-555">Qodobka 1aad: Isticmaalka Adeegga</p>
              <p>Kaynab AI waxaa loo dhisay in ay ka caawiso ardayda iyo barayaasha dhinacyada waxbarashada iyada oo la adeegsanayo caqli-gacmeedka (AI).</p>
              
              <p className="font-bold text-blue-555">Qodobka 2aad: Mas'uuliyadda Koontada</p>
              <p>Waxaa laguu oggol yahay hal koonto oo keliya. Waa in aad ilaaliso nabadgelyada password-kaaga.</p>
              
              <p className="font-bold text-blue-555">Qodobka 3aad: Bixinta Lacagaha</p>
              <p>Adeegga wuxuu leeyahay credits (credits-ka caadiga ah iyo dating coins). Marka dhibcaha kaa dhamaadaan, waxaad ku shuban kartaa adigoo isticmaalaya nidaamka lacag-bixinta ee app-ka dhexdiisa ah.</p>

              <p className="font-bold text-blue-555">Qodobka 4aad: Xakameynta Waxyaabaha Mamnuuca ah</p>
              <p>Waa mamnuuc in loo isticmaalo nidaamka ujeedooyin xad-gudub ah, aflagaado, faafinta macluumaad been abuur ah ama waxyeello u geysanaya bulshada.</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
