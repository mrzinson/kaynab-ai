"use client";

import React from 'react';

interface PdfReaderProps {
  pdfUrl: string;
  title: string;
  type: string;
  onClose: () => void;
}

export default function PdfReader({ pdfUrl, title, type, onClose }: PdfReaderProps) {
  // Normalize PDF URL (ensure absolute URL)
  let cleanPdfUrl = pdfUrl;
  if (pdfUrl && !pdfUrl.startsWith('http')) {
    cleanPdfUrl = (process.env.NEXT_PUBLIC_API_URL || "https://kaynab-ai-backend.onrender.com") + `${pdfUrl.startsWith('/') ? '' : '/'}${pdfUrl}`;
  }

  // To display past papers or textbook PDFs in a browser friendly way, we use an iframe.
  // Google Docs viewer can also be used as a backup for mobile devices that don't render native PDFs in iframe:
  const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(cleanPdfUrl)}&embedded=true`;

  return (
    <div className="w-full h-full flex flex-col bg-[#0D1117] animate-in fade-in duration-300">
      
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#161B22] border-b border-gray-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h3 className="font-bold text-white leading-none text-base">{title}</h3>
            <span className="text-xs text-gray-500 capitalize mt-1 inline-block">{type}</span>
          </div>
        </div>
        
        {/* Direct Download button */}
        <a 
          href={cleanPdfUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-650 text-white text-xs font-bold transition-all active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <span className="hidden sm:inline">Download PDF</span>
        </a>
      </div>

      {/* Main viewer */}
      <div className="flex-1 w-full bg-[#0D1117] relative">
        <iframe
          src={cleanPdfUrl}
          title={title}
          className="w-full h-full border-none bg-[#0D1117]"
          allow="autoplay"
        />
      </div>

    </div>
  );
}
