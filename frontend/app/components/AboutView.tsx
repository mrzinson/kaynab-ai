"use client";

import React from 'react';
import Image from 'next/image';
import { useTheme } from '../context/ThemeContext';

interface AboutViewProps {
  onClose: () => void;
}

export default function AboutView({ onClose }: AboutViewProps) {
  const { colors, language, isDark, t } = useTheme();

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
          <h2 className="text-2xl font-extrabold text-white">
            {language === 'so' ? 'Ku Saabsan Darkpen' : 'About Darkpen'}
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            {language === 'so' ? 'Baro hadafkayaga iyo adeegyada aan bixinno' : 'Learn about our mission and services'}
          </p>
        </div>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center p-6 bg-[#161B22] border border-gray-850 rounded-3xl shadow-lg relative overflow-hidden select-none">
          <div className="w-24 h-24 relative mb-4">
            <Image src="/darkpen-logo-blue.png" alt="Darkpen" fill className="object-contain" />
          </div>
          <h3 className="text-2xl font-black text-white">Darkpen</h3>
          <span className="text-xs text-gray-500 font-bold mt-1">Version 1.0.1</span>
        </div>

        {/* Mission Card */}
        <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4 text-blue-500 select-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.64 8.38m6.06 6a14.98 14.98 0 0 1-12.12 6.16 14.98 14.98 0 0 1 8.38-12.06" />
            </svg>
            <h4 className="text-base font-extrabold text-white">Our Mission</h4>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-medium">
            {language === 'so'
              ? 'Ujeedada ugu weyn ee Darkpen waa in la helo madal casri ah oo u taagan "Muraajaco" ama xusuusinta ardayda si ay waxbarashadooda u horumariyaan. Waxaan isku xirnaa waxbarasho tayeysan iyo madadaalo maskaxda dejisa.'
              : 'The main goal of Darkpen is to provide a modern revision and support platform for students to improve their education. We connect quality education with mind-refreshing interaction.'}
          </p>
        </div>

        {/* Features Card */}
        <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4 text-blue-500 select-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
            </svg>
            <h4 className="text-base font-extrabold text-white">
              {language === 'so' ? 'Maxay tahay Darkpen?' : 'What is Darkpen?'}
            </h4>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed font-medium mb-4">
            {language === 'so'
              ? 'Darkpen waa madal waxbarasho oo dhammaystiran oo loogu talagalay in lagu caawiyo ardayda heerar kasta. App-ku wuxuu bixiyaa adeegyo ay ka mid yihiin:'
              : 'Darkpen is a comprehensive education platform built to assist students of all levels. The application provides services including:'}
          </p>

          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025 4.479 4.479 0 0 0-.115-1.68C3.753 15.82 3 13.987 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                <strong className="text-white">{language === 'so' ? 'Kaaliyaha AI: ' : 'AI Assistant: '}</strong>
                {language === 'so' ? 'Su\'aalo weydii AI si uu kaaga caawiyo casharradaada iyo laylisyadaada.' : 'Ask questions to the AI assistant to help you with lessons and practice problems.'}
              </p>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                <strong className="text-white">{language === 'so' ? 'Dhaliyaha Imtixaanada: ' : 'Exam Generator: '}</strong>
                {language === 'so' ? 'Sameyso imtixano muraajaco ah oo ku saabsan maadooyin kala duwan.' : 'Generate custom revision exams for testing yourself on different school subjects.'}
              </p>
            </div>

            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed font-medium">
                <strong className="text-white">{language === 'so' ? 'Wada-sheekeysiga Kooxaha: ' : 'Groups Chat: '}</strong>
                {language === 'so' ? 'Ku biir kooxaha waxbarashada si aad ula wadaagto casharrada ardayda kale.' : 'Join school group chats to share learning resources with other students.'}
              </p>
            </div>
          </div>
        </div>

        {/* Founder Card */}
        <div className="bg-[#161B22] border border-gray-850 rounded-3xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-md">
              HM
            </div>
            <div>
              <h4 className="text-base font-extrabold text-white">Hamze Mohamuud Ali (Zinson)</h4>
              <div className="flex gap-2 mt-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/15 select-none">
                  Founder & CEO
                </span>
              </div>
            </div>
          </div>
          <div className="h-[1px] bg-gray-800/80 my-4" />
          <p className="text-xs text-gray-300 leading-relaxed font-medium">
            {language === 'so'
              ? 'Maskaxda ka dambaysa mashruucan iyo aasaasaha app-ka. "Ujeedkaygu waa inaan isbedel weyn ku sameeyo qaabka ay ardayda wax u bartaan, anigoo u fududaynaya muraajacada iyo helitaanka xog rasmi ah oo la isku halayn karo."'
              : 'The mastermind behind the project and founder of the app. "My goal is to make a major difference in how students revise and learn by facilitating access to trustworthy curriculum content."'}
          </p>
        </div>
      </div>
    </div>
  );
}
