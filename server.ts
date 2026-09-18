import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Lazy Gemini client
  let aiClient: GoogleGenAI | null = null;
  function getGeminiClient(): GoogleGenAI {
    if (!aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY environment variable is missing.');
      }
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
    return aiClient;
  }

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Rate Limiter Deposu (In-memory IP/Token bazlı kayan pencere)
  const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 dakika
  const MAX_REQUESTS_PER_WINDOW = 20;     // Dakikada maksimum 20 istek

  // Chat endpoint (Kimlik Doğrulama, Hız Sınırı ve Girdi Sınırı Korumalı)
  app.post('/api/chat', async (req, res) => {
    try {
      // 1. KİMLİK DOĞRULAMA (Authentication)
      const authHeader = req.headers.authorization || (req.headers['x-session-token'] as string);
      if (!authHeader) {
        return res.status(401).json({ 
          error: 'Yetkisiz erişim. AI Asistanı kullanabilmek için lütfen sisteme giriş yapınız.' 
        });
      }

      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();
      if (!token || token.length < 3) {
        return res.status(401).json({ 
          error: 'Geçersiz oturum belirteci. Lütfen tekrar giriş yapınız.' 
        });
      }

      // 2. HIZ VE İSTEK SINIRLAMA (Rate Limiting)
      const clientIdentifier = (req.ip || req.socket.remoteAddress || 'unknown_ip') + ':' + token.substring(0, 12);
      const now = Date.now();
      const currentRate = rateLimitStore.get(clientIdentifier);

      if (!currentRate || now > currentRate.resetAt) {
        rateLimitStore.set(clientIdentifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      } else {
        if (currentRate.count >= MAX_REQUESTS_PER_WINDOW) {
          const retryAfterSec = Math.ceil((currentRate.resetAt - now) / 1000);
          return res.status(429).json({
            error: `Çok fazla istek gönderildi. Lütfen ${retryAfterSec} saniye sonra tekrar deneyiniz.`
          });
        }
        currentRate.count += 1;
      }

      // 3. GİRDİ SINIRLARI VE GÜVENLİK KONTROLLERİ (Input Limits)
      const { messages, appSummary } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Geçersiz mesaj formatı. En az bir mesaj bulunmalıdır.' });
      }

      if (messages.length > 30) {
        return res.status(400).json({ error: 'Mesaj geçmişi çok uzun (en fazla 30 mesaj gönderilebilir).' });
      }

      let totalCharacters = 0;
      for (const m of messages) {
        const text = String(m.text || m.content || '');
        if (text.length > 2500) {
          return res.status(400).json({ error: 'Tek bir mesaj en fazla 2.500 karakter olabilir.' });
        }
        totalCharacters += text.length;
      }

      if (totalCharacters > 10000) {
        return res.status(400).json({ error: 'Toplam konuşma metni sınırı aşıldı (maksimum 10.000 karakter).' });
      }

      // appSummary boyut sınırı (Maksimum 25 KB)
      let sanitizedSummary = '';
      if (appSummary) {
        const summaryStr = typeof appSummary === 'string' ? appSummary : JSON.stringify(appSummary);
        if (summaryStr.length > 25000) {
          sanitizedSummary = summaryStr.substring(0, 25000);
        } else {
          sanitizedSummary = summaryStr;
        }
      }

      const ai = getGeminiClient();

      const systemInstruction = `Sen "ProERP Asistanı" adlı uzman ve nazik bir ERP rehberi yapay zeka asistanısın.
Görevin SADECE ve YALNIZCA ProERP uygulaması, sistemdeki modüller (Stok & Ürün Yönetimi, Siparişler, Üretim Takibi, İrsaliyeler, e-Faturalar, Finans (Kasa, Banka, Çek-Senet), Muhasebe & Tekdüzen Hesap Planı, İnsan Kaynakları & Bordro, Raporlar & Ekstreler) ve kurumsal iş süreçleri ile ilgili sorulara yanıt vermektir.

ÖNEMLİ VE KESİN KURAL (SADECE UYGULAMA İÇİ SORULAR):
Uygulama dışı, genel kültür, magazin, oyun, yemek tarifi, genel sohbet, hava durumu veya ProERP ile ilgisi olmayan herhangi bir soru sorulduğunda kesinlikle konudan sapma ve nazikçe şu şekilde yanıt ver:
"Ben yalnızca ProERP sistemi, ERP modülleri ve kurumsal yönetim süreçleriyle ilgili konularda yardımcı olmak üzere tasarlanmış bir asistanım. Size ProERP modüllerindeki işlemlerinizle veya şirket verilerinizle ilgili nasıl yardımcı olabilirim?"

Cevap Standartları:
1. Türkçe, saygılı, net, profesyonel ve adım adım rehberlik eden bir üslup kullan.
2. Buton isimlerini, menü yollarını ve önemli alanları **kalın (bold)** olarak belirt.
3. Kullanıcı "nasıl yapılır?" diye sorduğunda (örn: "yeni cari nasıl eklenir?", "fatura nasıl kesilir?", "çek nasıl ciro edilir?", "personel bordrosu nasıl hesaplanır?", "kasa ekstresi nasıl alınır?"), kullanıcıya sistemdeki menü adımlarıyla anlaşılır şekilde anlat.
4. Aşağıda sana iletilen anlık sistem özeti (güncel veri istatistikleri) varsa, kullanıcının verilerle ilgili sorularını (örn: "Kasamda ne kadar para var?", "Kaç açık sipariş var?", "Kritik stok var mı?", "Toplam alacak/borç durumu nedir?") doğrudan bu güncel verilere dayanarak somut rakamlarla cevapla.

${sanitizedSummary ? `\n--- GÜNCEL PROERP SİSTEM VE VERİ ÖZETİ ---\n${sanitizedSummary}\n----------------------------------------\n` : ''}`;

      // Build contents for Gemini API
      const contents = messages.map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: String(m.text || m.content || '') }],
      }));

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.3,
          topP: 0.85,
        },
      });

      const responseText = response.text || 'Üzgünüm, şu an bir yanıt oluşturulamadı. Lütfen tekrar deneyiniz.';
      return res.json({ reply: responseText });
    } catch (err: any) {
      console.error('Chat API Error:', err);
      const isMissingKey = err?.message?.includes('GEMINI_API_KEY');
      return res.status(500).json({
        error: isMissingKey
          ? 'Gemini API anahtarı yapılandırılmamış. Lütfen Ayarlar > Secrets bölümünden API anahtarını tanımlayınız.'
          : (err?.message || 'Yapay zeka yanıt verirken bir hata oluştu.')
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
