"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface ProfileViewProps {
  userData: any;
  onUpdateUser: (updatedUser: any) => void;
  onClose: () => void;
}

export default function ProfileView({ userData, onUpdateUser, onClose }: ProfileViewProps) {
  const { language } = useTheme();
  const [name, setName] = useState(userData?.name || '');
  const [gender, setGender] = useState(userData?.gender || 'male');
  const [country, setCountry] = useState(userData?.country || 'Somalia');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const COUNTRIES = [
    'Somalia', 'Kenya', 'Ethiopia', 'Djibouti', 'Uganda', 
    'United Kingdom', 'United States', 'Sweden', 'Norway', 'Finland'
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch('https://darkpen-backend.onrender.com/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          gender,
          country,
          region_state: userData?.region_state || null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update profile');

      // Update cached user
      const updated = { ...userData, name, gender, country };
      localStorage.setItem('userData', JSON.stringify(updated));
      onUpdateUser(updated);
      setSuccessMsg(language === 'so' ? 'Profile-ka waa la keydiyay!' : 'Profile updated successfully!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-6 py-6 scrollbar-none flex flex-col gap-6 bg-[#0D1117]">
      {/* Header */}
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
          <h2 className="text-2xl font-extrabold text-white">Profile Settings</h2>
          <p className="text-xs text-gray-500 font-medium">Update your profile settings below.</p>
        </div>
      </div>

      <div className="w-full max-w-md bg-[#161B22] border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col items-center">
        {/* Avatar */}
        <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center text-white text-4xl font-black mb-6 select-none border-2 border-blue-500">
          DP
        </div>

        <form onSubmit={handleSave} className="w-full flex flex-col gap-4">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-blue-500 ml-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D1117] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {/* Gender */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-blue-500 ml-1">Gender</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`py-3 rounded-xl text-xs font-bold transition-all border ${gender === 'male' ? 'bg-blue-500/10 border-blue-500 text-blue-400' : 'bg-[#0D1117] border-gray-800 text-gray-400'}`}
              >
                Lab / Male
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`py-3 rounded-xl text-xs font-bold transition-all border ${gender === 'female' ? 'bg-pink-500/10 border-pink-500 text-pink-400' : 'bg-[#0D1117] border-gray-800 text-gray-400'}`}
              >
                Dhedigs / Female
              </button>
            </div>
          </div>

          {/* Country */}
          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-blue-500 ml-1">Country</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D1117] border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c} className="bg-[#161B22]">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {errorMsg && <p className="text-red-500 text-xs font-semibold text-center mt-2">{errorMsg}</p>}
          {successMsg && <p className="text-green-500 text-xs font-semibold text-center mt-2">{successMsg}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
