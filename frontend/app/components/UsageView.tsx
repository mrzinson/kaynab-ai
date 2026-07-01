"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface UsageData {
  planName: string;
  balance: number;
  limit: number;
  used: number;
  percentage: number;
  expiryDate: string | null;
}

interface BreakdownItem {
  type: string;
  label: string;
  icon: string;
  color: string;
  count: number;
  credits: number;
}

interface UsageViewProps {
  onClose: () => void;
  onGoToBilling: () => void;
}

export default function UsageView({ onClose, onGoToBilling }: UsageViewProps) {
  const { language } = useTheme();
  const [loading, setLoading] = useState(true);
  const [standardUsage, setStandardUsage] = useState<UsageData | null>(null);
  const [shukaansiUsage, setShukaansiUsage] = useState<UsageData | null>(null);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);

  const fetchUsage = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch(`https://darkpen-backend.onrender.com/api/user/usage`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setStandardUsage(data.standard);
        setShukaansiUsage(data.shukaansi);
        setBreakdown(data.breakdown || []);
      }
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'so' ? 'so-SO' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getRemainingDays = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diffMs = new Date(dateStr).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
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
            <h2 className="text-2xl font-extrabold text-white">
              {language === 'so' ? 'Isticmaalka (Usage)' : 'Isticmaalka (Usage)'}
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              {language === 'so' ? 'Koontadaada iyo xisaabta kharashka ku baxay' : 'Your account usage limits and cost breakdown'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchUsage}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[#161B22] border border-gray-850 hover:bg-gray-800 text-gray-400 hover:text-white transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-550 font-bold mt-4">
            {language === 'so' ? 'Soo akhrinayaa xogta isticmaalka...' : 'Loading usage details...'}
          </span>
        </div>
      ) : (
        <div className="w-full max-w-2xl flex flex-col gap-6 select-none">
          {/* Wallets Title */}
          <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase">Qorshayaasha & Isticmaalka</h3>

          {/* Standard Wallet Card */}
          {standardUsage && (
            <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-6 shadow-lg flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l8.982-8.983m-9 9 9-9m-9 9-2.25-2.25m11.25-6.75 2.25-2.25m-13.5 0h13.5M9 7.5h.008v.008H9V7.5Z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase leading-none">AI Chat & Imtixaanada</span>
                    <h4 className="text-base font-extrabold text-blue-500 mt-0.5">{standardUsage.planName}</h4>
                  </div>
                </div>
                <span className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold">
                  {100 - standardUsage.percentage}% Hadhaaga
                </span>
              </div>

              {/* Progress Bar */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div 
                    style={{ width: `${Math.max(0, 100 - standardUsage.percentage)}%` }} 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>{standardUsage.balance} Credits oo u hadhay</span>
                  <span>Xadka: {standardUsage.limit}</span>
                </div>
              </div>

              {/* Expiry */}
              {standardUsage.expiryDate && (
                <div className="flex items-center gap-2 border-t border-gray-800/60 pt-3 text-xs text-gray-400 font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <span>
                    {getRemainingDays(standardUsage.expiryDate)! <= 2 
                      ? `Wuxuu dhacayaa ${getRemainingDays(standardUsage.expiryDate)} casho gudahood!` 
                      : `Wuxuu dhacayaa taariikhda: ${formatDate(standardUsage.expiryDate)}`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Shukaansi Wallet Card */}
          {shukaansiUsage && (
            <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-6 shadow-lg flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 font-bold uppercase leading-none">Chat-ka Shukaansiga</span>
                    <h4 className="text-base font-extrabold text-pink-550 mt-0.5">{shukaansiUsage.planName}</h4>
                  </div>
                </div>
                <span className="px-2.5 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-500 text-xs font-bold">
                  {100 - shukaansiUsage.percentage}% Hadhaaga
                </span>
              </div>

              {/* Progress Bar */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                  <div 
                    style={{ width: `${Math.max(0, 100 - shukaansiUsage.percentage)}%` }} 
                    className="h-full bg-pink-500 rounded-full transition-all duration-500"
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 font-medium">
                  <span>{shukaansiUsage.balance} Coins oo u hadhay</span>
                  <span>Xadka: {shukaansiUsage.limit}</span>
                </div>
              </div>

              {/* Expiry */}
              <div className="flex items-center gap-2 border-t border-gray-800/60 pt-3 text-xs text-green-500 font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-green-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span>
                  {shukaansiUsage.expiryDate
                    ? `Bille wuxuu dhacayaa: ${formatDate(shukaansiUsage.expiryDate)}`
                    : 'Credit-kan ma dhacayo ilaa aad dhameysato (No expiry).'}
                </span>
              </div>
            </div>
          )}

          {/* Breakdown Section */}
          <h3 className="text-xs font-bold text-gray-400 tracking-wider uppercase mt-4">Xisaabta Kharashka ku Baxay</h3>

          {breakdown.length === 0 ? (
            <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-gray-600 mb-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" />
              </svg>
              <span className="text-xs text-gray-500 font-bold">Wali wax kharash ah laguma dhex qorin koontadaada.</span>
            </div>
          ) : (
            <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-6 shadow-lg flex flex-col">
              {breakdown.map((item, idx) => (
                <div key={item.type}>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div 
                        style={{ backgroundColor: `${item.color}15`, color: item.color }} 
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 1 1 1.063.852l-.708.283a.75.75 0 0 0-.475.695v.283m0-.005H12m-.25-4.125h.008v.008h-.008V7.5Z" />
                        </svg>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white leading-tight">{item.label}</span>
                        <span className="text-[10px] text-gray-550 font-bold mt-0.5">{item.count} jeer oo la isticmaalay</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span style={{ color: item.color }} className="text-sm font-black">-{item.credits} Credits</span>
                      <span className="text-[9px] text-gray-500 font-bold mt-0.5">
                        {standardUsage ? `${Math.round((item.credits / standardUsage.limit) * 100)}% qorshaha` : ''}
                      </span>
                    </div>
                  </div>
                  {idx < breakdown.length - 1 && <div className="h-[1px] bg-gray-800/50" />}
                </div>
              ))}
            </div>
          )}

          {/* Recharge Button */}
          <button
            onClick={onGoToBilling}
            className="w-full py-4 bg-blue-500 hover:bg-blue-600 active:scale-[0.98] text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 text-sm shadow-md transition-all mt-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-5.625-10.125h16.5a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 21 21.75H3a2.25 2.25 0 0 1-2.25-2.25V5.625a2.25 2.25 0 0 1 2.25-2.25Z" />
            </svg>
            <span>Ku Shubo Credits / Cusboonaysii Bille</span>
          </button>
        </div>
      )}
    </div>
  );
}
