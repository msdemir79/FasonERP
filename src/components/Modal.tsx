import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full';
  headerActions?: React.ReactNode;
}

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className, 
  size = 'xl', 
  headerActions 
}: ModalProps) {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-lg',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-5xl',
    '2xl': 'max-w-6xl',
    '3xl': 'max-w-7xl',
    '4xl': 'max-w-[92vw]',
    full: 'max-w-[96vw]'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="modal-wrapper" 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden"
        >
          <div
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
          />
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            className={cn(
              "relative z-10 bg-white w-full rounded-2xl md:rounded-3xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden border border-slate-200/80",
              sizeClasses[size] || sizeClasses.xl,
              className
            )}
          >
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 sticky top-0 z-20">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-wider flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 shadow-sm shadow-indigo-600/30"></span>
                {title}
              </h3>
              <div className="flex items-center gap-2">
                {headerActions}
                <button 
                  onClick={onClose} 
                  type="button"
                  title="Kapat (ESC)"
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 md:p-7 overflow-y-auto max-h-[calc(94vh-75px)] overscroll-contain">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
