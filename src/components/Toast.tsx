import React, { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-md mx-auto bg-accent text-on-accent p-space-sm rounded-xl shadow-xl flex items-center justify-between z-50 border border-primary-container animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <span className="material-symbols-outlined text-[20px] text-on-accent shrink-0">info</span>
        <span className="font-body-md text-body-md text-on-accent truncate">{message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-on-accent hover:opacity-80 transition-opacity p-1"
        aria-label="Close notification"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
};
