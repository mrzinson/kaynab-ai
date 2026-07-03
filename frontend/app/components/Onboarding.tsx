"use client";

import React, { useState } from 'react';

interface OnboardingProps {
  onComplete: (updatedUser: any) => void;
}

const COUNTRIES = [
  { name: 'United States', code: 'US', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
  { name: 'Canada', code: 'CA', flag: '🇨🇦' },
  { name: 'Australia', code: 'AU', flag: '🇦🇺' },
  { name: 'Germany', code: 'DE', flag: '🇩🇪' },
  { name: 'France', code: 'FR', flag: '🇫🇷' },
  { name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
  { name: 'Sweden', code: 'SE', flag: '🇸🇪' },
  { name: 'Norway', code: 'NO', flag: '🇳🇴' },
  { name: 'Finland', code: 'FI', flag: '🇫🇮' },
  { name: 'Turkey', code: 'TR', flag: '🇹🇷' },
  { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
  { name: 'UAE', code: 'AE', flag: '🇦🇪' },
  { name: 'Somalia', code: 'SO', flag: '🇸🇴' },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪' },
  { name: 'Ethiopia', code: 'ET', flag: '🇪🇹' },
  { name: 'Djibouti', code: 'DJ', flag: '🇩🇯' },
  { name: 'Uganda', code: 'UG', flag: '🇺🇬' },
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
  { name: 'South Africa', code: 'ZA', flag: '🇿🇦' },
  { name: 'India', code: 'IN', flag: '🇮🇳' },
  { name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
  { name: 'Other', code: '??', flag: '🌍' },
];

const GOALS = [
  {
    id: 'student',
    icon: '🎓',
    title: 'University Student',
    description: 'Research papers, essays, assignments',
    color: 'blue',
  },
  {
    id: 'researcher',
    icon: '🔬',
    title: 'Researcher',
    description: 'Academic research, literature review',
    color: 'purple',
  },
  {
    id: 'professional',
    icon: '💼',
    title: 'Professional',
    description: 'Reports, analysis, business writing',
    color: 'emerald',
  },
  {
    id: 'developer',
    icon: '💻',
    title: 'Developer',
    description: 'Coding help, technical documentation',
    color: 'orange',
  },
  {
    id: 'creative',
    icon: '✍️',
    title: 'Creative Writer',
    description: 'Stories, content creation, ideas',
    color: 'pink',
  },
  {
    id: 'other',
    icon: '🌐',
    title: 'Other',
    description: 'General use and exploration',
    color: 'gray',
  },
];

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500',    text: 'text-blue-400' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500',  text: 'text-purple-400' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500', text: 'text-emerald-400' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500',  text: 'text-orange-400' },
  pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500',    text: 'text-pink-400' },
  gray:    { bg: 'bg-gray-500/10',    border: 'border-gray-500',    text: 'text-gray-400' },
};

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [goal, setGoal] = useState('');
  const [country, setCountry] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const filteredCountries = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const selectedGoalObj = GOALS.find((g) => g.id === goal);
  const selectedCountryObj = COUNTRIES.find((c) => c.name === country);

  const handleGoalSelect = (id: string) => {
    setGoal(id);
    setStep(2);
  };

  const handleCountrySelect = (name: string) => {
    setCountry(name);
    setStep(3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('userToken');
      if (!token) throw new Error('Session expired. Please log in again.');

      const response = await fetch(
        (process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com') + '/api/user/profile',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ country, gender: 'other', region_state: goal }),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Error saving data');

      const cached = localStorage.getItem('userData');
      let updatedUser: any = {};
      if (cached) {
        const user = JSON.parse(cached);
        updatedUser = { ...user, country, gender: 'other', region_state: goal };
        localStorage.setItem('userData', JSON.stringify(updatedUser));
      }

      onComplete(updatedUser);
    } catch (err: any) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 bg-[#0D1117]">
      <div className="w-full max-w-[440px] flex flex-col items-center gap-4">

        {/* Brand Header */}
        <div className="flex flex-col items-center mb-2">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center font-black text-2xl text-blue-500 mb-3">
            KB
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Welcome to Kaynab AI</h1>
          <p className="text-sm text-gray-400 mt-1 text-center">Let's personalise your experience in a few quick steps</p>
        </div>

        {/* Progress Bar */}
        <div className="w-full flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                s <= step ? 'bg-blue-500' : 'bg-gray-800'
              }`}
            />
          ))}
        </div>
        <p className="text-xs text-gray-500 self-end">Step {step} of 3</p>

        {/* Card */}
        <div className="w-full bg-[#161B22] border border-gray-800 rounded-2xl shadow-2xl p-6 sm:p-8">

          {/* Step 1: Goal */}
          {step === 1 && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-lg font-bold text-white mb-1">What best describes you?</h2>
              <p className="text-sm text-gray-400 mb-6">Help us tailor Kaynab AI to your needs.</p>
              <div className="grid grid-cols-2 gap-3">
                {GOALS.map((g) => {
                  const c = colorMap[g.color];
                  return (
                    <button
                      key={g.id}
                      onClick={() => handleGoalSelect(g.id)}
                      className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all active:scale-[0.97] text-left
                        ${goal === g.id ? `${c.bg} ${c.border}` : 'bg-[#0D1117] border-gray-800 hover:border-gray-600'}`}
                    >
                      <span className="text-2xl mb-2">{g.icon}</span>
                      <span className={`text-sm font-bold ${goal === g.id ? c.text : 'text-white'}`}>{g.title}</span>
                      <span className="text-xs text-gray-500 mt-0.5 leading-snug">{g.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Country */}
          {step === 2 && (
            <div className="animate-in fade-in duration-300">
              <button
                onClick={() => setStep(1)}
                className="text-xs text-blue-500 font-semibold hover:underline mb-4 flex items-center gap-1"
              >
                ← Back
              </button>
              <h2 className="text-lg font-bold text-white mb-1">Where are you based?</h2>
              <p className="text-sm text-gray-400 mb-4">Select your country of residence.</p>

              {/* Search */}
              <div className="flex items-center bg-[#0D1117] border border-gray-700 rounded-xl px-3 py-2 mb-3 gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search country..."
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[300px] pr-0.5">
                {filteredCountries.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => handleCountrySelect(c.name)}
                    className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border transition-all text-left active:scale-[0.98]
                      ${country === c.name
                        ? 'bg-blue-500/10 border-blue-500 text-white'
                        : 'bg-[#0D1117] border-gray-800 hover:border-gray-600 text-white'}`}
                  >
                    <span className="text-xl leading-none">{c.flag}</span>
                    <span className="text-sm font-medium">{c.name}</span>
                    {country === c.name && (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4 text-blue-500 ml-auto">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="animate-in fade-in duration-300">
              <button
                onClick={() => setStep(2)}
                className="text-xs text-blue-500 font-semibold hover:underline mb-4 flex items-center gap-1"
              >
                ← Back
              </button>
              <h2 className="text-lg font-bold text-white mb-1">You're all set! 🎉</h2>
              <p className="text-sm text-gray-400 mb-6">Review your selections before we personalise your workspace.</p>

              <div className="w-full bg-[#0D1117] border border-gray-800 rounded-xl p-4 mb-6 flex flex-col gap-4">
                {/* Goal */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-xl">
                    {selectedGoalObj?.icon}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">I am a</p>
                    <p className="text-sm font-semibold text-white">{selectedGoalObj?.title}</p>
                  </div>
                  <button onClick={() => setStep(1)} className="ml-auto text-xs text-blue-500 hover:underline">Edit</button>
                </div>

                <div className="border-t border-gray-800" />

                {/* Country */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-xl">
                    {selectedCountryObj?.flag}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Based in</p>
                    <p className="text-sm font-semibold text-white">{country}</p>
                  </div>
                  <button onClick={() => setStep(2)} className="ml-auto text-xs text-blue-500 hover:underline">Edit</button>
                </div>
              </div>

              {errorMsg && (
                <p className="text-red-500 text-xs font-semibold text-center mb-4">{errorMsg}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-white bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Launch My Workspace</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
