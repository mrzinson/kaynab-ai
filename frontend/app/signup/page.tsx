"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from '../context/ThemeContext';

export default function SignUpScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    if (token) {
      router.replace('/');
    }
  }, [router]);

  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Country Code Dropdown
  const [countryCode, setCountryCode] = useState('+252');
  const [countryFlag, setCountryFlag] = useState('🇸🇴');
  const [modalVisible, setModalVisible] = useState(false);

  const COUNTRIES = [
    { code: '+252', name: 'Somalia', flag: '🇸🇴' },
    { code: '+254', name: 'Kenya', flag: '🇰🇪' },
    { code: '+251', name: 'Ethiopia', flag: '🇪🇹' },
    { code: '+253', name: 'Djibouti', flag: '🇩🇯' },
    { code: '+256', name: 'Uganda', flag: '🇺🇬' },
    { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
    { code: '+1', name: 'United States/Canada', flag: '🇺🇸' },
    { code: '+90', name: 'Turkey', flag: '🇹🇷' },
    { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
    { code: '+46', name: 'Sweden', flag: '🇸🇪' },
    { code: '+47', name: 'Norway', flag: '🇳🇴' },
    { code: '+358', name: 'Finland', flag: '🇫🇮' }
  ];

  const normalizePhone = (code: string, num: string) => {
    let cleanNum = num.replace(/\D/g, ''); // strip non-digits
    if (cleanNum.startsWith('0')) {
      cleanNum = cleanNum.slice(1);
    }
    const codeDigits = code.replace(/\D/g, '');
    if (cleanNum.startsWith(codeDigits)) {
      cleanNum = cleanNum.slice(codeDigits.length);
    }
    return `${code}${cleanNum}`;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const fullNumber = normalizePhone(countryCode, whatsappNumber);
    if (!name.trim() || !whatsappNumber.trim() || !password) {
      setErrorMsg('Fadlan buuxi magaca, number-ka iyo password-ka');
      return;
    }
    if (password.length < 8) {
      setErrorMsg('Password-ku waa inuu ahaadaa ugu yaraan 8 xaraf');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`https://darkpen-backend.onrender.com/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          whatsapp_number: fullNumber,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data.user));

      router.push('/'); // Will handle terms & onboarding inline on main page
    } catch (err: any) {
      setErrorMsg(err.message || 'Cilad ayaa dhacday');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 bg-[#0D1117] transition-colors duration-300">
      <div className="w-full max-w-[390px] flex flex-col gap-6">
        
        {/* Signup Card */}
        <div className="w-full bg-white dark:bg-[#161B22] rounded-2xl border-2 border-blue-500 shadow-xl p-6 sm:p-8 flex flex-col items-center">
          
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 relative mb-4">
              <Image 
                src="/darkpen-logo-blue.png" 
                alt="Darkpen Logo" 
                fill
                priority
                sizes="64px"
                className="object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100';
                }}
              />
            </div>
            <h1 className="text-3xl font-extrabold text-blue-500 tracking-wider uppercase">SIGNUP</h1>
          </div>

          <form onSubmit={handleSignup} className="w-full flex flex-col gap-4">
            
            {/* Full Name Field */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-blue-500 ml-1">Full Name</label>
              <div className={`flex items-center border-2 rounded-xl overflow-hidden bg-gray-50 dark:bg-[#0D1117] transition-all duration-200 ${nameFocused ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-800'}`}>
                <input
                  type="text"
                  placeholder="Magacaaga oo buuxa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  className="flex-1 px-4 py-3.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none text-base"
                  required
                />
              </div>
            </div>

            {/* WhatsApp Number Field */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-blue-500 ml-1">WhatsApp Number</label>
              <div className={`flex items-center border-2 rounded-xl overflow-hidden bg-gray-50 dark:bg-[#0D1117] transition-all duration-200 ${phoneFocused ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-800'}`}>
                
                {/* Country Code Picker */}
                <button
                  type="button"
                  onClick={() => setModalVisible(true)}
                  className="flex items-center gap-1.5 px-3 py-3.5 bg-gray-100 dark:bg-gray-855 border-r border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                >
                  <span>{countryFlag} {countryCode}</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-gray-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>

                <input
                  type="tel"
                  placeholder="61XXXXXXX"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  className="flex-1 px-4 py-3 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none text-base"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="flex flex-col gap-1.5 w-full relative">
              <label className="text-xs font-semibold text-blue-500 ml-1">Password</label>
              <div className={`flex items-center border-2 rounded-xl overflow-hidden bg-gray-50 dark:bg-[#0D1117] transition-all duration-200 ${passwordFocused ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-800'}`}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Ahaada ugu yaraan 8 xaraf"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  className="flex-1 px-4 py-3.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none text-base"
                  required
                />
                
                {/* Eye Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-3 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <p className="text-red-500 dark:text-red-400 text-xs font-semibold text-center leading-relaxed">
                {errorMsg}
              </p>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-white text-base bg-blue-500 hover:bg-blue-600 active:scale-[0.98] transition-all flex items-center justify-center ${loading ? 'opacity-85 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>PROCESSING...</span>
                </div>
              ) : (
                'Create Account'
              )}
            </button>

          </form>

          {/* Login redirection */}
          <div className="flex items-center gap-1.5 mt-6 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <span>Already have an account?</span>
            <button 
              onClick={() => router.push('/login')}
              className="font-bold text-blue-500 hover:underline active:scale-95 transition-all"
            >
              Log in here
            </button>
          </div>

        </div>
      </div>

      {/* Country Code Modal */}
      {modalVisible && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="absolute inset-0" onClick={() => setModalVisible(false)}></div>
          
          <div className="relative w-full sm:max-w-md bg-white dark:bg-[#161B22] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[60vh] flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Dooro Waddanka</h3>
              <button 
                onClick={() => setModalVisible(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-2 divide-y divide-gray-100 dark:divide-gray-800">
              {COUNTRIES.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    setCountryCode(item.code);
                    setCountryFlag(item.flag);
                    setModalVisible(false);
                  }}
                  className="w-full flex items-center justify-between py-4 px-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-all"
                >
                  <span className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-3">
                    <span className="text-xl leading-none">{item.flag}</span>
                    <span>{item.name} ({item.code})</span>
                  </span>
                  {countryCode === item.code && (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 text-blue-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
