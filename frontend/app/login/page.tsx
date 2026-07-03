"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTheme } from '../context/ThemeContext';

export default function LoginScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    const token = localStorage.getItem('userToken');
    if (token) {
      router.replace('/');
    }
  }, [router]);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!identifier.trim() || !password) {
      setErrorMsg('Fadlan geli (Email/Username/WhatsApp number) iyo password-ka');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://kaynab-ai-backend.onrender.com') + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Gelitaanka wuu fashilmay. Fadlan isku day markale.');
      }

      localStorage.setItem('userToken', data.token);
      localStorage.setItem('userData', JSON.stringify(data.user));

      router.push('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Cilad ayaa dhacday');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 bg-[#0D1117] transition-colors duration-300">
      <div className="w-full max-w-[390px] flex flex-col gap-6">
        
        {/* Back Button */}
        <button 
          onClick={() => router.back()} 
          className="self-start w-10 h-10 rounded-full flex items-center justify-center bg-[#1D4ED8]/10 border border-[#3B82F6]/30 text-[#3B82F6] hover:bg-[#1D4ED8]/20 transition-all active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>

        {/* Login Card */}
        <div className="w-full bg-white dark:bg-[#161B22] rounded-2xl border-2 border-blue-500 shadow-xl p-6 sm:p-8 flex flex-col items-center">
          
          {/* Logo & Title */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 relative mb-4">
              <Image 
                src="/kaynab-logo.png" 
                alt="Kaynab AI Logo" 
                fill
                priority
                sizes="64px"
                className="object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-3xl font-extrabold text-blue-500 tracking-wider uppercase">LOGIN</h1>
          </div>

          <form onSubmit={handleLogin} className="w-full flex flex-col gap-5">
            
            {/* Identifier Field: Email / Username / WhatsApp */}
            <div className="flex flex-col gap-1.5 w-full">
              <label className="text-xs font-semibold text-blue-500 ml-1">Email / Username / WhatsApp Number</label>
              <div className={`flex items-center border-2 rounded-xl overflow-hidden bg-gray-50 dark:bg-[#0D1117] transition-all duration-200 ${identifierFocused ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-gray-800'}`}>
                <input
                  type="text"
                  placeholder="Enter email, username or WhatsApp number"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  onFocus={() => setIdentifierFocused(true)}
                  onBlur={() => setIdentifierFocused(false)}
                  className="flex-1 px-4 py-3.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none text-base"
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  className="flex-1 px-4 py-3.5 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none text-base"
                  required
                />
                
                {/* Eye Show/Hide Toggle */}
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

            {/* Forgot Password */}
            <button
              type="button"
              onClick={() => alert('For password reset, please contact support@kaynabai.com')}
              className="text-right text-xs font-semibold text-blue-500 hover:underline active:scale-95 transition-all self-end"
            >
              Forgot password?
            </button>

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
                'Log in'
              )}
            </button>

          </form>

          {/* Sign up link */}
          <div className="flex items-center gap-1.5 mt-6 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            <span>Do not have an account?</span>
            <button 
              onClick={() => router.push('/signup')}
              className="font-bold text-blue-500 hover:underline active:scale-95 transition-all"
            >
              Sign up here
            </button>
          </div>

        </div>
      </div>



    </div>
  );
}
