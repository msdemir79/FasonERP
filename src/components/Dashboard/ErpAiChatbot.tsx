import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  Trash2, 
  Copy, 
  Check, 
  CornerDownLeft, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  ShieldAlert, 
  Lightbulb, 
  ChevronRight,
  BookOpen,
  DollarSign,
  Package,
  Layers,
  FileSpreadsheet,
  Users,
  Building2,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { cn } from '../../lib/utils';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ErpAiChatbotProps {
  appSummary?: any;
  onNavigate?: (tab: string) => void;
  className?: string;
  onClose?: () => void;
}

const QUICK_PROMPTS = [
  {
    icon: Building2,
    category: 'Cari & Müşteri',
    text: 'Yeni cari hesap ve müşteri kartı nasıl tanımlanır?',
  },
  {
    icon: Layers,
    category: 'Sipariş & Üretim',
    text: 'Müşteri siparişi oluşturup üretim iş emrine nasıl dönüştürülür?',
  },
  {
    icon: FileSpreadsheet,
    category: 'Fatura & Muhasebe',
    text: 'Tevkifatlı satış faturası kesilip tek tıkla nasıl muhasebeleştirilir?',
  },
  {
    icon: DollarSign,
    category: 'Finans & Çek',
    text: 'Müşteri çeki tahsilatı veya tedarikçiye ciro işlemi nasıl yapılır?',
  },
  {
    icon: Users,
    category: 'İK & Bordro',
    text: 'SGK’lı personel için bordro tahakkuku ve puantaj nasıl hesaplanır?',
  },
  {
    icon: Package,
    category: 'Stok & Reçete',
    text: 'Ürün reçetesi (BOM) ve barkod etiket basımı nasıl çalışır?',
  },
  {
    icon: Sparkles,
    category: 'Anlık Durum',
    text: 'Sistemdeki güncel açık siparişler, nakit durumu ve kritik stokları özetle.',
  },
];

export default function ErpAiChatbot({ appSummary, onNavigate, className = '', onClose }: ErpAiChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('proerp_ai_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return [
      {
        id: 'welcome-1',
        role: 'assistant',
        content: `👋 **Merhaba! Ben ProERP Akıllı Asistanı.**

ProERP içerisindeki tüm modüller, iş süreçleri ve sistem kullanımınızla ilgili sorularınızı yanıtlamak için buradayım.

💡 **Bana Neler Sorabilirsiniz?**
- **Cari, Fatura & İrsaliye**: Tevkifatlı fatura kesme, e-İrsaliye ve cari kart açma adımları.
- **Finans & Muhasebe**: Kasa/banka işlemleri, çek-senet ciro ve tahsilatı, tekdüzen hesap planı ve yevmiye fişleri.
- **Üretim & Stok**: Siparişten iş emrine dönüştürme, kesim/dikim aşamaları, reçete (BOM) ve barkodlama.
- **İK & Bordro**: Personel puantajı, SGK'lı/SGK'sız net-brüt bordro hesaplama ve avans/izin takibi.
- **Canlı Veri Analizi**: Şirketinizin anlık nakit akışı, açık siparişleri ve kritik stok durumu.

*Not: Ben yalnızca ProERP sistemi ve kurumsal ERP süreçleriyle ilgili sorulara yanıt vermek üzere özelleştirildim.*`,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem('proerp_ai_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    setErrorMsg(null);
    setInput('');

    const userMessage: ChatMessage = {
      id: 'msg-' + Date.now() + '-u',
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const sessionToken = localStorage.getItem('proerp_session_token') || 
                           localStorage.getItem('proerp_active_user_id') || 
                           'pe_session_active';

      // Send conversation history to backend Gemini API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          messages: newHistory.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            text: m.content,
          })),
          appSummary: appSummary || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Yapay zeka yanıtı alınamadı.');
      }

      const assistantMessage: ChatMessage = {
        id: 'msg-' + Date.now() + '-a',
        role: 'assistant',
        content: data.reply || 'Yanıt alınamadı.',
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorMsg(err.message || 'Bağlantı hatası oluştu. Lütfen tekrar deneyiniz.');
      const errorMessage: ChatMessage = {
        id: 'msg-' + Date.now() + '-err',
        role: 'assistant',
        content: `⚠️ **Hata:** ${err.message || 'Yapay zeka asistanına ulaşılamadı. Lütfen sunucu bağlantısını ve API anahtarını kontrol ediniz.'}`,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Sohbet geçmişini sıfırlamak istediğinize emin misiniz?')) {
      const resetMsg: ChatMessage = {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content: `👋 **Sohbet sıfırlandı.** ProERP sistemi ve modülleriyle ilgili sormak istediğiniz soruları bekliyorum.`,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages([resetMsg]);
      localStorage.removeItem('proerp_ai_chat_history');
      setErrorMsg(null);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div 
      className={cn(
        "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/80 dark:border-slate-800/80 shadow-sm flex flex-col transition-all duration-300 overflow-hidden",
        isExpanded ? "fixed inset-4 z-50 shadow-2xl" : "h-[620px]",
        className
      )}
    >
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                ProERP Akıllı Asistanı
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  Gemini AI
                </span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-300">
              Yalnızca ProERP modülleri, iş süreçleri ve sistem verilerine özel uzman rehber
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleClearHistory}
            title="Sohbeti Temizle"
            className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-white dark:bg-slate-900/10 rounded-lg transition-colors text-xs flex items-center gap-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Küçült" : "Genişlet"}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white dark:bg-slate-900/10 rounded-lg transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
          <span>Hızlı Sorular:</span>
        </div>
        {QUICK_PROMPTS.map((qp, idx) => {
          const Icon = qp.icon;
          return (
            <button
              key={idx}
              type="button"
              disabled={isLoading}
              onClick={() => handleSendMessage(qp.text)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all shrink-0 shadow-2xs active:scale-95 disabled:opacity-50"
            >
              <Icon className="w-3 h-3 text-indigo-500" />
              <span>{qp.category}</span>
            </button>
          );
        })}
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-800/50/40">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex gap-3 max-w-[90%] md:max-w-[80%]",
                isUser ? "ml-auto flex-row-reverse" : "mr-auto flex-row"
              )}
            >
              {/* Avatar */}
              <div 
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs",
                  isUser 
                    ? "bg-slate-800 text-white" 
                    : "bg-gradient-to-tr from-indigo-600 to-violet-600 text-white"
                )}
              >
                {isUser ? 'Siz' : <Bot className="w-4 h-4" />}
              </div>

              {/* Bubble */}
              <div className="group relative flex flex-col">
                <div 
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-2xs",
                    isUser
                      ? "bg-indigo-600 text-white rounded-tr-none font-medium whitespace-pre-wrap"
                      : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/90 rounded-tl-none font-normal"
                  )}
                >
                  {isUser ? (
                    msg.content
                  ) : (
                    <div className="markdown-body text-sm space-y-2 text-slate-800 dark:text-slate-200">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                  )}
                </div>

                {/* Footer / Copy */}
                <div 
                  className={cn(
                    "flex items-center gap-2 mt-1 text-[10px] text-slate-400 px-1",
                    isUser ? "justify-end" : "justify-start"
                  )}
                >
                  <span>{msg.timestamp}</span>
                  {!isUser && (
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-slate-700 dark:text-slate-200 flex items-center gap-1 text-[10px]"
                      title="Metni Kopyala"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600 font-medium">Kopyalandı</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopyala</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 mr-auto max-w-[80%]"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="px-4 py-3 bg-white dark:bg-slate-900 text-slate-600 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none shadow-2xs flex items-center gap-2 text-xs">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-slate-500 dark:text-slate-400 font-medium ml-1">ProERP yanıtı hazırlanıyor...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ProERP modülleri veya iş süreçleriyle ilgili sorunuzu yazın... (Örn: 'Tevkifatlı fatura nasıl kesilir?')"
              className="w-full resize-none px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:bg-slate-900 focus:bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-10"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="h-[46px] px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all shrink-0"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Gönder</span>
                <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400 px-1">
          <span className="flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-indigo-500" />
            Sadece ProERP kurumsal sistem rehberliği ve verilerine yanıt verir.
          </span>
          <span className="hidden sm:inline">Enter: Gönder • Shift + Enter: Yeni satır</span>
        </div>
      </div>
    </div>
  );
}
