/* eslint-env node */

import express from 'express';
import cors from 'cors';
import yahooFinance from 'yahoo-finance2';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ======================================================
// === Section 1: Configuration & Constants           ===
// ======================================================

const PORT = process.env.PORT || 7860;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour for general data
const FX_CACHE_TTL = 15 * 60 * 1000; // 15 minutes for Forex rates (more frequent update)
const BLOCK_DURATION = 1 * 1000; // 1 second
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ======================================================
// === Section 2: Cache & Circuit Breaker             ===
// ======================================================

const cacheManager = {
  cache: new Map(),
  
  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    // Check specific TTL based on key type (Forex vs Stock)
    const ttl = key.startsWith('fx_') ? FX_CACHE_TTL : CACHE_TTL;
    
    if (Date.now() - cached.timestamp < ttl) {
      console.log(`[Cache] HIT for: ${key}`);
      return cached.data;
    }
    
    console.log(`[Cache] EXPIRED for: ${key}. Fetching fresh data...`);
    this.cache.delete(key);
    return null;
  },

  set(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  },
};

const circuitBreaker = {
  isBlocked: false,
  blockUntil: 0,
  
  trip() {
    const secs = Math.ceil(BLOCK_DURATION / 1000);
    console.error(`[Circuit Breaker] Tripped! Blocking requests for ${secs} seconds.`);
    this.isBlocked = true;
    this.blockUntil = Date.now() + BLOCK_DURATION;
  },

  check(res) {
    if (this.isBlocked) {
      if (Date.now() < this.blockUntil) {
        const remainingSecs = Math.ceil((this.blockUntil - Date.now()) / 1000);
        console.warn(`[Circuit Breaker] Request rejected. Blocked for ${remainingSecs} more seconds.`);
        res.status(503).json({
          error: `Service is temporarily unavailable due to rate limiting. Please try again in ${remainingSecs} seconds.`,
        });
        return true;
      }
      console.log('[Circuit Breaker] Re-opening the circuit.');
      this.isBlocked = false;
      this.blockUntil = 0;
    }
    return false;
  },
};

// ======================================================
// === Section 3: Helpers                             ===
// ======================================================

const normalizeTicker = (ticker) => ticker.trim().toUpperCase();

const buildTickerVariants = (raw) => {
  const t = normalizeTicker(raw);
  if (t.includes('.')) return [t];
  return [t, `${t}.BK`]; // Prioritize exact match, fallback to SET (.BK)
};

// Accept Date, ISO string, or numeric epoch (sec/ms) and normalize to `YYYY-MM-DD` in UTC
const toDateOnly = (value) => {
  let date = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000;
    date = new Date(ms);
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      if (/^\d+$/.test(trimmed)) {
        const ms = Number(trimmed) > 1e12 ? Number(trimmed) : Number(trimmed) * 1000;
        date = new Date(ms);
      } else {
        date = new Date(trimmed);
      }
    }
  }
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDateRange = (startDate, endDate, fallbackDays = 365) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const period2 = endDate ? new Date(endDate) : new Date(today);
  if (Number.isNaN(period2.getTime())) throw new Error('Invalid endDate format.');
  if (period2 > today) period2.setTime(today.getTime());
  period2.setHours(23, 59, 59, 999);

  let period1;
  if (startDate) {
    period1 = new Date(startDate);
    if (Number.isNaN(period1.getTime())) throw new Error('Invalid startDate format.');
  } else {
    period1 = new Date(period2);
    period1.setDate(period1.getDate() - fallbackDays);
  }
  period1.setHours(0, 0, 0, 0);

  if (period1 > period2) throw new Error('Start date must be before end date.');
  return { period1, period2 };
};

const toDateObject = (value) => {
  const iso = toDateOnly(value);
  if (!iso) return null;
  return new Date(`${iso}T00:00:00Z`);
};

const parseQuoteSeries = (quotes) =>
  (Array.isArray(quotes) ? quotes : [])
    .map((row) => {
      const rawDate = row?.date ?? row?.timestamp ?? null;
      const date = toDateObject(rawDate);
      const close = typeof row?.close === 'number' ? Number(row.close) : null;
      if (!date || close === null) return null;
      return {
        date,
        iso: date.toISOString(),
        close,
        volume: typeof row.volume === 'number' ? Number(row.volume) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);

const findPriceForDate = (series, targetDate) => {
  if (!targetDate) return null;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    if (series[i].date <= targetDate) {
      return series[i];
    }
  }
  return null;
};

// --- Currency Helper: Fetch Specific FX Rate ---
const fetchForexRate = async (pairSymbol) => {
  const cacheKey = `fx_${pairSymbol}`;
  const cached = cacheManager.get(cacheKey);
  if (cached !== null) return cached;

  try {
    const quote = await yahooFinance.quote(pairSymbol, { fields: ['regularMarketPrice'] });
    const price = Number(quote?.regularMarketPrice);
    if (Number.isFinite(price) && price > 0) {
      console.log(`[FX] Fetched ${pairSymbol}: ${price}`);
      cacheManager.set(cacheKey, price);
      return price;
    }
  } catch (error) {
    console.warn(`[FX] Failed to fetch ${pairSymbol}:`, error.message);
  }
  return null;
};

const getFxRate = async (fromCurrency, toCurrency) => {
  if (!fromCurrency || !toCurrency) return null;
  if (fromCurrency === toCurrency) return 1;

  // Direct Pair: e.g. THB=X (USD -> THB) or THBUSD=X
  // Yahoo Finance convention for USD base: "THB=X" means 1 USD = x.xx THB
  
  // Case 1: USD -> Target (e.g. USD -> THB)
  if (fromCurrency === 'USD') {
    const symbol = `${toCurrency}=X`; // e.g. THB=X
    return await fetchForexRate(symbol);
  }

  // Case 2: Target -> USD (e.g. THB -> USD)
  if (toCurrency === 'USD') {
    const symbol = `${fromCurrency}=X`; // e.g. THB=X (gives USD->THB)
    const rate = await fetchForexRate(symbol);
    return rate ? 1 / rate : null;
  }

  // Case 3: Cross Rate via USD (e.g. GBP -> THB)
  // GBP -> USD -> THB
  const toUsd = await getFxRate(fromCurrency, 'USD');
  const usdToTarget = await getFxRate('USD', toCurrency);
  
  if (toUsd && usdToTarget) {
    const crossRate = toUsd * usdToTarget;
    // Cache the calculated cross rate for performance
    cacheManager.set(`fx_${fromCurrency}${toCurrency}`, crossRate);
    return crossRate;
  }

  return null;
};

const enrichCurrency = async (events) => {
  // Identify all unique currencies in the dataset
  const uniqueCurrencies = new Set(
    events
      .map((event) => event.currency)
      .filter((code) => code && code !== 'THB') // We want to convert everything to THB eventually
  );

  // Pre-fetch/Calculate rates for all currencies involved
  // We specifically want to ensure we have USD -> THB available
  const usdThbRate = await getFxRate('USD', 'THB');
  
  const conversionMatrix = new Map();
  
  // Always add USD conversion capability if possible
  if (usdThbRate) {
    conversionMatrix.set('USD', { toThb: usdThbRate, toUsd: 1 });
  }

  // Process other currencies
  await Promise.all([...uniqueCurrencies].map(async (code) => {
    if (code === 'USD') return; // Already handled
    
    const [toUsd, toThb] = await Promise.all([
      getFxRate(code, 'USD'),
      getFxRate(code, 'THB')
    ]);
    
    conversionMatrix.set(code, { toUsd, toThb });
  }));

  // Map events with conversions
  return events.map((event) => {
    let amountUSD = null;
    let amountTHB = null;
    let priceUSD = null;
    let priceTHB = null;

    const sourceCurrency = event.currency;
    const rates = conversionMatrix.get(sourceCurrency) || {};

    // --- Amount Conversions ---
    if (Number.isFinite(event.amountPerShare)) {
      if (sourceCurrency === 'USD') {
        amountUSD = event.amountPerShare;
        if (usdThbRate) amountTHB = event.amountPerShare * usdThbRate;
      } else if (sourceCurrency === 'THB') {
        amountTHB = event.amountPerShare;
        // THB -> USD (inverse of USD->THB)
        if (usdThbRate) amountUSD = event.amountPerShare / usdThbRate;
      } else {
        // Other Currency
        if (rates.toUsd) amountUSD = event.amountPerShare * rates.toUsd;
        if (rates.toThb) amountTHB = event.amountPerShare * rates.toThb;
      }
    }

    // --- Price Conversions ---
    if (Number.isFinite(event.priceAtEvent)) {
      if (sourceCurrency === 'USD') {
        priceUSD = event.priceAtEvent;
        if (usdThbRate) priceTHB = event.priceAtEvent * usdThbRate;
      } else if (sourceCurrency === 'THB') {
        priceTHB = event.priceAtEvent;
        if (usdThbRate) priceUSD = event.priceAtEvent / usdThbRate;
      } else {
        if (rates.toUsd) priceUSD = event.priceAtEvent * rates.toUsd;
        if (rates.toThb) priceTHB = event.priceAtEvent * rates.toThb;
      }
    }

    return {
      ...event,
      amountUSD: amountUSD ? Number(amountUSD.toFixed(4)) : null,
      amountTHB: amountTHB ? Number(amountTHB.toFixed(4)) : null,
      priceUSD: priceUSD ? Number(priceUSD.toFixed(4)) : null,
      priceTHB: priceTHB ? Number(priceTHB.toFixed(4)) : null,
      // Include exchange rate used for reference
      fxRateUsed: sourceCurrency === 'USD' ? usdThbRate : (rates.toThb || null)
    };
  });
};

// ======================================================
// === Section 4: Express App                         ===
// ======================================================

const app = express();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow server-to-server / curl
    if (!allowedOrigins.length) return cb(null, true); // dev: allow all if not configured
    return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS not allowed'));
  }
}));
app.use(express.json());

app.use((req, res, next) => {
  if (circuitBreaker.check(res)) return;
  next();
});

// ======================================================
// === Section 5: Route Controllers                   ===
// ======================================================

// --- Controller: Get USD/THB Exchange Rate ---
const getUsdThbRate = async (req, res) => {
  try {
    const rate = await getFxRate('USD', 'THB');
    if (!rate) {
      return res.status(503).json({ error: 'Unable to fetch USD/THB rate at this time.' });
    }
    return res.json({
      currencyPair: 'USD/THB',
      rate: Number(rate.toFixed(4)),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Forex] Error fetching USD/THB:', error);
    return res.status(500).json({ error: 'Internal Server Error fetching Forex rate.' });
  }
};

const getStockQuote = async (req, res) => {
  const raw = req.params.ticker;
  const variants = buildTickerVariants(raw);

  let lastError = null;
  for (const symbol of variants) {
    const cacheKey = `quote_${symbol}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return res.json(cached);

    try {
      const quote = await yahooFinance.quote(symbol, {
        fields: ['symbol', 'longName', 'regularMarketPrice', 'currency', 'regularMarketTime'],
      });

      if (!quote || !quote.symbol || !Number.isFinite(quote.regularMarketPrice)) {
        lastError = new Error(`No quote data found for ${symbol}`);
        continue;
      }

      const responseData = {
        symbol: quote.symbol,
        longName: quote.longName ?? null,
        currentPrice: Number(quote.regularMarketPrice.toFixed(2)),
        currency: quote.currency ?? null,
        timestamp: quote.regularMarketTime
          ? new Date(quote.regularMarketTime * 1000).toISOString()
          : null,
      };

      cacheManager.set(cacheKey, responseData);
      return res.json(responseData);
    } catch (error) {
      console.error(`[Fetch] Quote error for ${symbol}:`, error);
      if (error instanceof SyntaxError && error.message?.includes('Unexpected token')) {
        circuitBreaker.trip();
        return res.status(429).json({ error: 'Too many requests to external API. Please wait a moment.' });
      }
      if (error.status === 404) {
        lastError = error;
        continue;
      }
      lastError = error;
    }
  }

  if (lastError?.status === 404) {
    return res.status(404).json({ error: `Ticker '${normalizeTicker(raw)}' not found.` });
  }
  return res.status(500).json({ error: lastError?.message || 'Failed to fetch stock quote.' });
};

const getStockHistory = async (req, res) => {
  const raw = req.params.ticker;
  const variants = buildTickerVariants(raw);
  const { startDate, endDate } = req.query;

  let period1;
  let period2;
  try {
    ({ period1, period2 } = buildDateRange(startDate, endDate, 90));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  let lastError = null;
  for (const symbol of variants) {
    const cacheKey = `history_${symbol}_${startDate || '90d'}_${endDate || 'today'}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return res.json(cached);

    try {
      const result = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval: '1d',
      });

      const history = parseQuoteSeries(result?.quotes || []);
      if (!history.length) {
        lastError = new Error(`No history found for ticker: ${symbol}`);
        continue;
      }

      const responseData = history.map((row) => ({
        date: row.iso,
        close: row.close,
        volume: row.volume ?? null,
      }));

      cacheManager.set(cacheKey, responseData);
      return res.json(responseData);
    } catch (error) {
      console.error(`[Fetch] History error for ${symbol}:`, error);
      if (error instanceof SyntaxError && error.message?.includes('Unexpected token')) {
        circuitBreaker.trip();
        return res.status(429).json({ error: 'Too many requests to external API. Please wait a moment.' });
      }
      if (error.status === 404) {
        lastError = error;
        continue;
      }
      lastError = error;
    }
  }

  if (lastError?.status === 404) {
    return res.status(404).json({ error: `Ticker '${normalizeTicker(raw)}' not found.` });
  }
  return res.status(500).json({ error: lastError?.message || 'Failed to fetch stock history.' });
};

const getDividendHistory = async (req, res) => {
  const raw = req.params.ticker;
  const variants = buildTickerVariants(raw);
  const { startDate, endDate } = req.query;

  let period1;
  let period2;
  try {
    ({ period1, period2 } = buildDateRange(startDate, endDate, 365 * 5));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  let lastError = null;
  for (const symbol of variants) {
    const cacheKey = `dividends_${symbol}_${startDate || 'max'}_${endDate || 'today'}`;
    const cached = cacheManager.get(cacheKey);
    if (cached) return res.json(cached);

    try {
      const result = await yahooFinance.chart(symbol, {
        period1,
        period2,
        interval: '1d',
        events: 'div',
      });

      const dividendEvents = result?.events?.dividends;
      const dividendArray = dividendEvents ? Object.values(dividendEvents) : [];
      if (dividendArray.length === 0) {
        lastError = new Error(`No dividend data found for ticker: ${symbol}`);
        continue;
      }

      const quoteSeries = parseQuoteSeries(result?.quotes || []);
      const aggregateIssues = new Set();
      const processedEvents = [];
      let flaggedEvents = 0;

      for (const event of dividendArray) {
        const warnings = [];

        const eventDate = toDateObject(event.date ?? event.timestamp ?? null);

        if (!(eventDate instanceof Date) || Number.isNaN(eventDate.getTime())) {
          warnings.push('ไม่สามารถตีความวันที่ได้');
          aggregateIssues.add('พบข้อมูลปันผลที่ไม่สามารถตีความวันที่ได้');
        }

        const amountPerShare =
          typeof event.amount === 'number' && Number.isFinite(event.amount) ? Number(event.amount) : null;
        if (amountPerShare === null) {
          warnings.push('ไม่มีจำนวนปันผลต่อหุ้น');
          aggregateIssues.add('บางรายการไม่มีจำนวนปันผลต่อหุ้น');
        }

        const currency = event.currency || result?.meta?.currency || null;
        const withinRequestedRange = eventDate instanceof Date && eventDate >= period1 && eventDate <= period2;

        const priceInfo =
          eventDate instanceof Date && quoteSeries.length ? findPriceForDate(quoteSeries, eventDate) : null;

        let priceAtEvent = null;
        let priceDate = null;
        if (priceInfo) {
          priceAtEvent = priceInfo.close;
          priceDate = toDateOnly(priceInfo.date);
          if (priceInfo.date < eventDate) {
            warnings.push('ใช้ราคาปิดก่อนหน้าวันจ่ายปันผล');
            aggregateIssues.add('ต้องใช้ราคาปิดก่อนหน้าวันปันผลสำหรับบางรายการ');
          }
        } else {
          warnings.push('ไม่พบราคาปิดใกล้เคียง');
          aggregateIssues.add('บางรายการไม่มีราคาปิดให้คำนวณ Dividend Yield');
        }

        let yieldPercent = null;
        if (Number.isFinite(priceAtEvent) && Number.isFinite(amountPerShare) && priceAtEvent > 0) {
          yieldPercent = Number(((amountPerShare / priceAtEvent) * 100).toFixed(2));
          if (yieldPercent > 20) {
            warnings.push('Dividend Yield สูงผิดปกติ (>20%) กรุณาตรวจสอบข้อมูล');
            aggregateIssues.add('พบ Dividend Yield สูงกว่า 20% ในบางรายการ');
          }
        }

        if (warnings.length > 0) flaggedEvents += 1;

        processedEvents.push({
          date: toDateOnly(eventDate),
          withinRequestedRange,
          amountPerShare,
          currency,
          priceAtEvent: Number.isFinite(priceAtEvent) ? Number(priceAtEvent.toFixed(4)) : null,
          priceDate,
          yieldPercent,
          qualityWarnings: warnings,
          raw: event,
        });
      }

      // --- FX Rate Injection ---
      const enrichedEvents = await enrichCurrency(processedEvents);

      // Fetch current general USD/THB rate for reference in response meta
      const currentUsdThb = await getFxRate('USD', 'THB');

      const coverageEvents = enrichedEvents
        .filter((event) => event.withinRequestedRange && event.date)
        .map((event) => ({
          ...event,
          iso: event.date ? new Date(`${event.date}T00:00:00Z`).toISOString() : null,
        }))
        .filter((event) => event.iso);

      const sortedCoverage = [...coverageEvents].sort(
        (a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime(),
      );
      const actualStart = sortedCoverage[0]?.date ?? null;
      const actualEnd = sortedCoverage[sortedCoverage.length - 1]?.date ?? null;

      const actualRangeDays =
        actualStart && actualEnd
          ? Math.floor(
              (new Date(`${actualEnd}T00:00:00Z`).getTime() - new Date(`${actualStart}T00:00:00Z`).getTime()) /
                MS_PER_DAY,
            ) + 1
          : 0;
      const requestedRangeDays = Math.floor((period2 - period1) / MS_PER_DAY) + 1;
      const coverageRatio =
        requestedRangeDays > 0 && actualRangeDays > 0
          ? Number(Math.min(actualRangeDays / requestedRangeDays, 1).toFixed(3))
          : 0;

      if (flaggedEvents > 0) {
        aggregateIssues.add(`มี ${flaggedEvents} รายการที่มีคำเตือนเพิ่มเติม`);
      }

      const payload = {
        ticker: normalizeTicker(raw),
        resolvedTicker: symbol,
        currency: enrichedEvents[0]?.currency || result?.meta?.currency || null,
        meta: {
          currentUsdThbRate: currentUsdThb ? Number(currentUsdThb.toFixed(4)) : null,
          fxTimestamp: new Date().toISOString()
        },
        period: {
          start: toDateOnly(period1),
          end: toDateOnly(period2),
        },
        events: enrichedEvents.sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(`${b.date}T00:00:00Z`).getTime() - new Date(`${a.date}T00:00:00Z`).getTime();
        }),
        quality: {
          requestedRange: { start: toDateOnly(period1), end: toDateOnly(period2) },
          actualRange: { start: actualStart, end: actualEnd },
          requestedRangeDays,
          actualRangeDays,
          coverageRatio,
          invalidEventsDropped: 0,
          flaggedEvents,
          issues: Array.from(aggregateIssues),
        },
      };

      cacheManager.set(cacheKey, payload);
      return res.json(payload);
    } catch (error) {
      console.error(`[Fetch] Dividend error for ${symbol}:`, error);
      if (error instanceof SyntaxError && error.message?.includes('Unexpected token')) {
        circuitBreaker.trip();
        return res.status(429).json({ error: 'Too many requests to external API. Please wait a moment.' });
      }
      if (error.status === 404) {
        lastError = error;
        continue;
      }
      lastError = error;
    }
  }

  if (lastError?.status === 404) {
    return res.status(404).json({ error: `Ticker '${normalizeTicker(raw)}' not found.` });
  }
  return res.status(500).json({ error: lastError?.message || 'Failed to fetch dividend history.' });
};

// ======================================================
// === Section 6: Routes                              ===
// ======================================================

/* added: helper to catch & log route registration errors so we can see the offending path */
function safeRegister(method, routePath, handler) {
  try {
    if (typeof app[method] !== 'function') {
      console.error(`[Route] Unknown method: ${method} for path: ${routePath}`);
      return;
    }
    app[method](routePath, handler);
    console.log(`[Route] Registered ${method.toUpperCase()} ${routePath}`);
  } catch (err) {
    console.error(`[Route] Failed to register ${method.toUpperCase()} ${routePath}:`, err && err.message ? err.message : err);
    throw err;
  }
}

/* replace direct app.get(...) with safeRegister(...) */
safeRegister('get', '/api/stock/:ticker', getStockQuote);
safeRegister('get', '/api/stock/history/:ticker', getStockHistory);
safeRegister('get', '/api/stock/dividends/:ticker', getDividendHistory);
safeRegister('get', '/api/forex/usd-thb', getUsdThbRate);

// --- Health check route ---
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

// --- Error monitoring: uncaught exceptions & unhandled rejections
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err && err.stack ? err.stack : err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled Rejection:', reason && reason.stack ? reason.stack : reason);
});

// ======================================================
// === Serve static + SPA fallback
// ======================================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// serve static when present (safe guard for split-deploy)
const staticPath = path.join(__dirname, '..', 'public');
console.log('[Server] Static path:', staticPath);
if (fs.existsSync(staticPath)) {
  app.use(express.static(staticPath));
  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    app.get(/.*/, (req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        return res.sendFile(indexPath, (err) => {
          if (err) {
            console.error('[Server] Error sending index.html:', err);
            next(err);
          }
        });
      }
      return next();
    });
    console.log('[Server] SPA fallback registered for static build.');
  } else {
    console.warn('[Server] index.html not found in static path — skipping SPA fallback.');
  }
} else {
  console.log('[Server] Static folder not present — skipping static serving.');
}

// Start server
app.listen(PORT, () => {
  console.log(`✅ Yahoo Finance Stock API is running on http://localhost:${PORT}`);
});