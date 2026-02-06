/**
 * =====================================================
 * IndicatorsPage.jsx - หน้าวิเคราะห์กราฟเทคนิคหุ้น (Technical Analysis)
 * =====================================================
 * 
 * **จุดประสงค์:**
 * หน้านี้ทำหน้าที่แสดงกราฟเทคนิคแบบครบวงจรสำหรับการวิเคราะห์หุ้น ประกอบด้วย:
 * - กราฟราคา (Price Chart) พร้อม SMA/EMA
 * - RSI (Relative Strength Index) พร้อม Smoothing และ Divergence Detection
 * - MACD (Moving Average Convergence Divergence) พร้อม Histogram
 * - Volume Chart (ปริมาณการซื้อขาย)
 * 
 * **โครงสร้างไฟล์:**
 * 1. Section 1: Helper Functions (ฟังก์ชันช่วยเหลือ - parseDate, calculateDays, Presets)
 * 2. Section 2: Calculation Functions (คำนวณ Indicators - SMA, EMA, RSI, MACD, Bollinger Bands)
 * 3. Section 3: Main Component (IndicatorsPage)
 *    - State Management (จัดการ State)
 *    - Event Handlers (จัดการ Event)
 *    - Data Processing (ประมวลผลข้อมูล)
 *    - Rendering (แสดงผล UI)
 * 
 * **Technical Indicators ที่รองรับ:**
 * - SMA (Simple Moving Average): ค่าเฉลี่ยเคลื่อนที่แบบธรรมดา
 * - EMA (Exponential Moving Average): ค่าเฉลี่ยเคลื่อนที่แบบเลขชี้กำลัง
 * - RSI: ดัชนีความแข็งแกร่งสัมพัทธ์ (0-100) เพื่อหาจุด Overbought/Oversold
 * - MACD: เส้น MACD, Signal Line, และ Histogram เพื่อวิเคราะห์ Momentum
 * - Bollinger Bands: แถบราคาบนและล่างที่คำนวณจากส่วนเบี่ยงเบนมาตรฐาน
 * - Volume: ปริมาณการซื้อขายแต่ละวัน
 * 
 * **Features พิเศษ:**
 * - Divergence Detection: ตรวจจับ RSI Divergence อัตโนมัติ (Bullish/Bearish)
 * - Interactive Charts: ซูม, Tooltip, Crosshair
 * - Responsive: รองรับทุกขนาดหน้าจอ
 */

// src/pages/IndicatorsPage.jsx
// --- React & Libraries ---
import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer, ComposedChart, Line, Bar, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ReferenceLine,
  ReferenceDot, ReferenceArea
} from 'recharts';
import '../css/IndicatorsPage.css';
import { apiFetch } from '../utils/api';
import PriceChart from '../Component/Indicators/PriceChart';
import LightweightPriceChart from '../Component/Indicators/LightweightPriceChart';
import VolumeChart from '../Component/Indicators/VolumeChart';
import RsiChart from '../Component/Indicators/RsiChart';
import MacdHistogramChart from '../Component/Indicators/MacdHistogramChart';
import ZoomControls from '../Component/Indicators/ZoomControls';
import VerticalScaleSlider from '../Component/Indicators/VerticalScaleSlider';

// --- Helpers & Utilities (Section 1) ---
const parseISODate = (iso) => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const calculateDateRangeInDays = (start, end) => {
  if (!start || !end) return 0;
  const s = parseISODate(start);
  const e = parseISODate(end);
  if (!s || !e) return 0;
  return Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
};

const PRESET_RANGES = [
  {
    id: 'week1',
    label: '1 สัปดาห์',
    getRange: () => {
      const end = new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    id: 'month1',
    label: '1 เดือน',
    getRange: () => {
      const end = new Date();
      const start = new Date(end);
      start.setMonth(start.getMonth() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    id: 'month3',
    label: '3 เดือน',
    getRange: () => {
      const end = new Date();
      const start = new Date(end);
      start.setMonth(start.getMonth() - 3);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    id: 'ytd',
    label: 'YTD',
    getRange: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
  {
    id: 'year1',
    label: '1 ปี',
    getRange: () => {
      const end = new Date();
      const start = new Date(end);
      start.setFullYear(start.getFullYear() - 1);
      return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      };
    },
  },
];

const RSI_SETTINGS = {
  length: 14,
  smoothingType: 'SMA + Bollinger Bands',
  smoothingLength: 14,
  bbMultiplier: 2,
  divergence: {
    enabled: true,
    lookbackLeft: 5,
    lookbackRight: 5,
    rangeUpper: 60,
    rangeLower: 5
  }
};

// --- Calculation Functions (Section 2) ---
async function fetchStockHistory(symbol, startDate, endDate) {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const query = params.toString();
  return apiFetch(`/api/stock/history/${symbol}${query ? `?${query}` : ''}`);
}

const calculateSMA = (data, period) => {
  if (!Array.isArray(data) || data.length < period) return null;
  const out = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) {
      out.push({
        date: data[i].date,
        value: sum / period
      });
    }
  }
  return out;
};

const calculateEMA = (data, period) => {
  if (!Array.isArray(data) || data.length < period) return null;
  const out = [];
  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
  for (let i = period - 1; i < data.length; i++) {
    if (i > period - 1) {
      ema = data[i].close * k + ema * (1 - k);
    }
    out.push({
      date: data[i].date,
      value: ema
    });
  }
  return out;
};

const calculateRSI = (data, period = 14) => {
  if (!Array.isArray(data) || data.length < period + 1) return null;
  const changes = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }
  const out = [];
  let gains = 0, losses = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) gains += changes[i];
    else losses += -changes[i];
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - change) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    out.push({
      date: data[i + 1].date,
      value: rsi
    });
  }
  return out;
};

const calculateMACD = (data, fast = 12, slow = 26, sig = 9) => {
  if (!Array.isArray(data) || data.length < slow + sig) return null;
  const emaFast = calculateEMA(data, fast);
  const emaSlow = calculateEMA(data, slow);
  if (!emaFast || !emaSlow) return null;
  const macdLine = [];
  const macdMap = new Map(emaFast.map(e => [e.date.getTime(), e.value]));
  const slowMap = new Map(emaSlow.map(e => [e.date.getTime(), e.value]));
  for (let i = slow - 1; i < data.length; i++) {
    const ts = data[i].date.getTime();
    const m = (macdMap.get(ts) ?? 0) - (slowMap.get(ts) ?? 0);
    macdLine.push({ date: data[i].date, value: m });
  }
  const signalLine = calculateEMA(macdLine.map(m => ({ ...m, close: m.value })), sig);
  if (!signalLine) return null;
  const histogram = [];
  const sigMap = new Map(signalLine.map(s => [s.date.getTime(), s.value]));
  for (const ml of macdLine) {
    const ts = ml.date.getTime();
    const h = ml.value - (sigMap.get(ts) ?? 0);
    histogram.push({ date: ml.date, value: h });
  }
  return { macdLine, signalLine, histogram };
};

const calculateBollingerBands = (data, period = 20, devs = 2) => {
  if (!Array.isArray(data) || data.length < period) return null;
  const calculateSD = arr => {
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
  };
  const bb = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).map(d => d.close);
    const middle = slice.reduce((s, v) => s + v, 0) / period;
    const sd = calculateSD(slice);
    bb.push({
      date: data[i].date,
      upper: middle + devs * sd,
      middle,
      lower: middle - devs * sd
    });
  }
  return bb;
};

// เพิ่ม helper: Resample data ถ้าเยอะเกินไป (ลด labels overlap)
const resampleData = (data, maxPoints = 50) => {
  if (!Array.isArray(data) || data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0 || i === data.length - 1);
};

// Calculate Fibonacci Retracement Levels
// Calculate Fibonacci Retracement Levels
// Calculate Fibonacci Retracement Levels
const calculateFibonacci = (data) => {
  if (!Array.isArray(data) || data.length < 2) return null;
  const closes = data.map(d => d.close).filter(v => typeof v === 'number');
  if (closes.length < 2) return null;
  const high = Math.max(...closes);
  const low = Math.min(...closes);
  const diff = high - low;

  // Define levels with specific colors and labels
  const levels = [
    { level: '100% (Low)', value: low, color: '#ff5252' },     // Red for Low
    { level: '78.6%', value: high - diff * 0.786, color: '#ffb74d' },
    { level: '61.8%', value: high - diff * 0.618, color: '#ffd740' }, // Golden
    { level: '50%', value: high - diff * 0.5, color: '#aeea00' },     // Center
    { level: '38.2%', value: high - diff * 0.382, color: '#ffd740' },
    { level: '23.6%', value: high - diff * 0.236, color: '#ffb74d' },
    { level: '0% (High)', value: high, color: '#448aff' }      // Blue for High
  ];
  return { high, low, levels };
};

// --- New RSI Helpers ---

const calculateStDev = (arr) => {
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
};

const calculateRSISmoothing = (rsiData, type, length, mult) => {
  if (!rsiData || rsiData.length < length) return rsiData;
  const values = rsiData.map(d => d.value);

  // Calculate MA based on type
  let maValues = [];
  if (type === 'SMA' || type === 'SMA + Bollinger Bands') {
    // Simple Moving Average
    for (let i = 0; i < values.length; i++) {
      if (i < length - 1) { maValues.push(null); continue; }
      const slice = values.slice(i - length + 1, i + 1);
      maValues.push(slice.reduce((a, b) => a + b, 0) / length);
    }
  } else if (type === 'EMA') {
    // Exponential Moving Average
    const k = 2 / (length + 1);
    let ema = values.slice(0, length).reduce((a, b) => a + b, 0) / length;
    for (let i = 0; i < values.length; i++) {
      if (i < length - 1) { maValues.push(null); continue; }
      if (i === length - 1) { maValues.push(ema); continue; }
      ema = values[i] * k + ema * (1 - k);
      maValues.push(ema);
    }
  }

  // Attach to data
  return rsiData.map((d, i) => {
    const ma = maValues[i];
    let bands = {};
    if (type === 'SMA + Bollinger Bands' && ma !== null && i >= length - 1) {
      const slice = values.slice(i - length + 1, i + 1);
      const std = calculateStDev(slice);
      bands = {
        smoothingUpper: ma + std * mult,
        smoothingLower: ma - std * mult
      };
    }
    return { ...d, smoothing: ma, ...bands };
  });
};

const calculateDivergence = (rsiData, priceData, lookbackL = 5, lookbackR = 5) => {
  // Need matched indices
  // Assumes rsiData and priceData are aligned by Date or can be joined.
  // Here we assume rsiData is derived from priceData and has same length/alignment approx.
  // Actually rsiData starts later. We need to map by date.

  if (!rsiData || !priceData) return [];

  const priceMap = new Map(priceData.map(p => [p.date.getTime(), p]));
  const combined = rsiData.map(r => {
    const p = priceMap.get(r.date.getTime());
    return { ...r, priceHigh: p?.high, priceLow: p?.low, priceClose: p?.close };
  }).filter(d => d.priceClose !== undefined);

  const divergences = [];

  // Pivot detection helpers
  const isPivotLow = (arr, i, lbL, lbR) => {
    if (i < lbL || i >= arr.length - lbR) return false;
    const val = arr[i];
    for (let j = 1; j <= lbL; j++) if (arr[i - j] < val) return false; // Must be lower than left
    for (let j = 1; j <= lbR; j++) if (arr[i + j] <= val) return false; // Must be lower than right
    return true;
  };

  const isPivotHigh = (arr, i, lbL, lbR) => {
    if (i < lbL || i >= arr.length - lbR) return false;
    const val = arr[i];
    for (let j = 1; j <= lbL; j++) if (arr[i - j] > val) return false; // Must be higher than left
    for (let j = 1; j <= lbR; j++) if (arr[i + j] >= val) return false; // Must be higher than right
    return true;
  };

  const rsiVals = combined.map(c => c.value);
  const lowVals = combined.map(c => c.priceLow); // Using Low for Bullish
  const highVals = combined.map(c => c.priceHigh); // Using High for Bearish (or Close if preferred, standard is High/Low)

  let lastPL = null; // { index, rsi, price }
  let lastPH = null;

  for (let i = lookbackL; i < combined.length - lookbackR; i++) {
    // Check Bullish (Pivot Low)
    if (isPivotLow(rsiVals, i, lookbackL, lookbackR)) {
      if (lastPL) {
        // Check Divergence condition: Price Lower Low AND RSI Higher Low
        if (lowVals[i] < lastPL.price && rsiVals[i] > lastPL.rsi) {
          // Found Bullish Divergence
          divergences.push({ date: combined[i].date, type: 'bull', value: rsiVals[i] });
        }
      }
      lastPL = { index: i, rsi: rsiVals[i], price: lowVals[i] };
    }

    // Check Bearish (Pivot High)
    if (isPivotHigh(rsiVals, i, lookbackL, lookbackR)) {
      if (lastPH) {
        // Check Divergence condition: Price Higher High AND RSI Lower High
        if (highVals[i] > lastPH.price && rsiVals[i] < lastPH.rsi) {
          // Found Bearish Divergence
          divergences.push({ date: combined[i].date, type: 'bear', value: rsiVals[i] });
        }
      }
      lastPH = { index: i, rsi: rsiVals[i], price: highVals[i] };
    }
  }

  return divergences;
};

// Calculate Golden Cross and Death Cross (Strict Crossover)
const calculateGoldenDeathCross = (data, sma50List, sma200List) => {
  if (!data || !sma50List || !sma200List) return { signals: [], zones: [] };

  const sma50Map = new Map(sma50List.map(s => [s.date.getTime(), s.value]));
  const sma200Map = new Map(sma200List.map(s => [s.date.getTime(), s.value]));

  const signals = [];
  const zones = [];
  let zoneStart = null;
  let currentZoneType = null; // 'golden' or 'death'

  // Iterate from the second point to allow comparison with previous
  for (let i = 1; i < data.length; i++) {
    const ts = data[i].date.getTime();
    const prevTs = data[i - 1].date.getTime();

    const sma50 = sma50Map.get(ts);
    const sma200 = sma200Map.get(ts);
    const prevSma50 = sma50Map.get(prevTs);
    const prevSma200 = sma200Map.get(prevTs);

    if (sma50 == null || sma200 == null || prevSma50 == null || prevSma200 == null) continue;

    const isGolden = sma50 > sma200;
    const isDeath = sma50 < sma200;

    // Strict Crossover Check:
    // Golden: Yesterday 50 <= 200 AND Today 50 > 200
    // Death: Yesterday 50 >= 200 AND Today 50 < 200

    let signalType = null;
    if (prevSma50 <= prevSma200 && sma50 > sma200) {
      signalType = 'golden';
    } else if (prevSma50 >= prevSma200 && sma50 < sma200) {
      signalType = 'death';
    }

    if (signalType) {
      signals.push({
        date: data[i].date,
        type: signalType,
        price: data[i].close
      });

      // Zone Management
      if (zoneStart) {
        zones.push({ start: zoneStart, end: data[i].date, type: currentZoneType });
      }
      zoneStart = data[i].date;
      currentZoneType = signalType;
    } else if (!zoneStart) {
      // Initialize first zone based on current state if not started
      zoneStart = data[i].date;
      currentZoneType = isGolden ? 'golden' : 'death';
    }
  }

  // Close final zone
  if (zoneStart && data.length > 0) {
    zones.push({ start: zoneStart, end: data[data.length - 1].date, type: currentZoneType });
  }

  return { signals, zones };
};

// Calculate Peak High/Low Points for Weekly, Monthly, Yearly
// Returns an array of marker objects: { date, type: 'weeklyHigh'|'weeklyLow', value }
const calculatePeakPoints = (data, periodType) => {
  if (!Array.isArray(data) || data.length === 0) return [];

  // Helper to get period key
  const getPeriodKey = (date) => {
    const d = new Date(date);
    if (periodType === 'week') {
      const onejan = new Date(d.getFullYear(), 0, 1);
      const millis = d - onejan;
      return `${d.getFullYear()}-W${Math.ceil((((millis / 86400000) + onejan.getDay() + 1) / 7))}`;
    } else if (periodType === 'month') {
      return `${d.getFullYear()}-${d.getMonth() + 1}`;
    } else if (periodType === 'year') {
      return `${d.getFullYear()}`;
    }
    return '';
  };

  // Group data by period
  const groups = new Map();
  data.forEach(item => {
    const key = getPeriodKey(item.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const peaks = [];
  const typePrefix = periodType === 'week' ? 'weekly' : periodType === 'month' ? 'monthly' : 'yearly';

  groups.forEach((items) => {
    if (items.length === 0) return;

    // Find the item with the highest close price
    let highItem = items[0];
    let lowItem = items[0];

    items.forEach(item => {
      const price = (item.high !== undefined && item.high !== null) ? item.high : item.close;
      const lowPrice = (item.low !== undefined && item.low !== null) ? item.low : item.close;
      const highItemPrice = (highItem.high !== undefined && highItem.high !== null) ? highItem.high : highItem.close;
      const lowItemPrice = (lowItem.low !== undefined && lowItem.low !== null) ? lowItem.low : lowItem.close;

      if (price > highItemPrice) highItem = item;
      if (lowPrice < lowItemPrice) lowItem = item;
    });

    // Add peak markers (using formatted date string for chart matching)
    const formatDate = (d) => d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });

    peaks.push({
      date: formatDate(highItem.date),
      type: `${typePrefix}High`,
      value: (highItem.high !== undefined && highItem.high !== null) ? highItem.high : highItem.close
    });

    peaks.push({
      date: formatDate(lowItem.date),
      type: `${typePrefix}Low`,
      value: (lowItem.low !== undefined && lowItem.low !== null) ? lowItem.low : lowItem.close
    });
  });

  return peaks;
};

// --- Main Component (Section 3) ---
export default function IndicatorsPage() {
  const [inputSymbol, setInputSymbol] = useState('');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [displayRange, setDisplayRange] = useState({ start: '', end: '' });
  const [chartData, setChartData] = useState({});
  const [currency, setCurrency] = useState('');
  const [heightScale, setHeightScale] = useState(1.0);
  const [widthPct, setWidthPct] = useState(90);
  const [pricePadPct, setPricePadPct] = useState(0.06);
  const [visibleIndicators, setVisibleIndicators] = useState({
    sma: true,
    ema: true,
    bb: true,
    fib: true,
    goldenDeath: true,
    weeklyHighLow: false,
    monthlyHighLow: false,
    yearlyHighLow: false,
    volume: true,
    rsi: true,
    macd: true
  });
  const abortRef = useRef(null);
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  // Toggle ระหว่าง Recharts กับ TradingView (Lightweight Charts)
  const [useTradingViewChart, setUseTradingViewChart] = useState(false);

  // =====================================================
  // === Zoom & Pan State (TradingView-style Interaction) ===
  // =====================================================
  // zoomWindow: กำหนดช่วงข้อมูลที่จะแสดง (index-based)
  //   - startIndex: index เริ่มต้นของข้อมูลที่จะแสดง
  //   - endIndex: index สิ้นสุดของข้อมูลที่จะแสดง
  // เมื่อ Zoom In: endIndex - startIndex จะน้อยลง (แคบลง)
  // เมื่อ Zoom Out: endIndex - startIndex จะมากขึ้น (กว้างขึ้น)
  const [zoomWindow, setZoomWindow] = useState({ startIndex: 0, endIndex: 100 });

  // isDragging: ติดตามว่าผู้ใช้กำลังลากเมาส์อยู่หรือไม่ (สำหรับ Pan)
  const [isDragging, setIsDragging] = useState(false);

  // dragStartX: ตำแหน่ง X ที่เมาส์เริ่มต้นลาก
  const dragStartX = useRef(0);

  // zoomWindowRef: เก็บค่า zoomWindow ณ ตอนเริ่มลาก (ใช้คำนวณ delta)
  const zoomWindowRef = useRef({ startIndex: 0, endIndex: 100 });

  // chartContainerRef: อ้างอิง DOM element ของ container กราฟ
  const chartContainerRef = useRef(null);

  // Animation Frame Refs for Smooth Panning
  const requestRef = useRef(null);
  const lastMouseX = useRef(0);



  const toggleIndicator = useCallback((key) => {
    setVisibleIndicators(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const dateRangeInDays = calculateDateRangeInDays(startDate, endDate);
  const displayRangeInDays = calculateDateRangeInDays(displayRange.start, displayRange.end);

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  const basePriceHeight = 540;
  const priceHeight = clamp(basePriceHeight * heightScale, 360, 860);
  const volumeHeight = clamp(priceHeight * 0.32, 140, 340);
  const rsiHeight = clamp(priceHeight * 0.40, 210, 420);

  const formatDisplayDate = (iso) => {
    if (!iso) return '-';
    const d = parseISODate(iso);
    if (!d) return '-';
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // =====================================================
  // === Zoom & Pan Handlers ===
  // =====================================================

  /**
   * handleWheel - จัดการการซูมและ Pan ด้วย Mouse Wheel
   * @param {WheelEvent} e - event จากการ scroll wheel
   * 
   * การทำงาน (ปรับปรุงใหม่):
   * - Scroll: Zoom (ซูมเข้า/ออก) โดยซูมไปที่ตำแหน่งเมาส์
   * - Shift + Scroll: Pan (เลื่อนซ้าย-ขวา)
   */
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const dataLength = chartData.price?.length || 0;
    if (dataLength === 0) return;

    // === ค่าคงที่ ===
    const MIN_WINDOW_SIZE = 10;  // ต้องแสดงอย่างน้อย 10 จุด
    const ZOOM_SPEED = 0.1;      // ความเร็วซูม
    const PAN_SPEED = 0.2;       // ความเร็ว Pan

    // === คำนวณตำแหน่งเมาส์เทียบกับ container ===
    const containerRect = chartContainerRef.current?.getBoundingClientRect();
    const mouseXRatio = containerRect
      ? (e.clientX - containerRect.left) / containerRect.width
      : 0.5;

    // ตรวจสอบว่าเป็นการ Pan หรือ Zoom
    // ถ้านิ้วปัดซ้ายขวา (deltaX) หรือกด Shift -> Pan
    const isPanning = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey;

    if (isPanning) {
      // === PAN MODE ===
      // delta > 0 (ขวา/ลง) -> เลื่อนไปทางขวา (ข้อมูลใหม่)
      const direction = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) > 0 ? 1 : -1;

      setZoomWindow(prev => {
        const currentRange = prev.endIndex - prev.startIndex;
        const panDelta = Math.max(1, Math.round(currentRange * PAN_SPEED));
        const shift = panDelta * direction;

        let newStart = prev.startIndex + shift;
        let newEnd = prev.endIndex + shift;

        // Clamp
        if (newStart < 0) {
          newStart = 0;
          newEnd = currentRange;
        }
        if (newEnd > dataLength) {
          newEnd = dataLength;
          newStart = dataLength - currentRange;
        }

        newStart = Math.max(0, newStart);
        newEnd = Math.min(dataLength, newEnd);

        return { startIndex: newStart, endIndex: newEnd };
      });
    } else {
      // === ZOOM MODE (Default Scroll) ===
      const direction = e.deltaY > 0 ? 1 : -1; // +1 zoom out, -1 zoom in

      setZoomWindow(prev => {
        const currentRange = prev.endIndex - prev.startIndex;
        const delta = Math.max(1, Math.round(currentRange * ZOOM_SPEED));

        let newStart = prev.startIndex;
        let newEnd = prev.endIndex;

        if (direction < 0) {
          // Zoom In
          const leftDelta = Math.round(delta * mouseXRatio);
          const rightDelta = delta - leftDelta;
          newStart = prev.startIndex + leftDelta;
          newEnd = prev.endIndex - rightDelta;

          // Min Size Check
          if (newEnd - newStart < MIN_WINDOW_SIZE) {
            const center = Math.round((newStart + newEnd) / 2);
            newStart = center - Math.floor(MIN_WINDOW_SIZE / 2);
            newEnd = center + Math.ceil(MIN_WINDOW_SIZE / 2);
          }
        } else {
          // Zoom Out
          const leftDelta = Math.round(delta * mouseXRatio);
          const rightDelta = delta - leftDelta;
          newStart = prev.startIndex - leftDelta;
          newEnd = prev.endIndex + rightDelta;
        }

        // Clamp
        newStart = Math.max(0, newStart);
        newEnd = Math.min(dataLength, newEnd);

        // Adjust if hitting boundaries
        if (newStart === 0 && newEnd - newStart < currentRange) {
          // If hitting left but trying to zoom out/in, behavior depends, 
          // usually we just clamp start and let end expand if zoom out
          // But if zoom out, ensure we use up available space
        }

        // Ensure we don't exceed data limits
        if (newEnd > dataLength) newEnd = dataLength;
        if (newStart < 0) newStart = 0;

        return { startIndex: newStart, endIndex: newEnd };
      });
    }
  }, [chartData.price?.length]);

  /**
   * handleMouseDown - เริ่มการ Pan (ลากกราฟ)
   * @param {MouseEvent} e
   * 
   * บันทึกตำแหน่งเริ่มต้นและค่า zoomWindow ปัจจุบัน
   */
  const handleMouseDown = useCallback((e) => {
    // เฉพาะ left click (button 0)
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    zoomWindowRef.current = { ...zoomWindow };
  }, [zoomWindow]);

  /**
   * handleMouseMove - ลากกราฟ (Pan) - ปรับปรุงให้เสถียรขึ้น
   * @param {MouseEvent} e
   * 
   * ปรับปรุง:
   * 1. Throttling: ใช้ requestAnimationFrame เพื่อลด re-render
   * 2. Sensitivity: ปรับความไวให้เหมาะสม
   * 3. Boundary protection: ป้องกันการลากเกินขอบ
   */
  /**
   * updatePan - คำนวณและอัปเดตตำแหน่ง Pan ใน Animation Frame
   */
  const updatePan = useCallback(() => {
    if (!isDragging) return;

    const dataLength = chartData.price?.length || 0;
    if (dataLength === 0) return;

    // === คำนวณ Delta จากตำแหน่งเมาส์ล่าสุด ===
    const deltaX = lastMouseX.current - dragStartX.current;

    // ถ้าลากน้อยเกินไป ไม่ต้องทำอะไร (ลด jitter)
    if (Math.abs(deltaX) < 3) {
      requestRef.current = null;
      return;
    }

    const containerWidth = chartContainerRef.current?.offsetWidth || 800;
    const currentRange = zoomWindowRef.current.endIndex - zoomWindowRef.current.startIndex;

    // === คำนวณ pixels per point ===
    const pixelsPerPoint = containerWidth / Math.max(1, currentRange);

    // === คำนวณ Index Shift (ปรับ sensitivity) ===
    const sensitivity = 0.8;
    const indexShift = Math.round((-deltaX / pixelsPerPoint) * sensitivity);

    if (indexShift === 0) {
      requestRef.current = null;
      return;
    }

    let newStart = zoomWindowRef.current.startIndex + indexShift;
    let newEnd = zoomWindowRef.current.endIndex + indexShift;

    // === Clamp: ห้ามเลยขอบเขตข้อมูล ===
    if (newStart < 0) {
      const overflow = -newStart;
      newStart = 0;
      newEnd = Math.min(dataLength, newEnd - overflow + currentRange - (newEnd - overflow - newStart));
      // Simpler: just shift end back proportionally
      newEnd = newStart + currentRange;
    }
    if (newEnd > dataLength) {
      const overflow = newEnd - dataLength;
      newEnd = dataLength;
      newStart = Math.max(0, newStart - overflow);
    }

    // === Final boundary check ===
    newStart = Math.max(0, Math.min(dataLength - 1, newStart));
    newEnd = Math.max(newStart + 1, Math.min(dataLength, newEnd));

    setZoomWindow({ startIndex: newStart, endIndex: newEnd });
    requestRef.current = null;
  }, [isDragging, chartData.price?.length]);


  /**
   * handleMouseMove - ลากกราฟ (Pan) - ปรับปรุงด้วย requestAnimationFrame
   */
  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;

    // Update latest mouse position
    lastMouseX.current = e.clientX;

    // Request animation frame if not already requested
    if (!requestRef.current) {
      requestRef.current = requestAnimationFrame(updatePan);
    }
  }, [isDragging, updatePan]);

  /**
   * handleMouseUp - หยุด Pan
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
  }, []);

  /**
   * handleResetZoom - รีเซ็ตกลับไปแสดงข้อมูลทั้งหมด
   */
  const handleResetZoom = useCallback(() => {
    const dataLength = chartData.price?.length || 0;
    setZoomWindow({ startIndex: 0, endIndex: dataLength });
  }, [chartData.price?.length]);

  // =====================================================
  // === Sliced Data (ข้อมูลที่ถูกตัดตาม Zoom Window) ===
  // =====================================================
  // useMemo: คำนวณใหม่เฉพาะเมื่อ zoomWindow หรือ chartData เปลี่ยน
  const slicedData = useMemo(() => {
    const { startIndex, endIndex } = zoomWindow;
    return {
      price: chartData.price?.slice(startIndex, endIndex) || [],
      volume: chartData.volume?.slice(startIndex, endIndex) || [],
      rsi: chartData.rsi?.slice(
        Math.max(0, startIndex - 14), // RSI ต้องการ 14 periods ก่อนหน้า
        endIndex
      ) || [],
      macd: chartData.macd?.slice(
        Math.max(0, startIndex - 26), // MACD ต้องการ 26 periods ก่อนหน้า
        endIndex
      ) || [],
      // ข้อมูลอื่นๆ ที่ไม่ต้อง slice (เป็น markers หรือ static levels)
      fibonacci: chartData.fibonacci,
      rsiDivergences: chartData.rsiDivergences,
      goldenDeathSignals: chartData.goldenDeathSignals,
      goldenDeathZones: chartData.goldenDeathZones,
      highLowPeaks: chartData.highLowPeaks,
    };
  }, [zoomWindow, chartData]);

  // Effect: อัปเดต zoomWindow เมื่อโหลดข้อมูลใหม่
  // ให้แสดงข้อมูลล่าสุด 50% หรือทั้งหมดถ้าน้อยกว่า 100 จุด
  React.useEffect(() => {
    const dataLength = chartData.price?.length || 0;
    if (dataLength > 0) {
      // แสดงข้อมูลล่าสุด 50% (หรือทั้งหมดถ้าน้อยกว่า 100)
      const showPercent = dataLength > 100 ? 0.5 : 1;
      const startIdx = Math.floor(dataLength * (1 - showPercent));
      setZoomWindow({ startIndex: startIdx, endIndex: dataLength });
    }
  }, [chartData.price?.length]);



  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    const ticker = inputSymbol.trim().toUpperCase();
    if (!ticker) {
      setError('กรุณากรอกชื่อหุ้น');
      return;
    }
    if (!startDate || !endDate) {
      setError('กรุณาเลือกช่วงวันที่');
      return;
    }

    setLoading(true);
    setError('');

    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (e) { /* ignore */ }
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Fetch history (which now includes currency metadata)
      const response = await apiFetch(
        `/api/stock/history/${ticker}?startDate=${startDate}&endDate=${endDate}`,
        { signal: controller.signal }
      );

      // Handle new response format { history, currency }
      // Fallback for backward compatibility if backend returns array
      const rawHistory = Array.isArray(response) ? response : (response.history || []);
      const apiCurrency = response.currency || (ticker.endsWith('.BK') ? 'THB' : 'USD');

      setCurrency(apiCurrency);

      const normalized = rawHistory.map(item => ({ ...item, date: new Date(item.date) }));
      const sorted = normalized.sort((a, b) => a.date - b.date);

      if (sorted.length < 35) {
        throw new Error('ข้อมูลย้อนหลังต้องอย่างน้อย 35 วัน');
      }

      // Calculate indicators
      const sma10 = calculateSMA(sorted, 10);
      const sma50 = calculateSMA(sorted, 50);
      const sma100 = calculateSMA(sorted, 100);
      const sma200 = calculateSMA(sorted, 200);

      const ema50 = calculateEMA(sorted, 50);
      const ema100 = calculateEMA(sorted, 100);
      const ema200 = calculateEMA(sorted, 200);

      const rsi = calculateRSI(sorted, 14);
      const macd = calculateMACD(sorted);
      const bb = calculateBollingerBands(sorted, 20, 2);
      const fibonacci = calculateFibonacci(sorted);

      // Merge into chart data
      const priceData = sorted.map((row, idx) => {
        const smaps = sma10 ? new Map(sma10.map(s => [s.date.getTime(), s.value])) : new Map();
        const sma50s = sma50 ? new Map(sma50.map(s => [s.date.getTime(), s.value])) : new Map();
        const sma100s = sma100 ? new Map(sma100.map(s => [s.date.getTime(), s.value])) : new Map();
        const sma200s = sma200 ? new Map(sma200.map(s => [s.date.getTime(), s.value])) : new Map();

        const ema50s = ema50 ? new Map(ema50.map(s => [s.date.getTime(), s.value])) : new Map();
        const ema100s = ema100 ? new Map(ema100.map(s => [s.date.getTime(), s.value])) : new Map();
        const ema200s = ema200 ? new Map(ema200.map(s => [s.date.getTime(), s.value])) : new Map();

        const bbs = bb ? new Map(bb.map(b => [b.date.getTime(), b])) : new Map();

        const ts = row.date.getTime();
        const bbData = bbs.get(ts) || {};

        return {
          date: row.date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
          close: row.close,
          volume: row.volume || 0,
          sma10: smaps.get(ts),
          sma50: sma50s.get(ts),
          sma100: sma100s.get(ts),
          sma200: sma200s.get(ts),
          ema50: ema50s.get(ts),
          ema100: ema100s.get(ts),
          ema200: ema200s.get(ts),
          bbUpper: bbData.upper,
          bbMiddle: bbData.middle,
          bbLower: bbData.lower,
          isUp: idx === 0 || row.close >= (sorted[idx - 1]?.close || row.close)
        };
      });

      // Calculate RSI Smoothing & Divergence
      const rsiWithSmoothing = calculateRSISmoothing(
        rsi,
        RSI_SETTINGS.smoothingType,
        RSI_SETTINGS.smoothingLength,
        RSI_SETTINGS.bbMultiplier
      );

      const divergences = RSI_SETTINGS.divergence.enabled
        ? calculateDivergence(rsi, sorted, RSI_SETTINGS.divergence.lookbackLeft, RSI_SETTINGS.divergence.lookbackRight)
        : [];

      const rsiData = rsiWithSmoothing ? rsiWithSmoothing.map(r => ({
        date: r.date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
        value: r.value,
        smoothing: r.smoothing,
        smoothingUpper: r.smoothingUpper,
        smoothingLower: r.smoothingLower
      })) : [];

      // Map divergences to display date
      const divergenceData = divergences.map(d => ({
        ...d,
        date: d.date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
      }));

      const macdData = macd ? macd.histogram.map(h => ({
        date: h.date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
        histogram: h.value
      })) : [];

      // Calculate Golden Cross / Death Cross
      const goldenDeathResult = calculateGoldenDeathCross(sorted, sma50, sma200);
      const goldenDeathSignals = goldenDeathResult.signals.map(s => ({
        ...s,
        date: s.date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
      }));
      const goldenDeathZones = goldenDeathResult.zones.map(z => ({
        ...z,
        start: z.start.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
        end: z.end.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
      }));

      // Calculate Weekly/Monthly/Yearly Peak Points (single markers at actual high/low)
      const weeklyPeaks = calculatePeakPoints(sorted, 'week');
      const monthlyPeaks = calculatePeakPoints(sorted, 'month');
      const yearlyPeaks = calculatePeakPoints(sorted, 'year');

      // Combine all peaks for easier passing to PriceChart
      const allPeaks = [...weeklyPeaks, ...monthlyPeaks, ...yearlyPeaks];

      // priceData is already good, no need for stepped HL mapping
      const finalPriceData = priceData;

      setChartData({
        price: finalPriceData,
        volume: finalPriceData,
        rsi: rsiData,
        rsiDivergences: divergenceData,
        macd: macdData,
        fibonacci: fibonacci,
        goldenDeathSignals: goldenDeathSignals,
        goldenDeathZones: goldenDeathZones,
        highLowPeaks: allPeaks, // NEW: Peak markers for High-Low
        priceResampled: resampleData(finalPriceData, 45),
        volumeResampled: resampleData(finalPriceData, 45),
        rsiResampled: resampleData(rsiData, 45),
        macdResampled: resampleData(macdData, 45),
      });

      setDisplayRange({
        start: startDate,
        end: endDate,
      });
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาด');
      setChartData({});
    } finally {
      setLoading(false);
    }
  }, [inputSymbol, startDate, endDate]);

  return (
    <div
      className="page-container indicators-page"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch' // Ensure children take full width
      }}
    >
      <div className="page-header" style={{ textAlign: 'center', width: '100%' }}>
        <h1>Technical Indicators</h1>
        <p className="page-description" style={{ textAlign: 'center' }}>กรอกชื่อหุ้นและวิเคราะห์กราฟเทคนิคแบบละเอียด</p>
      </div>

      <form onSubmit={handleSubmit} className="indicator-form">
        <div className="form-group">
          <label className="form-label">📌 ชื่อหุ้น</label>
          <input
            type="text"
            value={inputSymbol}
            onChange={(e) => setInputSymbol(e.target.value)}
            placeholder="เช่น PTT, AOT, AAPL"
            className="indicator-input"
            required
          />
        </div>

        <div className="date-range-row">
          <label className="date-label input-label">
            📅 จาก
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => {
                setStartDate(e.target.value);
                setSelectedPreset(null);
              }}
              className="indicator-input"
              required
            />
          </label>
          <label className="date-label input-label">
            📅 ถึง
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => {
                setEndDate(e.target.value);
                setSelectedPreset(null);
              }}
              className="indicator-input"
              required
            />
          </label>
        </div>

        <div className="preset-buttons-group">
          <span className="preset-label">⏱️ ช่วงเร็วเลือก:</span>
          <div className="preset-buttons">
            {PRESET_RANGES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`range-button ${selectedPreset === option.id ? 'active' : ''}`}
                onClick={() => {
                  const range = option.getRange();
                  setStartDate(range.start);
                  setEndDate(range.end);
                  setSelectedPreset(option.id);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="range-summary notice">
          <span>📍 ช่วงวันที่:</span> <strong>{startDate}</strong> — <strong>{endDate}</strong> <span className="range-days">({dateRangeInDays} วัน)</span>
        </div>

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? (
            <>
              <span className="spinner">⚙️</span> กำลังคำนวณ...
            </>
          ) : (
            <>🔍 วิเคราะห์</>
          )}
        </button>
      </form>

      {error && (
        <div className="error-banner" role="alert">
          <span>⚠️</span> {error}
        </div>
      )}

      {Object.keys(chartData).length > 0 && displayRange.start && !loading && (
        <div className="charts-container" role="region" aria-label="กราฟเทคนิค">
          <div className="analysis-range-banner">
            📊 วิเคราะห์: <strong>{formatDisplayDate(displayRange.start)}</strong> ถึง <strong>{formatDisplayDate(displayRange.end)}</strong>
            <span className="banner-days">({displayRangeInDays} วัน)</span>
          </div>

          <div className="chart-controls">
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-start',
                alignItems: 'center',
                gap: '1rem',
              }}>
              {/* New ZoomControls Component */}
              <ZoomControls
                totalItems={chartData.price?.length || 0}
                visibleStart={zoomWindow.startIndex}
                visibleEnd={zoomWindow.endIndex}
                onZoomChange={(s, e) => setZoomWindow({ startIndex: s, endIndex: e })}
              />

              {/* Chart Engine Toggle Button */}
              <button
                type="button"
                onClick={() => setUseTradingViewChart(prev => !prev)}
                className={`range-button ${useTradingViewChart ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontWeight: 600
                }}
              >
                {useTradingViewChart ? '📊 TradingView' : '📈 Recharts'}
              </button>
            </div>

            {/* --- Visibility Toggles (Collapsible Panel) --- */}
            <div className="indicator-panel-wrapper" style={{ marginLeft: 'auto' }}>
              <button
                type="button"
                onClick={() => setShowIndicatorPanel(prev => !prev)}
                className={`panel-trigger ${showIndicatorPanel ? 'open' : ''}`}
              >
                <span style={{ transform: showIndicatorPanel ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▶</span>
                ⚙️ Indicators ({Object.values(visibleIndicators).filter(Boolean).length}/{Object.keys(visibleIndicators).length})
              </button>

              {showIndicatorPanel && (
                <div className="modern-panel">
                  <div className="panel-section">
                    <div className="section-title">📉 Trend & Overlays</div>
                    <div className="toggles-grid">
                      {['sma', 'ema', 'bb', 'goldenDeath'].map(key => {
                        const labels = {
                          sma: 'SMA (Moving Avg)',
                          ema: 'EMA (Exp Avg)',
                          bb: 'Bollinger Bands',
                          goldenDeath: 'Golden/Death Cross'
                        };
                        return (
                          <div
                            key={key}
                            className={`toggle-card ${visibleIndicators[key] ? 'active' : ''}`}
                            onClick={() => toggleIndicator(key)}
                          >
                            <span className="toggle-label">{labels[key]}</span>
                            <div className="switch" />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="panel-section">
                    <div className="section-title">🎯 Key Levels & Fib</div>
                    <div className="toggles-grid">
                      {['fib', 'weeklyHighLow', 'monthlyHighLow', 'yearlyHighLow'].map(key => {
                        const labels = {
                          fib: 'Fibonacci Levels',
                          weeklyHighLow: 'Weekly High/Low',
                          monthlyHighLow: 'Monthly High/Low',
                          yearlyHighLow: 'Yearly High/Low'
                        };
                        return (
                          <div
                            key={key}
                            className={`toggle-card ${visibleIndicators[key] ? 'active' : ''}`}
                            onClick={() => toggleIndicator(key)}
                          >
                            <span className="toggle-label">{labels[key]}</span>
                            <div className="switch" />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="panel-section">
                    <div className="section-title">📊 Oscillators & Vol</div>
                    <div className="toggles-grid">
                      {['volume', 'rsi', 'macd'].map(key => {
                        const labels = {
                          volume: 'Volume Bars',
                          rsi: 'RSI (Relative Str)',
                          macd: 'MACD Momentum'
                        };
                        return (
                          <div
                            key={key}
                            className={`toggle-card ${visibleIndicators[key] ? 'active' : ''}`}
                            onClick={() => toggleIndicator(key)}
                          >
                            <span className="toggle-label">{labels[key]}</span>
                            <div className="switch" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', marginTop: '20px' }}>

            {/* Main Chart Column */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

              <div
                ref={chartContainerRef}
                className="interactive-chart-area"
                // === Event Handlers สำหรับ Zoom/Pan ===
                // Disable mouse events when using TradingView (it has built-in pan/zoom)
                onMouseDown={useTradingViewChart ? undefined : handleMouseDown}
                onMouseMove={useTradingViewChart ? undefined : handleMouseMove}
                onMouseUp={useTradingViewChart ? undefined : handleMouseUp}
                onMouseLeave={useTradingViewChart ? undefined : handleMouseUp}
                style={{
                  width: '100%',
                  cursor: useTradingViewChart ? 'default' : (isDragging ? 'grabbing' : 'text'),
                  userSelect: 'none'
                }}
              >
                {/* Chart Type Toggle: Recharts vs TradingView */}
                {useTradingViewChart ? (
                  <LightweightPriceChart
                    data={chartData.price}  // ส่ง full data - Lightweight Charts จัดการ pan/zoom เอง
                    height={priceHeight}
                    visible={visibleIndicators}
                    fibonacci={chartData.fibonacci}
                    goldenDeathSignals={chartData.goldenDeathSignals}
                    highLowPeaks={chartData.highLowPeaks}
                  />
                ) : (
                  <PriceChart
                    data={slicedData.price}
                    height={priceHeight}
                    padPct={pricePadPct}
                    currency={currency}
                    visible={visibleIndicators}
                    fibonacci={slicedData.fibonacci}
                    signals={chartData.signals}
                    smaSignals={chartData.smaSignals}
                    goldenDeathSignals={slicedData.goldenDeathSignals}
                    goldenDeathZones={slicedData.goldenDeathZones}
                    macdStrategySignals={chartData.macdStrategySignals}
                    highLowPeaks={slicedData.highLowPeaks}
                  />
                )}

                {visibleIndicators.volume && (
                  <VolumeChart
                    data={slicedData.volume}
                    height={volumeHeight}
                  />
                )}

                {visibleIndicators.rsi && (
                  <RsiChart
                    data={slicedData.rsi}
                    divergences={slicedData.rsiDivergences}
                    smoothingLabel={RSI_SETTINGS.smoothingType}
                    height={rsiHeight}
                  />
                )}

                {visibleIndicators.macd && (
                  <MacdHistogramChart
                    data={slicedData.macd}
                    height={rsiHeight}
                  />
                )}
              </div>

              {/* ZoomControls already above, no navigator needed here */}

            </div>

            {/* Right Sidebar - Vertical Slider */}
            <div style={{ width: '40px', marginLeft: '10px', display: 'flex', flexDirection: 'column' }}>
              <VerticalScaleSlider
                scale={heightScale}
                onChange={setHeightScale}
                min={0.5}
                max={2.5}
              />
            </div>

          </div>

        </div>
      )}

      <Link to="/" className="primary-button back-button">← กลับสู่หน้าหลัก</Link>
    </div >
  );
}
