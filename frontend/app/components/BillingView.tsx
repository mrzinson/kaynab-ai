"use client";

import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

interface BillingViewProps {
  onClose: () => void;
}

export default function BillingView({ onClose }: BillingViewProps) {
  const { language } = useTheme();

  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [userCountry, setUserCountry] = useState<string>('Somaliland');

  // Selected plan state for payment form modal
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [senderNumber, setSenderNumber] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentNumbers, setPaymentNumbers] = useState<string[]>(['637930329', '659119779']);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const response = await fetch(`https://darkpen-backend.onrender.com/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.user) {
        setPaymentStatus(data.user.payment_status || null);
        setPaymentReference(data.user.payment_reference || null);
        setUserCountry(data.user.country || 'Somaliland');
      }
    } catch (error) {
      console.error('Error fetching profile in billing:', error);
    }
  };

  const fetchPaymentConfig = async () => {
    try {
      const res = await fetch(`https://darkpen-backend.onrender.com/api/auth/payment-config`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.numbers)) {
          setPaymentNumbers(data.numbers);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch payment config from backend:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchPaymentConfig();
  }, []);

  const plans = [
    {
      id: 'pay_as_you_go',
      title: 'Pay As You Go',
      price: '$0.5',
      somaliland: userCountry === 'Somaliland' ? '5,000 SL Shilling' : '',
      description: 'Get credits to try out Darkpen AI features.',
      color: '#3B82F6',
      icon: 'flash',
      expiry: 'Expires in 10 days',
      benefits: '100 Credits',
      features: [
        'Ask general questions in the chat',
        'Credits are deducted based on your usage',
        'Perfect for testing and light use'
      ]
    },
    {
      id: 'monthly_basic',
      title: 'Monthly (Basic)',
      price: '$3',
      somaliland: userCountry === 'Somaliland' ? '30,000 SL Shilling' : '',
      description: 'Unlimited AI chat plan for everyday use.',
      color: '#10B981',
      icon: 'calendar',
      expiry: 'Expires in 30 days',
      benefits: 'One month of unlimited chat',
      features: [
        'Unlimited conversations and assistance',
        'Uses the standard AI model (Basic)',
        'Not suitable for complex math or science problems'
      ]
    },
    {
      id: 'monthly_premium',
      title: 'Monthly (Premium)',
      price: '$11',
      somaliland: userCountry === 'Somaliland' ? '110,000 SL Shilling' : '',
      description: 'Access the most powerful and advanced AI model.',
      color: '#F59E0B',
      icon: 'star',
      expiry: 'Expires in 30 days',
      benefits: 'Unlimited chat + Premium AI model',
      features: [
        'Solve complex math & science problems',
        'Send images and get exam solutions instantly',
        'Ultra-fast and 100% accurate responses'
      ]
    }
  ];

  const validatePhoneNumber = (phone: string): string | null => {
    const cleaned = phone.replace(/[\s\-+]/g, '');
    if (!cleaned) {
      return 'Fadlan geli nambarka aad lacagta ka soo dirtay.';
    }
    if (!/^\d+$/.test(cleaned)) {
      return 'Nambarku waa inuu ka koobnaadaa tiro oo kaliya (e.g. 634XXXXXX).';
    }
    if (cleaned.length < 7) {
      return 'Nambarka taleefanka aad soo gelisay aad ayuu u gaaban yahay (ugu yaraan waa 7 tiro).';
    }
    if (cleaned.length > 15) {
      return 'Nambarka taleefanka aad soo gelisay aad ayuu u dheer yahay.';
    }
    if (cleaned.length === 9) {
      const prefix = cleaned.substring(0, 2);
      const validPrefixes = ['61', '62', '63', '65', '77', '90'];
      if (!validPrefixes.includes(prefix)) {
        return 'Nambarku waa inuu ku bilowdaa mid ka mid ah lambaradan: 63, 65, 61, 90, ama 77.';
      }
    } else if (cleaned.length === 12 && cleaned.startsWith('252')) {
      const prefix = cleaned.substring(3, 5);
      const validPrefixes = ['61', '62', '63', '65', '77', '90'];
      if (!validPrefixes.includes(prefix)) {
        return 'Nambarka u dambeeya ee 9-ka ah ee ku xiga 252 waa inuu ku bilowdaa 63, 65, 61, 90, ama 77.';
      }
    }
    return null;
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePhoneNumber(senderNumber);
    if (validationError) {
      alert(validationError);
      return;
    }

    setSubmittingPayment(true);
    try {
      const token = localStorage.getItem('userToken');
      const cleanedNumber = senderNumber.replace(/[\s\-+]/g, '');

      const res = await fetch(`https://darkpen-backend.onrender.com/api/auth/submit-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reference_number: cleanedNumber,
          planId: selectedPlan.id,
          amount: parseFloat(selectedPlan.price.replace('$', '')),
          service_type: 'general'
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setSelectedPlan(null);
        setSenderNumber('');
        fetchProfile();
      } else {
        alert(data.message || 'Payment submission failed');
      }
    } catch (err) {
      alert('Cilad dhinaca internet-ka ah. Fadlan mar kale tijaabi.');
    } finally {
      setSubmittingPayment(false);
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
          <h2 className="text-2xl font-extrabold text-white">CHOOSE A PLAN</h2>
          <p className="text-xs text-gray-500 font-medium">To continue using Darkpen AI, please select one of the plans below.</p>
        </div>
      </div>

      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Pending payment notice */}
        {paymentStatus === 'pending' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-extrabold text-amber-400">Payment Pending</h4>
              <p className="text-xs text-gray-400 font-medium mt-1 leading-relaxed">
                Your payment from <span className="text-white font-bold">{paymentReference}</span> is being verified. Credits will be added to your account shortly.
              </p>
            </div>
          </div>
        )}

        {/* Plans list */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-[#161B22] border border-gray-850 hover:border-gray-800 rounded-3xl p-6 shadow-lg flex flex-col justify-between transition-all"
            >
              <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div 
                    style={{ backgroundColor: `${plan.color}15`, color: plan.color }} 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                  >
                    {plan.icon === 'flash' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                      </svg>
                    ) : plan.icon === 'calendar' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499c.195-.39.81-.39 1.006 0l3.003 6.002 6.621.962c.439.064.614.604.297.908l-4.793 4.673 1.13 6.592c.075.438-.387.773-.782.567l-5.93-3.118-5.93 3.118c-.395.206-.857-.129-.782-.567l1.13-6.592-4.793-4.673c-.317-.304-.142-.844.297-.908l6.621-.962 3.003-6.002Z" />
                      </svg>
                    )}
                  </div>
                  <div className="text-right">
                    <span style={{ color: plan.color }} className="text-xl font-black block leading-none">{plan.price}</span>
                    {plan.somaliland && <span className="text-[9px] text-gray-550 font-bold mt-1 block">{plan.somaliland}</span>}
                  </div>
                </div>

                <h4 className="text-sm font-extrabold text-white leading-tight">{plan.title}</h4>
                <p className="text-[11px] text-gray-500 leading-normal font-medium mt-1">{plan.description}</p>

                {/* Specs */}
                <div className="mt-4 bg-[#0D1117] border border-gray-850 p-3 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                    </svg>
                    <span>Benefits: <strong className="text-white">{plan.benefits}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span>Validity: <strong className="text-white">{plan.expiry}</strong></span>
                  </div>
                </div>

                <div className="h-[1px] bg-gray-800/80 my-4" />

                {/* Features */}
                <div className="flex flex-col gap-2 mb-6">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider mb-1">What's included:</span>
                  {plan.features.map((feat, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ color: plan.color }} className="w-4 h-4 flex-shrink-0 mt-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      </svg>
                      <span className="text-[11px] text-gray-300 leading-normal font-medium">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Select Button */}
              <button
                onClick={() => setSelectedPlan(plan)}
                style={{ backgroundColor: plan.color }}
                className="w-full py-3 hover:opacity-90 active:scale-[0.98] text-white font-extrabold rounded-xl text-xs shadow-md transition-all mt-auto"
              >
                Select This Plan →
              </button>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-5 flex gap-3 text-xs text-blue-400 font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 text-blue-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 1 1 1.063.852l-.708.283a.75.75 0 0 0-.475.695v.283m0-.005H12m-.25-4.125h.008v.008h-.008V7.5Z" />
          </svg>
          <p className="leading-relaxed">
            After selecting a plan, you will be shown the payment number to send money to (EVC/Zaad/Sahal).
          </p>
        </div>
      </div>

      {/* Manual Payment Submit Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-[#161B22] border border-gray-800 rounded-3xl p-6 w-full max-w-md flex flex-col gap-4 shadow-2xl relative max-h-[90vh] overflow-y-auto scrollbar-none">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-gray-850">
              <h4 className="text-sm font-extrabold text-blue-500 uppercase tracking-wider">Xaqiijinta Lacagta</h4>
              <button 
                onClick={() => { setSelectedPlan(null); setSenderNumber(''); }}
                className="text-gray-400 p-1 hover:text-white transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Plan Info */}
            <div className="bg-[#0D1117] border border-gray-850 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase block leading-none">Plan Selected</span>
                <span className="text-sm font-extrabold text-white mt-1 block">{selectedPlan.title}</span>
              </div>
              <span className="px-4 py-2 rounded-full bg-emerald-500 text-white text-xs font-black shadow-md">
                {selectedPlan.price}
              </span>
            </div>

            {/* Numbers instructions */}
            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-gray-300 font-semibold leading-relaxed text-center">
                Fadlan lacagta kusoo dir mid ka mid ah lambaradan hoose kadibna halka hoose kusoo qor numberka aad ka soo dirtey.
              </p>
              {paymentNumbers.map((num, idx) => (
                <div key={idx} className="flex justify-between items-center bg-[#0D1117] border border-gray-850 rounded-xl px-4 py-3">
                  <span className="text-lg font-black text-white tracking-widest">{num}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(num);
                      alert(`Lambarada ${num} waa la koobiyeeyay.`);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 text-xs font-bold transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z" />
                    </svg>
                    <span>Copy</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Submit Form */}
            <form onSubmit={handlePaymentSubmit} className="flex flex-col gap-4 mt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-blue-500 text-center">
                  Number-ka aad ka soo dirtey
                </label>
                <div className="flex items-center bg-[#0D1117] border-2 border-gray-850 focus-within:border-blue-500 rounded-xl px-4 py-3 transition-all">
                  <span className="text-gray-500 font-bold mr-2 text-sm select-none">#</span>
                  <input
                    type="text"
                    value={senderNumber}
                    onChange={(e) => setSenderNumber(e.target.value)}
                    placeholder="Tusaale: 63XXXXXXX"
                    className="w-full bg-transparent text-white focus:outline-none text-sm font-semibold"
                    required
                  />
                </div>
              </div>

              <p className="text-[10px] text-gray-550 leading-relaxed text-center font-semibold">
                Double-check your number to process your payment immediately.
              </p>

              <button
                type="submit"
                disabled={submittingPayment || !senderNumber}
                className="w-full py-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-extrabold text-sm transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 shadow-md disabled:bg-gray-800 disabled:text-gray-500 disabled:shadow-none"
              >
                {submittingPayment ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  'XAQIIJI DALABKA →'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
