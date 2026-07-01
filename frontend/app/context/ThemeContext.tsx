"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'light' | 'dark' | 'system';
export type LanguageType = 'en' | 'so';

interface ThemeColors {
  primary: string;
  secondary: string;
  tertiary: string;
  neutral: string;
  background: string;
  text: string;
  textLight: string;
  border: string;
  error: string;
  card: string;
}

const lightColors: ThemeColors = {
  primary: '#3B82F6', // Blue
  secondary: '#000000',
  tertiary: '#F8F9FA',
  neutral: '#74777D',
  background: '#F8FAFC',
  text: '#0F172A',
  textLight: '#64748B',
  border: '#E2E8F0',
  error: '#EF4444',
  card: '#FFFFFF',
};

const darkColors: ThemeColors = {
  primary: '#3B82F6',
  secondary: '#FFFFFF',
  tertiary: '#1A2332',
  neutral: '#A0AEC0',
  background: '#0D1117',
  text: '#FFFFFF',
  textLight: '#CBD5E1',
  border: '#1E293B',
  error: '#F87171',
  card: '#161B22',
};

export const translations = {
  en: {
    welcome_ai: "Welcome! I am your AI assistant. How can I help you today?",
    ask_placeholder: "Ask a question here...",
    transcribing: "Voice transcribing...",
    copied: "Copied successfully!",
    login_required: "Please login first.",
    session_expired: "Session expired. Please login again.",
    copied_alert: "Copied! Response successfully copied to clipboard.",
    account: "Account",
    privacy_security: "Privacy & Security",
    notifications: "Notifications",
    appearance: "APPEARANCE",
    dark_mode: "Dark Mode",
    dark_mode_sub: "Midnight Blue theme",
    language: "Language",
    language_sub: "Switch between English and Somali",
    payment_title: "Payment Verification",
    payment_subtitle: "Please verify the details below",
    payment_send_msg: "Send the payment to the number below\nfor amount (",
    payment_input_label: "Phone number you sent the payment from",
    payment_input_placeholder: "Example: 63XXXXXXX",
    payment_notice: "Double-check your number to process your payment immediately.",
    payment_confirm_btn: "CONFIRM ORDER →",
    home: "Home",
    profile: "Profile",
    books: "Books",
    books_card_desc: "Explore and read all available books.",
    groups: "Groups",
    billing: "Billing & Credits",
    settings: "Settings",
    terms: "Terms & Conditions",
    logout: "Log Out",
    add_credits: "Add Credits",
    back: "Back",
    chat_history: "Chat History",
    your_plan: "Your Plan",
    your_credits: "Your Credits",
    premium_unlimited: "Premium (Unlimited)",
    basic_unlimited: "Basic (Unlimited)",
    credits: "Credits",
    loading: "Loading...",
    profile_settings: "Profile Settings",
    privacy_policy: "Privacy Policy",
    about_darkpen: "About Darkpen",
    all_books: "ALL BOOKS",
    select_book: "Choose the book you want to read (Read Only).",
    no_pdf_alert: "This book does not have a PDF file.",
    no_books_found: "No books found.",
    welcome_love: "Welcome! I am 'My Love'. How can I help you today?",
    placeholder_love: "Message My Love...",
    love_points_desc: "You have {credits} coins dedicated to dating chat. Each sent message deducts points.",
    buy_more_points: "Buy More Coins",
  },
  so: {
    welcome_ai: "Kusoo dhawoow! Anigu waxaan ahay caawiyahaaga AI. Sidee baan kuu caawin karaa maanta?",
    ask_placeholder: "Su'aal halkan ku qor...",
    transcribing: "Waa la fasirayaa codka...",
    copied: "La koobiyeeyay!",
    login_required: "Fadlan marka hore soo gal nidaamka (Login).",
    session_expired: "Kalfadhigaagu wuu dhacay. Fadlan mar kale soo gal nidaamka (Login).",
    copied_alert: "Jawaabta waa la koobiyeeyay!",
    account: "Account-ka",
    privacy_security: "Khaasnimada & Amniga",
    notifications: "Ogeysiisyada",
    appearance: "MUUQAALKA",
    dark_mode: "Habka Madow",
    dark_mode_sub: "Midabka buluugga madow",
    language: "Luuqadda",
    language_sub: "U kala beddel English iyo Somali",
    payment_title: "Xaqiijinta Lacagta",
    payment_subtitle: "Fadlan xaqiiji macluumaadka hoose",
    payment_send_msg: "Number-kan hoose kusoo dir lacagta\noo ah (",
    payment_input_label: "Number-ka aad ka soo dirtey",
    payment_input_placeholder: "Tusaale: 63XXXXXXX",
    payment_notice: "Hubi in nambarkaagu sax yahay si loo meelmariyo lacagtaada si degdeg ah.",
    payment_confirm_btn: "XAQIIJI DALABKA →",
    home: "Kuxidhnow",
    profile: "Profile",
    books: "Books",
    books_card_desc: "Baro oo akhriso dhammaan buugaagta la heli karo.",
    groups: "Groups",
    billing: "Biilasha (Billing)",
    settings: "Settings-ka",
    terms: "Shuruudaha & Xeerarka",
    logout: "Ka Bax",
    add_credits: "Ku dar Credits",
    back: "Dib u Laabo",
    chat_history: "Taariikhda Wada-hadalka",
    your_plan: "Qorshahaaga",
    your_credits: "Credit-kaaga",
    premium_unlimited: "Premium (Aan xadidnayn)",
    basic_unlimited: "Basic (Aan xadidnayn)",
    credits: "Credits",
    loading: "Waa la soo rarayaa...",
    profile_settings: "Habaynta Profile-ka",
    privacy_policy: "Khaasnimada",
    about_darkpen: "Ku Saabsan Darkpen",
    all_books: "DHAMMAAN BUUGAAGTA",
    select_book: "Dooro buugga aad doonayso inaad akhrido (Read Only).",
    no_pdf_alert: "Buuggan malaha fayl PDF ah.",
    no_books_found: "Wax buug ah lama helin.",
    welcome_love: "Kusoo dhawoow! Anigu waxaan ahay 'My Love'. Maxaan kaa caawin karaa maanta?",
    placeholder_love: "U dir farriin My Love...",
    love_points_desc: "Waxaad haysataa {credits} dhibcood oo gaar u ah Shukaansiga. Farriin kasta oo aad dirto waxay kaa jaraysaa dhibco.",
    buy_more_points: "Dalbo Dhibco Kale",
  }
};

interface ThemeContextData {
  theme: ThemeType;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: ThemeType) => void;
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>('light'); // Default to light
  const [language, setLanguageState] = useState<LanguageType>('en'); // Default to English
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Load from localStorage
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      setThemeState(savedTheme as ThemeType);
    } else {
      setThemeState('light');
    }

    const savedLang = localStorage.getItem('appLanguage');
    if (savedLang) {
      setLanguageState(savedLang as LanguageType);
    } else {
      setLanguageState('en');
    }
    setIsReady(true);
  }, []);

  // Update HTML class for Tailwind dark mode support
  useEffect(() => {
    if (!isReady) return;
    const isDarkTheme = theme === 'dark';
    if (isDarkTheme) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, isReady]);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('appTheme', newTheme);
  };

  const setLanguage = (newLang: LanguageType) => {
    setLanguageState(newLang);
    localStorage.setItem('appLanguage', newLang);
  };

  const t = (key: keyof typeof translations['en']): string => {
    const langDict = translations[language] || translations['en'];
    return langDict[key] || key;
  };

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D1117] text-white">
        <div className="text-lg font-semibold animate-pulse">Loading Darkpen...</div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme, language, setLanguage, t }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
