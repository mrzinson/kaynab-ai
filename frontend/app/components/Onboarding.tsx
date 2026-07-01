"use client";

import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

interface OnboardingProps {
  onComplete: (updatedUser: any) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { language } = useTheme();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [country, setCountry] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const COUNTRIES = [
    { name: 'Somaliland', code: 'SL', flag: '🏴' },
    { name: 'Puntland', code: 'PL', flag: '🏴' },
    { name: 'Somalia', code: 'SO', flag: '🇸🇴' },
    { name: 'Kenya', code: 'KE', flag: '🇰🇪' },
    { name: 'Ethiopia', code: 'ET', flag: '🇪🇹' },
    { name: 'Djibouti', code: 'DJ', flag: '🇩🇯' },
    { name: 'Uganda', code: 'UG', flag: '🇺🇬' },
    { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
    { name: 'United States', code: 'US', flag: '🇺🇸' },
    { name: 'Sweden', code: 'SE', flag: '🇸🇪' },
    { name: 'Norway', code: 'NO', flag: '🇳🇴' },
    { name: 'Finland', code: 'FI', flag: '🇫🇮' },
    { name: 'Canada', code: 'CA', flag: '🇨🇦' },
    { name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
    { name: 'Germany', code: 'DE', flag: '🇩🇪' },
    { name: 'Other', code: '??', flag: '🌍' },
  ];

  const handleGenderSelect = (selectedGender: 'male' | 'female') => {
    setGender(selectedGender);
    setStep(2);
  };

  const handleCountrySelect = (selectedCountry: string) => {
    setCountry(selectedCountry);
    setStep(3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('userToken');
      if (!token) throw new Error(language === 'so' ? 'Kalfadhigaagu wuu dhacay. Fadlan mar kale soo gal.' : 'Session expired. Please login again.');

      const response = await fetch(`https://darkpen-backend.onrender.com/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          gender,
          country,
          region_state: null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Error saving data');
      }

      // Update local storage
      const cached = localStorage.getItem('userData');
      let updatedUser = {};
      if (cached) {
        const user = JSON.parse(cached);
        updatedUser = { ...user, gender, country, region_state: null };
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
      <div className="w-full max-w-[390px] bg-[#161B22] border border-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col items-center">
        
        {/* Progress header */}
        <div className="w-full flex items-center justify-between mb-8 text-xs text-gray-500">
          {step > 1 && (
            <button 
              onClick={() => setStep(step - 1)}
              className="text-blue-500 font-semibold hover:underline"
            >
              ← Back
            </button>
          )}
          <div className="flex-1 text-right font-bold text-blue-500">
            {language === 'so' ? `Tallaabada ${step} ee 3` : `Step ${step} of 3`}
          </div>
        </div>

        {/* Step 1: Gender */}
        {step === 1 && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-white mb-2 text-center">
              {language === 'so' ? 'Dooro Jinsigaaga' : 'Select Your Gender'}
            </h2>
            <p className="text-sm text-gray-400 text-center mb-8">
              {language === 'so' 
                ? 'Fadlan dooro jinsigaaga si aan kuugu habeyno caawiyaha AI.'
                : 'Please choose your gender to help customize your AI assistant experience.'}
            </p>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button
                onClick={() => handleGenderSelect('male')}
                className="flex flex-col items-center p-6 bg-blue-500/5 hover:bg-blue-500/10 border-2 border-gray-800 hover:border-blue-500 rounded-2xl transition-all active:scale-[0.98]"
              >
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-blue-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-white mb-0.5">Lab</span>
                <span className="text-xs text-gray-500">Male</span>
              </button>

              <button
                onClick={() => handleGenderSelect('female')}
                className="flex flex-col items-center p-6 bg-pink-500/5 hover:bg-pink-500/10 border-2 border-gray-800 hover:border-pink-500 rounded-2xl transition-all active:scale-[0.98]"
              >
                <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8 text-pink-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-white mb-0.5">Dhedigs</span>
                <span className="text-xs text-gray-500">Female</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Country */}
        {step === 2 && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-white mb-2 text-center">
              {language === 'so' ? 'Wadankee degan tahay?' : 'Where do you live?'}
            </h2>
            <p className="text-sm text-gray-400 text-center mb-6">
              {language === 'so' 
                ? 'Dooro waddanka aad hadda joogto si loogu hagaajiyo nidaamka.'
                : 'Select the country you currently reside in.'}
            </p>

            <div className="w-full flex flex-col gap-2 overflow-y-auto max-h-[320px] pr-1">
              {COUNTRIES.map((c) => (
                <button
                  key={c.name}
                  onClick={() => handleCountrySelect(c.name)}
                  className="w-full flex items-center gap-3 py-3.5 px-4 bg-[#0D1117] hover:bg-[#0084FF]/10 hover:border-[#0084FF]/40 border border-gray-800 rounded-xl transition-all text-left active:scale-[0.98]"
                >
                  <span className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-black text-gray-300 shrink-0">
                    {c.flag === '🏴' ? c.code : <span className="text-lg">{c.flag}</span>}
                  </span>
                  <span className="text-sm font-semibold text-white">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="w-full flex flex-col items-center animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-white mb-2 text-center">
              {language === 'so' ? 'Xaqiiji Xogta' : 'Confirm Information'}
            </h2>
            <p className="text-sm text-gray-400 text-center mb-8">
              {language === 'so'
                ? 'Fadlan hubi xogta hoose ka hor inta aadan bilaabin.'
                : 'Please verify the details below before saving.'}
            </p>

            <div className="w-full bg-[#0D1117] border border-gray-800 rounded-xl p-4 mb-8 flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Jinsiga:</span>
                <span className="font-semibold text-white capitalize">{gender === 'male' ? 'Lab / Male' : 'Dhedigs / Female'}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-gray-800/50 pt-3">
                <span className="text-gray-400">Waddanka:</span>
                <span className="font-semibold text-white">{country}</span>
              </div>
            </div>

            {errorMsg && (
              <p className="text-red-500 text-xs font-semibold text-center mb-4">
                {errorMsg}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                language === 'so' ? 'Hada Bilow' : 'Save and Start'
              )}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
