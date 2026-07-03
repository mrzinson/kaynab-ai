"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'next/navigation';

interface SettingsViewProps {
  onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
  const { colors, language, isDark, t } = useTheme();
  const router = useRouter();

  // Notification states
  const [notifSound, setNotifSound] = useState(true);
  const [notifAlerts, setNotifAlerts] = useState(true);
  const [notifUpdates, setNotifUpdates] = useState(true);

  // Privacy states
  const [privSaveHistory, setPrivSaveHistory] = useState(true);
  const [privIncognito, setPrivIncognito] = useState(false);

  // Cache state
  const [cacheSize, setCacheSize] = useState('14.2 MB');
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Load settings on mount
  useEffect(() => {
    const sound = localStorage.getItem('settings_notif_sound');
    if (sound !== null) setNotifSound(sound === 'true');

    const alerts = localStorage.getItem('settings_notif_alerts');
    if (alerts !== null) setNotifAlerts(alerts === 'true');

    const updates = localStorage.getItem('settings_notif_updates');
    if (updates !== null) setNotifUpdates(updates === 'true');

    const history = localStorage.getItem('settings_priv_save_history');
    if (history !== null) setPrivSaveHistory(history === 'true');

    const incognito = localStorage.getItem('settings_priv_incognito');
    if (incognito !== null) setPrivIncognito(incognito === 'true');

    const size = localStorage.getItem('settings_cache_size');
    if (size !== null) setCacheSize(size);
  }, []);

  const saveSetting = (key: string, value: boolean) => {
    localStorage.setItem(key, String(value));
  };

  const handleClearCache = () => {
    if (cacheSize === '0.0 MB') {
      alert(language === 'so' ? 'Khasnadda app-ka mar hore ayaa la nadiifiyey!' : 'App cache is already cleared!');
      return;
    }

    const conf = window.confirm(
      language === 'so'
        ? `Ma hubtaa inaad rabto inaad nadiifiso ${cacheSize} oo xog kumeel-gaar ah?`
        : `Are you sure you want to clear ${cacheSize} of temporary cached data?`
    );

    if (conf) {
      setIsClearingCache(true);
      // Remove cached API endpoints
      localStorage.removeItem('home_books');
      localStorage.removeItem('home_exams');
      localStorage.removeItem('exams_list');

      setTimeout(() => {
        setCacheSize('0.0 MB');
        localStorage.setItem('settings_cache_size', '0.0 MB');
        setIsClearingCache(false);
        alert(language === 'so' ? 'Khasnadda app-ka (Cache) si guul leh ayaa loo nadiifiyey! 🧹' : 'App cache has been cleared successfully! 🧹');
      }, 1500);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setErrorMsg('');
    try {
      const token = localStorage.getItem('userToken');
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || "https://kaynab-ai-backend.onrender.com") + "/api/user/account", {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        setShowDeleteModal(false);
        router.push('/login');
      } else {
        const data = await res.json();
        setErrorMsg(data.message || 'Tirtirida koontadu way guuldareysatay');
      }
    } catch (e) {
      setErrorMsg('Fadlan hubi internet-kaaga');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-6 py-6 scrollbar-none flex flex-col gap-6 bg-[#0D1117]">
      {/* Header */}
      <div className="flex items-center gap-3 select-none">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[#161B22] border border-gray-800 hover:bg-gray-800 text-blue-500 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div>
          <h2 className="text-2xl font-extrabold text-white">Settings</h2>
          <p className="text-xs text-gray-500 font-medium">Manage your notifications, privacy, and account settings.</p>
        </div>
      </div>

      <div className="w-full max-w-xl flex flex-col gap-6 select-none">
        {/* Notifications Section */}
        <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-6 shadow-lg flex flex-col gap-4">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-1">Notifications</h3>

          {/* Sound Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Notification Sounds</span>
              <span className="text-[10px] text-gray-500 font-medium mt-0.5">Play sound on new messages</span>
            </div>
            <button
              onClick={() => { setNotifSound(!notifSound); saveSetting('settings_notif_sound', !notifSound); }}
              className={`w-12 h-6 rounded-full relative flex items-center p-0.5 transition-all border ${notifSound ? 'bg-blue-500/10 border-blue-500/20' : 'bg-gray-800/40 border-gray-800'}`}
            >
              <div className={`w-5 h-5 rounded-full transition-all ${notifSound ? 'bg-blue-500 translate-x-6' : 'bg-gray-650 translate-x-0'}`} />
            </button>
          </div>

          <div className="h-[1px] bg-gray-800/60" />

          {/* Alerts Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Push Notifications</span>
              <span className="text-[10px] text-gray-500 font-medium mt-0.5">Show banner on new updates</span>
            </div>
            <button
              onClick={() => { setNotifAlerts(!notifAlerts); saveSetting('settings_notif_alerts', !notifAlerts); }}
              className={`w-12 h-6 rounded-full relative flex items-center p-0.5 transition-all border ${notifAlerts ? 'bg-blue-500/10 border-blue-500/20' : 'bg-gray-800/40 border-gray-800'}`}
            >
              <div className={`w-5 h-5 rounded-full transition-all ${notifAlerts ? 'bg-blue-500 translate-x-6' : 'bg-gray-650 translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-6 shadow-lg flex flex-col gap-4">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-1">Privacy & Security</h3>

          {/* Save History */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Save Chat History</span>
              <span className="text-[10px] text-gray-500 font-medium mt-0.5">Keep a record of your AI wada-hadalka</span>
            </div>
            <button
              onClick={() => { setPrivSaveHistory(!privSaveHistory); saveSetting('settings_priv_save_history', !privSaveHistory); }}
              className={`w-12 h-6 rounded-full relative flex items-center p-0.5 transition-all border ${privSaveHistory ? 'bg-blue-500/10 border-blue-500/20' : 'bg-gray-800/40 border-gray-800'}`}
            >
              <div className={`w-5 h-5 rounded-full transition-all ${privSaveHistory ? 'bg-blue-500 translate-x-6' : 'bg-gray-650 translate-x-0'}`} />
            </button>
          </div>

          <div className="h-[1px] bg-gray-800/60" />

          {/* Incognito */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Incognito Mode</span>
              <span className="text-[10px] text-gray-500 font-medium mt-0.5">Do not save messages to history</span>
            </div>
            <button
              onClick={() => { setPrivIncognito(!privIncognito); saveSetting('settings_priv_incognito', !privIncognito); }}
              className={`w-12 h-6 rounded-full relative flex items-center p-0.5 transition-all border ${privIncognito ? 'bg-blue-500/10 border-blue-500/20' : 'bg-gray-800/40 border-gray-800'}`}
            >
              <div className={`w-5 h-5 rounded-full transition-all ${privIncognito ? 'bg-blue-500 translate-x-6' : 'bg-gray-650 translate-x-0'}`} />
            </button>
          </div>
        </div>

        {/* Utilities Section */}
        <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-6 shadow-lg flex flex-col gap-4">
          <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mb-1">Utilities</h3>

          {/* Clear Cache */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Clear App Cache</span>
              <span className="text-[10px] text-gray-500 font-medium mt-0.5">Temporary files size: {cacheSize}</span>
            </div>
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="px-4 py-2 text-xs font-bold bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-all"
            >
              {isClearingCache ? 'Clearing...' : 'Clear Cache'}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-6 shadow-lg flex flex-col gap-4">
          <h3 className="text-xs font-bold text-red-400 tracking-wider uppercase mb-1">Danger Zone</h3>

          {/* Delete Account */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-red-500">Delete Account</span>
              <span className="text-[10px] text-red-500/70 font-medium mt-0.5">Permanently delete your profile and logs</span>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all shadow-md"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-[#161B22] border border-gray-800 rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl relative">
            <h4 className="text-lg font-black text-red-500 text-center">Tirtirida Akoonka</h4>
            <p className="text-xs text-gray-300 leading-relaxed text-center font-medium">
              Ma hubtaa inaad rabto inaad tirtirto akoonkaaga Kaynab AI? Talaabadan dib looma soo celin karo, dhammaan credits-kaaga iyo taariikhdaadu way tirtirmi doonaan.
            </p>

            {errorMsg && <p className="text-xs text-red-500 font-semibold text-center mt-1">{errorMsg}</p>}

            <div className="grid grid-cols-2 gap-3 mt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="py-3 rounded-xl text-xs font-bold bg-[#0D1117] border border-gray-800 hover:bg-gray-800 text-gray-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                className="py-3 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition-all flex items-center justify-center gap-2 shadow-md"
              >
                {isDeleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
