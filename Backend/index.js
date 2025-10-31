// my-stock-api/index.js

// === 1. Import Modules ===
// นำเข้าไลบรารีที่จำเป็นสำหรับการสร้างเซิร์ฟเวอร์และดึงข้อมูล
import express from 'express';      // Framework สำหรับสร้างเว็บเซิร์ฟเวอร์และ API ใน Node.js
import cors from 'cors';          // Middleware สำหรับเปิดใช้งาน Cross-Origin Resource Sharing (ให้ React App เรียก API นี้ได้)
import yahooFinance from 'yahoo-finance2'; // ไลบรารีสำหรับดึงข้อมูลจาก Yahoo Finance

// ======================================================
// === SECTION 2: CONFIGURATION & HELPERS             ===
// ======================================================

// --- ค่าคงที่สำหรับการตั้งค่า ---
const PORT = process.env.PORT || 5000;              // Port ที่จะรันเซิร์ฟเวอร์
const CACHE_TTL = 60 * 60 * 1000;                   // อายุของ Cache: 1 ชั่วโมง (60 นาที * 60 วินาที * 1000 ms)
const BLOCK_DURATION = 1 * 1000;              // ระยะเวลาที่จะตัดวงจร:  1วินาที (10,000 ms)

/**
 * @object cacheManager
 * @desc   จัดการ Cache ข้อมูลเพื่อลดการเรียก API ซ้ำซ้อน
 */
const cacheManager = {
  cache: new Map(), // ใช้ Map object เพื่อเก็บข้อมูล Cache, มีประสิทธิภาพสูง
  
  /**
   * ดึงข้อมูลจาก Cache
   * @param {string} key - Key สำหรับระบุข้อมูลใน Cache
   * @returns {any | null} - ข้อมูลที่เก็บไว้ หรือ null หากไม่มีหรือไม่สดใหม่
   */
  get(key) {
    const cached = this.cache.get(key);
    // ตรวจสอบว่ามีข้อมูลใน cache และยังไม่หมดอายุ (สดใหม่) หรือไม่
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`[Cache] HIT for: ${key}`);
      return cached.data;
    }
    console.log(`[Cache] MISS for: ${key}. Fetching from source...`);
    return null;
  },

  /**
   * บันทึกข้อมูลลงใน Cache
   * @param {string} key - Key ที่จะใช้บันทึก
   * @param {any} data - ข้อมูลที่ต้องการบันทึก
   */
  set(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
};

/**
 * @object circuitBreaker
 * @desc   จัดการสถานะการตัดวงจร (Circuit Breaker) เพื่อป้องกันการยิง API รัวๆ ตอนถูกบล็อก
 */
const circuitBreaker = {
  isBlocked: false,      // สถานะปัจจุบัน: ถูกบล็อกหรือไม่
  blockUntil: 0,         // เวลาที่จะปลดบล็อก (ในรูปแบบ timestamp)

  /**
   * สั่งให้วงจร "ตัด" (เริ่มบล็อก request)
   */
  trip() {
    console.error(`[Circuit Breaker] Tripped! Blocking requests for ${BLOCK_DURATION / 60000} minutes.`);
    this.isBlocked = true;
    this.blockUntil = Date.now() + BLOCK_DURATION;
  },

  /**
   * ตรวจสอบสถานะของวงจร
   * @param {object} res - Express response object
   * @returns {boolean} - คืนค่า true หาก request ถูกบล็อก, false หากไม่ถูกบล็อก
   */
  check(res) {
    if (this.isBlocked) {
      if (Date.now() < this.blockUntil) {
        // หากยังอยู่ในช่วงเวลาบล็อก ให้ปฏิเสธ request ทันที
        const remainingTime = Math.ceil((this.blockUntil - Date.now()) / 1000); // คำนวณเวลาที่เหลือเป็นนาที
        console.warn(`[Circuit Breaker] Request rejected. Blocked for ${remainingTime} more minutes.`);
        res.status(503).json({ 
          error: `Service is temporarily unavailable due to rate limiting. Please try again in ${remainingTime} minutes.` 
        });
        return true; // ยืนยันว่า request นี้ถูกบล็อก
      } else {
        // หากหมดเวลาบล็อกแล้ว ให้เปิดวงจรอีกครั้ง
        console.log("[Circuit Breaker] Re-opening the circuit.");
        this.isBlocked = false;
        this.blockUntil = 0;
      }
    }
    return false; // ไม่ถูกบล็อก, ให้ request ทำงานต่อไป
  }
};

/**
 * Normalize ticker text (trim + uppercase)
 */
function normalizeTicker(ticker) {
  return ticker.trim().toUpperCase();
}

/**
 * Build ticker variants to support both Thai (.BK) and international symbols.
 * - If user provides suffix (contains '.'), try exactly as provided.
 * - Otherwise, try the symbol as-is, then try appending ".BK".
 */
function buildTickerVariants(raw) {
  const t = normalizeTicker(raw);
  if (t.includes('.')) return [t];
  return [t, `${t}.BK`];
}


// ======================================================
// === SECTION 3: EXPRESS APP SETUP & MIDDLEWARE      ===
// ======================================================

const app = express();
app.use(cors({ origin: '*' })); // อนุญาตให้ทุก Domain เรียกใช้ API นี้ได้ (เหมาะสำหรับ Development)
app.use(express.json());      // ทำให้ Express สามารถอ่าน request body ที่เป็น JSON ได้

// ลงทะเบียน Middleware สำหรับ Circuit Breaker ให้ทำงานกับทุก request ที่เข้ามา
app.use((req, res, next) => {
  if (circuitBreaker.check(res)) {
    return; // ถ้าถูกบล็อก, จะไม่เรียก next() ทำให้ request ไม่ถูกส่งต่อไปยัง route handler
  }
  next(); // ถ้าไม่ถูกบล็อก, ให้ส่งต่อไปยัง route handler ที่ตรงกัน
});


// ======================================================
// === SECTION 4: ROUTE CONTROLLERS                   ===
// ======================================================

/**
 * Controller สำหรับดึงข้อมูลภาพรวมหุ้น
 */
async function getStockQuote(req, res) {
  const raw = req.params.ticker;
  const variants = buildTickerVariants(raw);

  // 1) cache check for any variant
  for (const v of variants) {
    const cached = cacheManager.get(`quote_${v}`);
    if (cached) return res.json(cached);
  }

  // 2) try fetching by variants
  let lastError = null;
  for (const v of variants) {
    try {
      const quote = await yahooFinance.quote(v, {
        fields: ['symbol', 'longName', 'regularMarketPrice']
      });

      if (!quote || !quote.symbol) {
        lastError = new Error(`No data found for ticker: ${v}`);
        continue; // try next variant
      }

      const responseData = {
        symbol: quote.symbol,
        longName: quote.longName ?? null,
        currentPrice: quote.regularMarketPrice ?? null
      };
      cacheManager.set(`quote_${v}`, responseData);
      return res.json(responseData);
    } catch (error) {
      console.error(`Error fetching quote for ${v}:`, error);
      // Rate limit style parse error safety
      if (error instanceof SyntaxError && error.message?.includes('Unexpected token')) {
        circuitBreaker.trip();
        return res.status(429).json({ error: 'Too many requests to external API. Please wait a moment.' });
      }
      // keep last error if it's a not-found kind, otherwise bubble up after loop
      if (error.message?.includes('No fundamentals found') || error.status === 404) {
        lastError = error;
        continue;
      }
      lastError = error;
    }
  }

  if (lastError?.message?.includes('No fundamentals found') || lastError?.status === 404) {
    return res.status(404).json({ error: `Ticker '${normalizeTicker(raw)}' not found.` });
  }
  return res.status(500).json({ error: 'Failed to fetch stock quote.' });
}

/**
 * Controller สำหรับดึงข้อมูลราคาย้อนหลัง
 */
async function getStockHistory(req, res) {
  const raw = req.params.ticker;
  const variants = buildTickerVariants(raw);
  const { startDate } = req.query;
  
  // cache check for any variant
  for (const v of variants) {
    const cacheKey = `history_${v}_${startDate || '90d'}`;
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) return res.json(cachedData);
  }

  let period1, period2;
  try {
    period2 = new Date();
    period1 = startDate ? new Date(startDate) : new Date(new Date().setDate(period2.getDate() - 90));
    if (isNaN(period1.getTime())) throw new Error('Invalid date format.');
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  // Try variants for history
  let lastError = null;
  for (const v of variants) {
    const cacheKey = `history_${v}_${startDate || '90d'}`;
    try {
      const result = await yahooFinance.chart(v, { period1, period2, interval: '1d' });
      const history = result?.quotes;

      if (!history || history.length === 0) {
        lastError = new Error(`No history found for ticker: ${v}`);
        continue; // try next variant
      }

      const responseData = history.map(row => ({
        date: row.date.toISOString(),
        close: row.close,
        volume: row.volume ?? null
      }));

      cacheManager.set(cacheKey, responseData);
      return res.json(responseData);
    } catch (error) {
      console.error(`Error fetching history for ${v}:`, error);
      if (error instanceof SyntaxError && error.message?.includes('Unexpected token')) {
        circuitBreaker.trip();
        return res.status(429).json({ error: 'Too many requests to external API. Please wait a moment.' });
      }
      if (error.message?.includes('No fundamentals found') || error.status === 404) {
        lastError = error;
        continue;
      }
      lastError = error;
    }
  }

  if (lastError?.message?.includes('No fundamentals found') || lastError?.status === 404) {
    return res.status(404).json({ error: `Ticker '${normalizeTicker(raw)}' not found.` });
  }
  return res.status(500).json({ error: 'Failed to fetch stock history.' });
}

// ======================================================
// === SECTION 5: ROUTES                              ===
// ======================================================

// ผูก URL Path เข้ากับ Controller ที่เราสร้างไว้
app.get('/api/stock/:ticker', getStockQuote);
app.get('/api/stock/history/:ticker', getStockHistory);

// ======================================================
// === SECTION 6: START SERVER                        ===
// ======================================================

// เริ่มรันเซิร์ฟเวอร์และรอรับ Request ที่ Port ที่กำหนด
app.listen(PORT, () => {
  console.log(`✅ Node.js Stock API is up and running on http://localhost:${PORT}`);
});
