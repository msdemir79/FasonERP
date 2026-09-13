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

  // Chat endpoint
  app.post('/api/chat', async (req, res) => {
    try {
      const { messages, appSummary } = req.body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Geçersiz mesaj formatı.' });
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

${appSummary ? `\n--- GÜNCEL PROERP SİSTEM VE VERİ ÖZETİ ---\n${JSON.stringify(appSummary, null, 2)}\n----------------------------------------\n` : ''}`;

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
