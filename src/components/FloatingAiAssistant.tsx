import React, { useState } from 'react';
import { Bot, X, MessageSquare, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import ErpAiChatbot from './Dashboard/ErpAiChatbot';
import { useAppSummary } from '../hooks/useAppSummary';
import { cn } from '../lib/utils';

export default function FloatingAiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { appSummary } = useAppSummary();
  const navigate = useNavigate();

  const handleNavigate = (tab: string) => {
    navigate(tab.startsWith('/') ? tab : '/' + tab);
    setIsOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Chat Window */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden transition-all duration-300",
                isExpanded ? "w-[90vw] md:w-[800px] h-[85vh]" : "w-[360px] md:w-[420px] h-[550px]"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/50 to-white dark:from-slate-800/50 dark:to-slate-900 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-xs">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">ProERP Asistanı</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Gemini AI Destekli</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors hidden md:block"
                    title={isExpanded ? "Küçült" : "Genişlet"}
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chatbot Content */}
              <div className="flex-1 overflow-hidden relative">
                <ErpAiChatbot 
                  appSummary={appSummary} 
                  onNavigate={handleNavigate}
                  className="border-0 shadow-none h-full rounded-none"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Action Button */}
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-2xl shadow-lg flex items-center justify-center relative group"
            >
              <Bot className="w-6 h-6" />
              {/* Notification dot (optional, can be animated) */}
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" />
              
              {/* Tooltip on hover */}
              <span className="absolute right-full mr-4 bg-slate-900 dark:bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                AI Asistana Sor
                <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
