
"use client";
import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

let toastId = 0;
let addToastFn = null;

export const showToast = (type, message) => {
    if (addToastFn) {
        addToastFn(type, message);
    }
};

export const ToastContainer = () => {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        addToastFn = (type, message) => {
            const id = ++toastId;
            setToasts(prev => [...prev, { id, type, message }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 5000);
        };
    }, []);

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col space-y-3">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className={`flex items-center space-x-3 px-5 py-4 rounded-2xl shadow-2xl border animate-slide-in-right ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
                            toast.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800' :
                                'bg-indigo-50 border-indigo-100 text-indigo-800'
                        }`}
                >
                    {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
                    {toast.type === 'info' && <Info className="w-5 h-5" />}

                    <p className="text-sm font-bold pr-4">{toast.message}</p>

                    <button onClick={() => removeToast(toast.id)} className="p-1 hover:bg-black/5 rounded-full">
                        <X className="w-4 h-4 opacity-50" />
                    </button>
                </div>
            ))}
            <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
        </div>
    );
};
