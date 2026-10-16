import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${maxWidth} bg-surface-container-lowest border border-border-default rounded-2xl shadow-2xl z-10 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150`}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-border-default shrink-0 bg-surface-container-lowest">
          <h2
            id="modal-title"
            className="text-sm sm:text-base md:text-lg text-on-surface font-semibold tracking-tight truncate pr-2"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors shrink-0"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 overscroll-contain focus:outline-none">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
