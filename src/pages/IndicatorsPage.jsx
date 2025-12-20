// src/pages/IndicatorsPage.jsx

// --- React and Library Imports ---
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine
} from 'recharts';

// --- CSS Imports ---
import '../css/App.css';
import '../css/IndicatorsPage.css';
import {
  PRESET_RANGES,
  getPresetRange,
  parseISODate,
  calculateDateRangeInDays,
  getDefaultRange,
  DEFAULT_PRESET_ID
} from '../utils/dateRanges';

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

// =================================================================
// === SECTION 1: LOGIC & CALCULATION FUNCTIONS                  ===
// =================================================================

async function fetchStockHistory(symbol, startDate, endDate) {
  // ส่งสัญลักษณ์ตามที่ผู้ใช้กรอก (ปล่อย backend ตัดสินใจ .BK)
  const ticker = symbol.trim().toUpperCase();
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const query = params.toString();
  const res = await fetch(`http://localhost:5000/api/stock/history/${ticker}${query ? `?${query}` : ''}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error fetching stock history');
  }
  const raw = await res.json();
  return raw.map(item => ({ ...item, date: new Date(item.date) }));
}

// Simple Moving Average (SMA)
const calculateSMA = (data, period) => {
  if (!Array.isArray(data) || data.length < period) return null;
  const out = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i].close;
    if (i >= period) sum -= data[i - period].close;
    if (i >= period - 1) out.push({ date: data[i].date, value: sum / period });
  }
  return out;
};

const calculateEMA = (data, period) => {
  if (data.length < period) return null;
  const ema = [];
  const k = 2 / (period + 1);
  let prev = data.slice(0, period).reduce((sum, d) => sum + d.close, 0) / period;
  ema.push({ date: data[period - 1].date, value: prev });
  for (let i = period; i < data.length; i++) {
    prev = data[i].close * k + prev * (1 - k);
    ema.push({ date: data[i].date, value: prev });
  }
  return ema;
};

const calculateRSI = (data, period = 14) => {
  if (data.length <= period) return null;
  const rsi = [];
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = data[i].close - data[i - 1].close;
    if (delta > 0) gain += delta;
    else loss -= delta;
  }
  gain /= period; loss /= period;
  for (let i = period; i < data.length; i++) {
    const delta = data[i].close - data[i - 1].close;
    const g = Math.max(delta, 0), l = Math.max(-delta, 0);
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    const rs = loss === 0 ? 100 : gain / loss;
    rsi.push({ date: data[i].date, value: 100 - 100 / (1 + rs) });
  }
  return rsi;
};

const calculateMACD = (data, fast = 12, slow = 26, sig = 9) => {
  if (data.length < slow) return null;
  const eFast = calculateEMA(data, fast);
  const eSlow = calculateEMA(data, slow);
  if (!eFast || !eSlow) return null;
  const macdLine = eSlow
    .map(slowPoint => {
      const fastPoint = eFast.find(f => f.date.getTime() === slowPoint.date.getTime());
      return fastPoint
        ? { date: slowPoint.date, value: fastPoint.value - slowPoint.value }
        : null;
    })
    .filter(Boolean);
  if (macdLine.length < sig) return null;
  const signalLine = calculateEMA(
    macdLine.map(d => ({ date: d.date, close: d.value })),
    sig
  );
  if (!signalLine) return null;
  const histogram = signalLine
    .map(sigPoint => {
      const macdPoint = macdLine.find(m => m.date.getTime() === sigPoint.date.getTime());
      return macdPoint
        ? { date: sigPoint.date, value: macdPoint.value - sigPoint.value }
        : null;
    })
    .filter(Boolean);
  return { macdLine, signalLine, histogram };
};

const calculateSqueezeMomentum = (
  data,
  bbLength = 20,
  bbMultiplier = 2,
  kcLength = 20,
  kcMultiplier = 1.5,
  useTrueRange = true
) => {
  if (!Array.isArray(data) || data.length < Math.max(bbLength, kcLength)) return [];

  const n = data.length;
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);

  if ([closes, highs, lows].some(arr => arr.some(v => !Number.isFinite(v)))) return [];

  const trueRanges = data.map((point, idx) => {
    const prevClose = idx > 0 ? closes[idx - 1] : closes[idx];
    const baseRange = Math.max(point.high - point.low, 0);
    if (!useTrueRange || idx === 0) return baseRange;
    return Math.max(
      baseRange,
      Math.abs(point.high - prevClose),
      Math.abs(point.low - prevClose)
    );
  });

  const upperBB = new Array(n).fill(null);
  const lowerBB = new Array(n).fill(null);
  const upperKC = new Array(n).fill(null);
  const lowerKC = new Array(n).fill(null);
  const baseSeries = new Array(n).fill(null);

  let sumCloseBB = 0;
  let sumCloseSqBB = 0;
  let sumCloseKC = 0;
  let sumRangeKC = 0;

  const sumX = kcLength * (kcLength - 1) / 2;
  const sumX2 = kcLength * (kcLength - 1) * (2 * kcLength - 1) / 6;
  const denom = kcLength * sumX2 - sumX * sumX || 1;

  for (let i = 0; i < n; i++) {
    const close = closes[i];
    const tr = trueRanges[i];

    sumCloseBB += close;
    sumCloseSqBB += close * close;
    if (i >= bbLength) {
      const oldClose = closes[i - bbLength];
      sumCloseBB -= oldClose;
      sumCloseSqBB -= oldClose * oldClose;
    }
    if (i >= bbLength - 1) {
      const mean = sumCloseBB / bbLength;
      const variance = Math.max(sumCloseSqBB / bbLength - mean * mean, 0);
      const std = Math.sqrt(variance);
      upperBB[i] = mean + std * bbMultiplier;
      lowerBB[i] = mean - std * bbMultiplier;
    }

    sumCloseKC += close;
    sumRangeKC += tr;
    if (i >= kcLength) {
      sumCloseKC -= closes[i - kcLength];
      sumRangeKC -= trueRanges[i - kcLength];
    }

    if (i >= kcLength - 1) {
      const ma = sumCloseKC / kcLength;
      const rangeMA = sumRangeKC / kcLength;
      upperKC[i] = ma + rangeMA * kcMultiplier;
      lowerKC[i] = ma - rangeMA * kcMultiplier;

      let highest = -Infinity;
      let lowest = Infinity;
      for (let j = i - kcLength + 1; j <= i; j++) {
        highest = Math.max(highest, highs[j]);
        lowest = Math.min(lowest, lows[j]);
      }
      const avgHL = (highest + lowest) / 2;
      const smaCloseKC = sumCloseKC / kcLength;
      const offset = (avgHL + smaCloseKC) / 2;
      baseSeries[i] = close - offset;
    }
  }

  const result = [];
  for (let i = kcLength - 1; i < n; i++) {
    if (
      baseSeries[i] == null ||
      upperKC[i] == null ||
      upperBB[i] == null ||
      lowerKC[i] == null ||
      lowerBB[i] == null
    ) {
      continue;
    }

    const window = baseSeries.slice(i - kcLength + 1, i + 1);
    if (window.length !== kcLength || window.some(v => !Number.isFinite(v))) continue;

    let sumY = 0;
    let sumXY = 0;
    for (let idx = 0; idx < kcLength; idx++) {
      const y = window[idx];
      sumY += y;
      sumXY += idx * y;
    }

    const slope = (kcLength * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / kcLength;
    const momentum = intercept + slope * (kcLength - 1);

    const squeezeOn = lowerBB[i] > lowerKC[i] && upperBB[i] < upperKC[i];
    const squeezeOff = lowerBB[i] < lowerKC[i] && upperBB[i] > upperKC[i];
    const squeezeState = squeezeOn ? 'on' : squeezeOff ? 'off' : 'neutral';

    result.push({
      date: data[i].date,
      momentum,
      squeezeState
    });
  }

  return result;
};

const calculateSD = arr => {
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
};

const calculateBollingerBands = (data, period = 20, devs = 2) => {
  if (data.length < period) return null;
  const bb = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).map(d => d.close);
    const middle = slice.reduce((s, v) => s + v, 0) / period;
    const sd = calculateSD(slice);
    bb.push({
      date: data[i].date,
      middle,
      upper: middle + sd * devs,
      lower: middle - sd * devs
    });
  }
  return bb;
};

// Generate SMA crossover signals between two SMA series
// Returns array of { dateTs: number, kind: 'bull'|'bear', pair: string }
const generateSmaCrossSignals = (smaA, smaB, pairLabel) => {
  if (!smaA || !smaB) return [];
  const mapA = new Map(smaA.map(d => [d.date.getTime(), d.value]));
  const mapB = new Map(smaB.map(d => [d.date.getTime(), d.value]));
  const dates = Array.from([...mapA.keys()].filter(t => mapB.has(t))).sort((a, b) => a - b);
  const sigs = [];
  for (let i = 1; i < dates.length; i++) {
    const p = dates[i - 1];
    const c = dates[i];
    const prevDiff = mapA.get(p) - mapB.get(p);
    const currDiff = mapA.get(c) - mapB.get(c);
    if (prevDiff <= 0 && currDiff > 0) {
      sigs.push({ dateTs: c, kind: 'bull', pair: pairLabel });
    }
    if (prevDiff >= 0 && currDiff < 0) {
      sigs.push({ dateTs: c, kind: 'bear', pair: pairLabel });
    }
  }
  return sigs;
};

const calculateFibonacciRetracement = data => {
  if (!data.length) return null;
  const prices = data.map(d => d.close);
  const high = Math.max(...prices), low = Math.min(...prices);
  const diff = high - low;
  if (!diff) return null;
  return {
    high,
    low,
    levels: [
      { level: `100% (Low ${low.toFixed(2)})`, value: low },
      { level: '61.8%', value: high - 0.618 * diff },
      { level: '50%',   value: high - 0.5   * diff },
      { level: '38.2%', value: high - 0.382 * diff },
      { level: '23.6%', value: high - 0.236 * diff },
      { level: `0% (High ${high.toFixed(2)})`, value: high }
    ]
  };
};

const generateMacdSignals = macd => {
  if (
    !macd ||
    !Array.isArray(macd.macdLine) ||
    !Array.isArray(macd.signalLine) ||
    !Array.isArray(macd.histogram)
  ) {
    return [];
  }
  const mapM = new Map(macd.macdLine.map(d => [d.date.getTime(), d.value]));
  const mapS = new Map(macd.signalLine.map(d => [d.date.getTime(), d.value]));
  const mapH = new Map(macd.histogram.map(d => [d.date.getTime(), d.value]));
  const allDates = Array.from(new Set([
    ...mapM.keys(),
    ...mapS.keys(),
    ...mapH.keys()
  ])).sort((a, b) => a - b);
  const sigs = [];
  for (let i = 1; i < allDates.length; i++) {
    const prevT = allDates[i - 1], currT = allDates[i];
    const prevM = mapM.get(prevT), currM = mapM.get(currT);
    const prevS = mapS.get(prevT), currS = mapS.get(currT);
    const prevH = mapH.get(prevT), currH = mapH.get(currT);
    // MACD ↔ Signal cross
    if (prevM != null && currM != null && prevS != null && currS != null) {
      const prevDiff = prevM - prevS;
      const currDiff = currM - currS;
      if (prevDiff <= 0 && currDiff > 0) sigs.push({ date: new Date(currT), type:'buy',  signalType:'macdCross', y: currM });
      if (prevDiff >= 0 && currDiff < 0) sigs.push({ date: new Date(currT), type:'sell', signalType:'macdCross', y: currM });
    }
    // Histogram ↔ zero cross
    if (prevH != null && currH != null) {
      if (prevH <= 0 && currH > 0) sigs.push({ date: new Date(currT), type:'buy',  signalType:'histCross', y: 0 });
      if (prevH >= 0 && currH < 0) sigs.push({ date: new Date(currT), type:'sell', signalType:'histCross', y: 0 });
    }
    // MACD line ↔ zero-axis cross
    if (prevM != null && currM != null) {
      if (prevM <= 0 && currM > 0) sigs.push({ date: new Date(currT), type:'buy',  signalType:'zeroLine', y: 0 });
      if (prevM >= 0 && currM < 0) sigs.push({ date: new Date(currT), type:'sell', signalType:'zeroLine', y: 0 });
    }
  }
  return sigs.sort((a, b) => a.date - b.date);
};

function getVolumeForDate(priceMap, timestamp) {
  const pricePoint = priceMap.get(timestamp);
  return pricePoint?.volume ?? 0;
}

const calculateRsiSmoothingSeries = (
  rsiData,
  priceData,
  {
    type = RSI_SETTINGS.smoothingType,
    period = RSI_SETTINGS.smoothingLength,
    bbMultiplier = RSI_SETTINGS.bbMultiplier
  } = {}
) => {
  if (!rsiData || !rsiData.length || type === 'None') return [];
  if (!Number.isFinite(period) || period <= 0) return [];

  const values = rsiData.map(d => d.value ?? 0);
  const dates = rsiData.map(d => d.date);
  const volumeMap = new Map(priceData.map(d => [d.date.getTime(), d]));
  const result = rsiData.map(d => ({ date: d.date, middle: null, upper: null, lower: null }));

  const ensureWindow = index => index >= period - 1;
  const computeWindowValues = index => {
    const start = index - period + 1;
    return values.slice(start, index + 1);
  };

  if (type === 'SMA' || type === 'SMA + Bollinger Bands') {
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i];
      if (i >= period) sum -= values[i - period];
      if (!ensureWindow(i)) continue;
      const mean = sum / period;
      result[i].middle = mean;
      if (type === 'SMA + Bollinger Bands') {
        const windowVals = computeWindowValues(i);
        const sd = calculateSD(windowVals);
        result[i].upper = mean + sd * bbMultiplier;
        result[i].lower = mean - sd * bbMultiplier;
      }
    }
    return result;
  }

  if (type === 'EMA') {
    if (values.length < period) return result;
    let ema = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
    const k = 2 / (period + 1);
    for (let i = period - 1; i < values.length; i++) {
      ema = i === period - 1 ? ema : values[i] * k + ema * (1 - k);
      result[i].middle = ema;
    }
    return result;
  }

  if (type === 'SMMA (RMA)') {
    if (values.length < period) return result;
    let prev = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
    result[period - 1].middle = prev;
    for (let i = period; i < values.length; i++) {
      prev = (prev * (period - 1) + values[i]) / period;
      result[i].middle = prev;
    }
    return result;
  }

  if (type === 'WMA') {
    const denominator = period * (period + 1) / 2;
    for (let i = period - 1; i < values.length; i++) {
      let numerator = 0;
      for (let w = 0; w < period; w++) {
        numerator += values[i - w] * (period - w);
      }
      result[i].middle = numerator / denominator;
    }
    return result;
  }

  if (type === 'VWMA') {
    for (let i = period - 1; i < values.length; i++) {
      let weightedSum = 0;
      let volumeSum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        const ts = dates[j].getTime();
        const vol = getVolumeForDate(volumeMap, ts);
        weightedSum += values[j] * vol;
        volumeSum += vol;
      }
      if (volumeSum > 0) {
        result[i].middle = weightedSum / volumeSum;
      }
    }
    return result;
  }

  return result;
};
const generateRsiSignals = (rsiData, smoothingSeries) => {
  if (!rsiData || !rsiData.length || !smoothingSeries || !smoothingSeries.length) return [];
  const middleMap = new Map(
    smoothingSeries
      .filter(entry => entry.middle != null)
      .map(entry => [entry.date.getTime(), entry.middle])
  );
  if (!middleMap.size) return [];

  const sigs = [];
  for (let i = 1; i < rsiData.length; i++) {
    const prevTs = rsiData[i - 1].date.getTime();
    const currTs = rsiData[i].date.getTime();
    const prevMiddle = middleMap.get(prevTs);
    const currMiddle = middleMap.get(currTs);
    if (prevMiddle == null || currMiddle == null) continue;
    const prevValue = rsiData[i - 1].value;
    const currValue = rsiData[i].value;
    if (prevValue <= prevMiddle && currValue > currMiddle) {
      sigs.push({ date: currTs, type: 'bullish' });
    } else if (prevValue >= prevMiddle && currValue < currMiddle) {
      sigs.push({ date: currTs, type: 'bearish' });
    }
  }

  return sigs.map(s => ({
    date: new Date(s.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
    type: s.type
  }));
};

const detectRsiDivergences = (
  priceData,
  rsiData,
  {
    enabled = true,
    lookbackLeft = 5,
    lookbackRight = 5,
    rangeUpper = 60,
    rangeLower = 5
  } = {}
) => {
  if (!enabled || !priceData || !priceData.length || !rsiData || !rsiData.length) return [];
  if (rsiData.length <= lookbackLeft + lookbackRight) return [];

  const priceMap = new Map(priceData.map(p => [p.date.getTime(), p]));
  const pivotLows = [];
  const pivotHighs = [];

  const isPivotLow = index => {
    const base = rsiData[index].value;
    for (let l = 1; l <= lookbackLeft; l++) {
      if (rsiData[index - l].value <= base) return false;
    }
    for (let r = 1; r <= lookbackRight; r++) {
      if (rsiData[index + r].value <= base) return false;
    }
    return true;
  };

  const isPivotHigh = index => {
    const base = rsiData[index].value;
    for (let l = 1; l <= lookbackLeft; l++) {
      if (rsiData[index - l].value >= base) return false;
    }
    for (let r = 1; r <= lookbackRight; r++) {
      if (rsiData[index + r].value >= base) return false;
    }
    return true;
  };

  for (let i = lookbackLeft; i < rsiData.length - lookbackRight; i++) {
    if (isPivotLow(i)) pivotLows.push(i);
    if (isPivotHigh(i)) pivotHighs.push(i);
  }

  const bullSignals = [];
  for (let i = 1; i < pivotLows.length; i++) {
    const prevIdx = pivotLows[i - 1];
    const currIdx = pivotLows[i];
    const bars = currIdx - prevIdx;
    if (bars < rangeLower || bars > rangeUpper) continue;
    const prevPrice = priceMap.get(rsiData[prevIdx].date.getTime());
    const currPrice = priceMap.get(rsiData[currIdx].date.getTime());
    if (!prevPrice || !currPrice) continue;
    const prevLow = prevPrice.low ?? prevPrice.close;
    const currLow = currPrice.low ?? currPrice.close;
    const prevRsi = rsiData[prevIdx].value;
    const currRsi = rsiData[currIdx].value;
    if (currRsi > prevRsi && currLow < prevLow) {
      bullSignals.push({
        date: rsiData[currIdx].date,
        value: currRsi,
        type: 'bull'
      });
    }
  }

  const bearSignals = [];
  for (let i = 1; i < pivotHighs.length; i++) {
    const prevIdx = pivotHighs[i - 1];
    const currIdx = pivotHighs[i];
    const bars = currIdx - prevIdx;
    if (bars < rangeLower || bars > rangeUpper) continue;
    const prevPrice = priceMap.get(rsiData[prevIdx].date.getTime());
    const currPrice = priceMap.get(rsiData[currIdx].date.getTime());
    if (!prevPrice || !currPrice) continue;
    const prevHigh = prevPrice.high ?? prevPrice.close;
    const currHigh = currPrice.high ?? currPrice.close;
    const prevRsi = rsiData[prevIdx].value;
    const currRsi = rsiData[currIdx].value;
    if (currRsi < prevRsi && currHigh > prevHigh) {
      bearSignals.push({
        date: rsiData[currIdx].date,
        value: currRsi,
        type: 'bear'
      });
    }
  }

  return [...bullSignals, ...bearSignals].sort((a, b) => a.date - b.date);
};

// =================================================================
// === SECTION 2: UI HELPER COMPONENTS                           ===
// =================================================================

const chartMargin = { top: 5, right: 30, left: 0, bottom: 20 };
const commonXAxis = (
  <XAxis
    dataKey="date"
    tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
    angle={-20}
    textAnchor="end"
    height={50}
  />
);
// --- common tooltip helper: accept currency ---
const commonTooltip = (currency) => (
  <Tooltip
    contentStyle={{
      background: 'var(--color-bg-secondary)',
      color: 'var(--color-text)',
      borderRadius: '8px',
      border: '1px solid var(--color-border)'
    }}
    labelStyle={{ color: 'var(--color-accent)', fontWeight: 'bold' }}
    // formatter: (value, name, props) -> [formattedValueWithOptionalCurrency, seriesName]
    formatter={(value, name, props) => {
      const seriesName = name || '';
      const isNumber = typeof value === 'number' && Number.isFinite(value);
      const lower = seriesName.toLowerCase();
      // Exclude indicator series that contain these keywords
      const excludeKeywords = ['sma', 'ema', 'rsi', 'macd', 'histogram', 'volume', 'bb', 'bollinger', 'smoothing', 'signal'];
      const isExcluded = excludeKeywords.some(k => lower.includes(k));
      // Positive match for plain price series
      const isPlainPrice = /(^|\W)(price|close|open|high|low|ราคาปิด|ราคา)(\W|$)/i.test(seriesName);
      const isPriceSeries = !isExcluded && isPlainPrice;
      const curLabel = currency === 'THB' ? 'บาท' : (currency || 'USD');
      let formattedValue;
      if (isNumber) {
        if (isPriceSeries) formattedValue = `${value.toFixed(2)} ${curLabel}`;
        else formattedValue = value.toFixed(2);
      } else {
        formattedValue = value ?? '-';
      }
      return [formattedValue, seriesName];
    }}
  />
);

const commonTooltipOld = (
  <Tooltip
    contentStyle={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px'
    }}
    labelStyle={{ color: 'var(--color-accent)', fontWeight: 'bold' }}
  />
);

// Dynamic tick formatter for price magnitude
const formatPriceTick = (v) => {
  if (v == null || Number.isNaN(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 100) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(4);
};

// Compute padded Y domain from values
function getPaddedDomain(values, padPct = 0.06, minPad = 0.01) {
  const nums = values.filter((x) => typeof x === 'number' && Number.isFinite(x));
  if (!nums.length) return ['auto', 'auto'];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return ['auto', 'auto'];
  const range = Math.max(0, max - min);
  const levelPad = Math.max(min, max) * 0.01;
  const pad = Math.max(range * padPct, levelPad, minPad);
  return [Math.max(0, min - pad), max + pad];
}

// Price Chart
const PriceChart = React.memo(({
  data,
  signals,
  smaSignals = [],
  goldenDeathSignals = [],
  macdStrategySignals = [],
  fibonacci,
  syncId,
  height,
  padPct,
  wrapperClassName = '',
  currency
}) => {
  const obos = useMemo(() => (data || [])
    .filter(d => d.bbUpper != null && (d.close > d.bbUpper || d.close < d.bbLower))
    .map(d => ({
      date: d.date,
      type: d.close > d.bbUpper ? 'overbought' : 'oversold',
      value: d.close
    })), [data]);

  const wrapperClasses = useMemo(() => ['chart-wrapper', wrapperClassName].filter(Boolean).join(' '), [wrapperClassName]);
  const domainValues = useMemo(() => (data || []).flatMap(d => [d.close, d.bbUpper, d.bbLower, d.sma10, d.sma50, d.sma100, d.sma200]).filter(v => typeof v === 'number'), [data]);
  const [yMin, yMax] = useMemo(() => getPaddedDomain(domainValues, padPct ?? 0.06), [domainValues, padPct]);

  return (
    <div className={wrapperClasses}>
      <h3>ราคาปิด, Bollinger Bands & Fibonacci</h3>
      <ResponsiveContainer width="100%" height={height || 380}>
        <ComposedChart data={data} margin={chartMargin} syncId={syncId}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          {commonXAxis}
          <YAxis
            yAxisId="left"
            tick={{ fill: '#00ff08ff', fontSize: 12 }}
            domain={[yMin, yMax]}
            allowDecimals
            tickFormatter={formatPriceTick}
            orientation="right"
          />
          {commonTooltip(currency)}
          <Legend />

          <Line yAxisId="left" dataKey="bbUpper" name="Upper BB" stroke="#1976d2" strokeDasharray="4 2" dot={false} />
          <Line yAxisId="left" dataKey="bbMiddle" name="Middle BB (SMA20)" stroke="#ffd600" strokeWidth={2} dot={false} />
          <Line yAxisId="left" dataKey="bbLower" name="Lower BB" stroke="#1976d2" strokeDasharray="4 2" dot={false} />
          <Line yAxisId="left" dataKey="sma10" name="SMA 10" stroke="#ff0000ff" strokeWidth={2} dot={false} />
          <Line yAxisId="left" dataKey="sma50" name="SMA 50" stroke="#c800ffff" strokeWidth={2} dot={false} />
          <Line yAxisId="left" dataKey="sma100" name="SMA 100" stroke="#00e1ffff" strokeWidth={2} dot={false} />
          <Line yAxisId="left" dataKey="sma200" name="SMA 200" stroke="#00ff0dff" strokeWidth={2} dot={false} />
          <Line yAxisId="left" dataKey="close" name="ราคาปิด" stroke="#1976d2" strokeWidth={2.5} dot={false} />

          {Number.isFinite(data?.[data.length - 1]?.close) && (
            <ReferenceLine
              yAxisId="left"
              y={data[data.length - 1].close}
              stroke="#ffffffff"
              strokeDasharray="3 3"
              label={{ value: `Last ${formatPriceTick(data[data.length - 1].close)}`, position: 'right', fill: '#ffffffff', fontSize: 10 }}
            />
          )}

          {(fibonacci?.levels || []).map(l => (
            <ReferenceLine
              key={l.level}
              yAxisId="left"
              y={l.value}
              stroke="#ffd000ff"
              strokeDasharray="4 4"
              label={{ value: l.level, position: 'right', fontSize: 10, fill: '#ffd000ff' }}
            />
          ))}
          {fibonacci && (
            <>
              <ReferenceLine yAxisId="left" y={fibonacci.high} stroke="#ff0400ff" strokeWidth={2}
                label={{ value: 'Resistance', position: 'right', fill: '#ff040004', fontSize: 12 }} />
              <ReferenceLine yAxisId="left" y={fibonacci.low} stroke="#00ff0dff" strokeWidth={2}
                label={{ value: 'Support', position: 'right', fill: '#00ff0d09', fontSize: 12 }} />
            </>
          )}

          {goldenDeathSignals.map((s, i) => {
            const hasPoint = data?.some(d => d.date === s.date);
            if (!hasPoint) return null;
            return (
              <ReferenceLine
                key={`gd-${i}-${s.date}`}
                x={s.date}
                stroke={s.type === 'golden' ? '#ffd700' : '#b0bec5'}
                strokeWidth={2}
                strokeDasharray="6 4"
                label={{ value: s.label, position: 'top', fill: s.type === 'golden' ? '#ffb300' : '#78909c', fontSize: 10 }}
              />
            );
          })}

          {signals.map(s => {
            const pt = data?.find(d => d.date === s.date);
            if (!pt) return null;
            return (
              <ReferenceDot
                key={s.date + s.type}
                yAxisId="left"
                x={s.date}
                y={pt.close}
                r={7}
                fill={s.type === 'buy' ? '#43a047' : '#e53935'}
                stroke="#fff"
                label={{ value: s.type === 'buy' ? 'B' : 'S', fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }}
              />
            );
          })}

          {smaSignals.map((s, i) => {
            const pt = data?.find(d => d.date === s.date);
            if (!pt) return null;
            const isGoldenPair = s.pair === '50/200';
            const fill = isGoldenPair
              ? (s.kind === 'bull' ? '#ffd700' : '#b0bec5')
              : (s.kind === 'bull' ? '#43a047' : '#e53935');
            const lbl = isGoldenPair
              ? (s.kind === 'bull' ? 'Golden' : 'Death')
              : `${s.pair} ${s.kind === 'bull' ? '+' : '−'}`;
            const radius = isGoldenPair ? 8 : 6;
            return (
              <ReferenceDot
                key={`sma-${i}-${s.date}-${s.pair}`}
                yAxisId="left"
                x={s.date}
                y={pt.close}
                r={radius}
                fill={fill}
                stroke="#fff"
                label={{ value: lbl, fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }}
              />
            );
          })}

          {macdStrategySignals.map((s, i) => {
            const pt = data?.find(d => d.date === s.date);
            if (!pt) return null;
            const fill = s.type === 'buy' ? '#00c853' : '#ff3d00';
            const label = s.type === 'buy' ? 'MACD Buy' : 'MACD Sell';
            return (
              <ReferenceDot
                key={`macd-strat-${i}-${s.date}`}
                yAxisId="left"
                x={s.date}
                y={pt.close}
                r={9}
                fill={fill}
                stroke="#fff"
                label={{ value: label, fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }}
              />
            );
          })}

          {obos.map(o => (
            <ReferenceDot
              key={o.date + o.type}
              yAxisId="left"
              x={o.date}
              y={o.value}
              r={6}
              fill={o.type === 'overbought' ? '#e53935' : '#43a047'}
              stroke="#fff"
              label={{ value: o.type === 'overbought' ? 'OB' : 'OS', fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});

// Volume Chart
const VolumeChart = React.memo(({ data, syncId, height, wrapperClassName = '', currency = '' }) => {
   const wrapperClasses = useMemo(() => ['chart-wrapper', wrapperClassName].filter(Boolean).join(' '), [wrapperClassName]);

   const cells = useMemo(() => (data || []).map((e, i) => (
     <Cell key={i} fill={e.isUp ? 'var(--color-success)' : '#d32f2f'} />
   )), [data]);

   return (
     <div className={wrapperClasses}>
       <h3>Volume</h3>
       <ResponsiveContainer width="100%" height={height || 260}>
         <ComposedChart data={data} margin={chartMargin} syncId={syncId}>
           <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
           {commonXAxis}
           <YAxis
             tick={{ fill: '#8bc34a', fontSize: 12 }}
             domain={[0, (max) => Math.ceil(max * 1.15)]}
             tickFormatter={v => v.toLocaleString()}
           />
          {commonTooltip(currency)}
           <Bar dataKey="volume" name="Volume" fillOpacity={0.9}>
             {cells}
           </Bar>
         </ComposedChart>
       </ResponsiveContainer>
     </div>
   );
});

// RSI Chart
const RsiChart = React.memo(({
  data,
  signals = [],
  divergences = [],
  smoothingLabel,
  syncId,
  height,
  wrapperClassName = '',
  currency = ''
}) => {
   const hasSmoothing = useMemo(() => Array.isArray(data) && data.some(d => Number.isFinite(d.smoothing)), [data]);
   const hasBands = useMemo(() => Array.isArray(data) && data.some(d => Number.isFinite(d.smoothingUpper) && Number.isFinite(d.smoothingLower)), [data]);
   const smoothingName = smoothingLabel ? `RSI ${smoothingLabel}` : 'RSI MA';
   const wrapperClasses = useMemo(() => ['chart-wrapper', wrapperClassName].filter(Boolean).join(' '), [wrapperClassName]);

   return (
     <div className={wrapperClasses}>
      <h3>RSI พร้อมเส้นค่าเฉลี่ย, Bollinger Bands และ Divergence</h3>
      <ResponsiveContainer width="100%" minWidth={280} height={height || 300}>
        <ComposedChart data={data} margin={chartMargin} syncId={syncId}>
          <defs>
            <linearGradient id="rsiMidFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#42a5f5" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#42a5f5" stopOpacity={0.10} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          {commonXAxis}
          <YAxis yAxisId="left" domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
          {commonTooltip(currency)}

          {hasBands && (
            <>
              <Line yAxisId="left" dataKey="smoothingUpper" name="RSI Upper Band" stroke="#26a69a" strokeDasharray="4 2" dot={false} />
              <Line yAxisId="left" dataKey="smoothingLower" name="RSI Lower Band" stroke="#26a69a" strokeDasharray="4 2" dot={false} />
            </>
          )}

          {hasSmoothing && (
            <Line yAxisId="left" dataKey="smoothing" name={smoothingName} stroke="#ffd54f" strokeWidth={1.8} dot={false} />
          )}

          <Line yAxisId="left" dataKey="value" name="RSI" stroke="#7e57c2" strokeWidth={2} dot={false} />

          <ReferenceArea yAxisId="left" y1={30} y2={70} fill="url(#rsiMidFill)" />
          <ReferenceArea
            yAxisId="left"
            y1={70}
            y2={100}
            fill="#26ff00ff"
            fillOpacity={0.12}
            label={{ value: 'Overbought', position: 'insideTopRight', fill: '#26ff00ff' }}
          />
          <ReferenceArea
            yAxisId="left"
            y1={0}
            y2={30}
            fill="#ff0000ff"
            fillOpacity={0.12}
            label={{ value: 'Oversold', position: 'insideBottomRight', fill: '#ff0000ff' }}
          />

          {signals.map((s, i) => {
            const pt = data.find(d => d.date === s.date);
            if (!pt) return null;
            return (
              <ReferenceDot
                key={`rsi-signal-${i}`}
                yAxisId="left"
                x={s.date}
                y={pt.value}
                r={6}
                fill={s.type === 'bullish' ? '#43a047' : '#e53935'}
                stroke="#fff"
                label={{ value: s.type === 'bullish' ? 'BULL' : 'BEAR', fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }}
              />
            );
          })}

          {divergences.map((s, i) => {
            const pt = data.find(d => d.date === s.date);
            const y = s.value ?? pt?.value;
            if (!pt || !Number.isFinite(y)) return null;
            const fill = s.type === 'bull' ? '#66bb6a' : '#ef5350';
            const label = s.type === 'bull' ? 'Bull Div' : 'Bear Div';
            return (
              <ReferenceDot
                key={`rsi-div-${i}`}
                yAxisId="left"
                x={s.date}
                y={y}
                r={7}
                fill={fill}
                stroke="#fff"
                label={{ value: label, fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});

// MACD Histogram Chart
const MacdHistogramChart = React.memo(({ data, syncId, height, wrapperClassName = '', currency = '' }) => {
   const chartRows = Array.isArray(data) ? data : [];
   const values = useMemo(() => chartRows.map(d => d.histogram).filter(v => Number.isFinite(v)), [chartRows]);
   const absMax = values.length ? Math.max(...values.map(v => Math.abs(v))) : 1;
   const pad = useMemo(() => Math.max(absMax * 1.15, 0.5), [absMax]);
   const wrapperClasses = useMemo(() => ['chart-wrapper', wrapperClassName].join(' '), [wrapperClassName]);

   const barCells = useMemo(() => chartRows.map((row, idx) => {
     const val = row.histogram ?? 0;
     const prev = chartRows[idx - 1]?.histogram ?? val;
     const rising = val >= prev;
     const fill =
       val >= 0
         ? (rising ? '#18f26a' : '#0e9f47')
         : (rising ? '#ff2f45' : '#b71c1c');
     return <Cell key={`macd-bar-${idx}`} fill={fill} />;
   }), [chartRows]);

  return (
    <div className={wrapperClasses}>
      <h3>MACD Histogram</h3>
      <ResponsiveContainer width="100%" minWidth={280} height={height || 320}>
        <ComposedChart data={chartRows} margin={chartMargin} syncId={syncId}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          {commonXAxis}
          <YAxis
            yAxisId="left"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            tickFormatter={v => (Number.isFinite(v) ? v.toFixed(2) : '')}
            width={44}
            domain={[-pad, pad]}
          />
          {commonTooltip(currency)}
          <ReferenceLine yAxisId="left" y={0} stroke="var(--color-border)" strokeWidth={1.2} />
          <Bar yAxisId="left" dataKey="histogram" name="MACD Histogram" barSize={8}>
            {barCells}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});

// =================================================================
// === SECTION 3: MAIN PAGE COMPONENT                            ===
// =================================================================

export default function IndicatorsPage() {
  const [inputSymbol, setInputSymbol] = useState('');
  const [currency, setCurrency] = useState(''); // <-- new: currency from backend
  const initialRangeConfig = (() => {
    const sixMonth = getPresetRange('6m');
    if (sixMonth) return { range: sixMonth, presetId: '6m' };
    const threeMonth = getPresetRange('3m');
    if (threeMonth) return { range: threeMonth, presetId: '3m' };
    const fallback = getDefaultRange();
    if (fallback) return { range: fallback, presetId: DEFAULT_PRESET_ID };
    return { range: { start: '', end: '' }, presetId: null };
  })();
  const [startDate, setStartDate] = useState(initialRangeConfig.range.start);
  const [endDate, setEndDate] = useState(initialRangeConfig.range.end);
  const [selectedPreset, setSelectedPreset] = useState(initialRangeConfig.presetId);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [displayRange, setDisplayRange] = useState({ start: '', end: '' });

  const dateRangeInDays = calculateDateRangeInDays(startDate, endDate);
  const displayRangeInDays = calculateDateRangeInDays(displayRange.start, displayRange.end);

  const formatDisplayDate = (isoDate) => {
    if (!isoDate) return '-';
    const parsed = parseISODate(isoDate);
    if (!parsed) return '-';
    return parsed.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Dynamic heights by viewport
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  // User-adjustable scales
  const [heightScale, setHeightScale] = useState(1.0);
  const [pricePadPct, setPricePadPct] = useState(0.06); // vertical zoom: lower = zoom in
  const basePriceHeight = 540;
  const priceHeight = clamp(basePriceHeight * heightScale, 360, 860);
  const volumeHeight = clamp(priceHeight * 0.32, 140, 340);
  const rsiHeight = clamp(priceHeight * 0.40, 210, 420);
  const squeezeHeight = clamp(priceHeight * 0.38, 200, 400);

  const abortRef = useRef(null);

  const handleSubmit = useCallback(async e => {
    if (e && e.preventDefault) e.preventDefault();
    /*...validation...*/
    setLoading(true);
    setError('');

    // abort previous request if any
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch (error) { /* ignore */ }
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const ticker = inputSymbol.trim().toUpperCase();

      // --- New: fetch quote to detect currency from backend first ---
      try {
        const qRes = await fetch(`http://localhost:5000/api/stock/${ticker}`);
        if (qRes.ok) {
          const q = await qRes.json();
          setCurrency(q.currency || '');
        } else {
          setCurrency('');
        }
      } catch (e) {
        setCurrency('');
      }

      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const query = params.toString();

      const res = await fetch(`http://localhost:5000/api/stock/history/${ticker}${query ? `?${query}` : ''}`, { signal: controller.signal });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error fetching stock history');
      }
      const raw = await res.json();
      const normalized = raw.map(item => ({ ...item, date: new Date(item.date) }));
      const sorted = normalized.sort((a, b) => a.date - b.date);
      if (sorted.length < 35) throw new Error('ข้อมูลย้อนหลัวยังไม่ถึง 35 วัน');

      // The rest of heavy computations are unchanged from previous implementation
      // we keep identical calls to calculation helpers to preserve output
      const rsi       = calculateRSI(sorted, RSI_SETTINGS.length);
      const macd      = calculateMACD(sorted, 12, 26, 9);
      const bbands    = calculateBollingerBands(sorted, 20, 2);
      const fib       = calculateFibonacciRetracement(sorted);
      const macdSigs  = generateMacdSignals(macd);
      const rsiSmooth = calculateRsiSmoothingSeries(rsi, sorted, {
        type: RSI_SETTINGS.smoothingType,
        period: RSI_SETTINGS.smoothingLength,
        bbMultiplier: RSI_SETTINGS.bbMultiplier
      });
      const rsiSigs   = generateRsiSignals(rsi, rsiSmooth);
      const rsiDivs   = detectRsiDivergences(sorted, rsi, RSI_SETTINGS.divergence);

      const sma10     = calculateSMA(sorted, 10);
      const sma50     = calculateSMA(sorted, 50);
      const sma100    = calculateSMA(sorted, 100);
      const sma200    = calculateSMA(sorted, 200);
      const smaFast   = calculateSMA(sorted, 12);
      const smaSlow   = calculateSMA(sorted, 26);

      const localeOpts = { day: '2-digit', month: 'short', year: 'numeric' };
      const dateStrMap = new Map(sorted.map(d => [d.date.getTime(), d.date.toLocaleDateString('th-TH', localeOpts)]));

      const mapPb   = new Map((bbands || []).map(d => [d.date.getTime(), d]));
      const mapM    = new Map((macd?.macdLine || []).map(d => [d.date.getTime(), d.value]));
      const mapS    = new Map((macd?.signalLine || []).map(d => [d.date.getTime(), d.value]));
      const mapS10  = new Map((sma10  || []).map(d => [d.date.getTime(), d.value]));
      const mapS50  = new Map((sma50  || []).map(d => [d.date.getTime(), d.value]));
      const mapS100 = new Map((sma100 || []).map(d => [d.date.getTime(), d.value]));
      const mapS200 = new Map((sma200 || []).map(d => [d.date.getTime(), d.value]));
      const mapSFast = new Map((smaFast || []).map(d => [d.date.getTime(), d.value]));
      const mapSSlow = new Map((smaSlow || []).map(d => [d.date.getTime(), d.value]));
      const mapHist = new Map((macd?.histogram || []).map(d => [d.date.getTime(), d.value]));
      const rsiSmoothMap = new Map((rsiSmooth || []).map(d => [d.date.getTime(), d]));

      const priceData = sorted.map(d => {
        const t = d.date.getTime();
        const pb = mapPb.get(t) || {};
        const ds = dateStrMap.get(t);
        return {
          date: ds,
          close: d.close,
          bbUpper: pb.upper,
          bbMiddle: pb.middle,
          bbLower: pb.lower,
          sma10: mapS10.get(t),
          sma50: mapS50.get(t),
          sma100: mapS100.get(t),
          sma200: mapS200.get(t)
        };
      });

      const volumeData = sorted.map((d, i) => {
        const ds = dateStrMap.get(d.date.getTime());
        return {
          date: ds,
          volume: d.volume,
          isUp: i === 0 ? true : d.close >= sorted[i - 1].close
        };
      });

      const rsiData = (rsi || []).map(d => {
        const t = d.date.getTime();
        const rs = rsiSmoothMap.get(t) || {};
        const ds = dateStrMap.get(t);
        return {
          date: ds,
          value: d.value,
          smoothing: rs.middle,
          smoothingUpper: rs.upper,
          smoothingLower: rs.lower
        };
      });

      const macdData = (macd?.histogram || [])
        .map(h => {
          const t = h.date.getTime();
          const ds = dateStrMap.get(t);
          return {
            date: ds,
            histogram: Number.isFinite(h.value) ? h.value : 0,
            macdLine: mapM.get(t),
            signalLine: mapS.get(t)
          };
        });

      const squeezeRaw = calculateSqueezeMomentum(sorted);
      const squeezeData = squeezeRaw.map(entry => ({
        date: dateStrMap.get(entry.date.getTime()),
        momentum: entry.momentum,
        squeezeState: entry.squeezeState
      }));

      const macdSmaStrategy = [];
      for (let i = 1; i < sorted.length; i++) {
        const curr = sorted[i];
        const prev = sorted[i - 1];
        const ts = curr.date.getTime();
        const prevTs = prev.date.getTime();
        const histPrev = mapHist.get(prevTs);
        const histCurr = mapHist.get(ts);
        const macdVal = mapM.get(ts);
        const fastVal = mapSFast.get(ts);
        const slowVal = mapSSlow.get(ts);
        const verySlowVal = mapS200.get(ts);
        if (
          histPrev == null ||
          histCurr == null ||
          macdVal == null ||
          fastVal == null ||
          slowVal == null ||
          verySlowVal == null
        ) {
          continue;
        }
        const slowIndex = i - 26;
        const slowAgoClose = slowIndex >= 0 ? sorted[slowIndex].close : null;
        if (slowAgoClose == null) continue;

        const histCrossUp = histPrev <= 0 && histCurr > 0;
        const histCrossDown = histPrev >= 0 && histCurr < 0;

        if (histCrossUp && macdVal > 0 && fastVal > slowVal && slowAgoClose > verySlowVal) {
          macdSmaStrategy.push({
            date: dateStrMap.get(ts),
            type: 'buy',
            price: curr.close
          });
        } else if (histCrossDown && macdVal < 0 && fastVal < slowVal && slowAgoClose < verySlowVal) {
          macdSmaStrategy.push({
            date: dateStrMap.get(ts),
            type: 'sell',
            price: curr.close
          });
        }
      }

      const smaCrossRaw = [
        ...generateSmaCrossSignals(sma10, sma50, '10/50'),
        ...generateSmaCrossSignals(sma50, sma100, '50/100'),
        ...generateSmaCrossSignals(sma100, sma200, '100/200'),
        ...generateSmaCrossSignals(sma10, sma200, '10/200'),
        ...generateSmaCrossSignals(sma50, sma200, '50/200'),
      ];

      const seen = new Set();
      const smaSignals = smaCrossRaw
        .map(s => {
          const date = dateStrMap.get(s.dateTs);
          if (!date) return null;
          const key = `${s.pair}-${date}-${s.kind}`;
          if (seen.has(key)) return null;
          seen.add(key);
          return {
            date,
            pair: s.pair,
            kind: s.kind,
          };
        })
        .filter(Boolean);

      const goldenDeathSignals = smaSignals
        .filter(s => s.pair === '50/200')
        .map(s => ({
          date: s.date,
          type: s.kind === 'bull' ? 'golden' : 'death',
          label: s.kind === 'bull' ? 'Golden Cross' : 'Death Cross'
        }));

      setChartData({
        price: priceData,
        volume: volumeData,
        rsi: rsiData,
        macd: macdData,
        squeeze: squeezeData,
        macdSignals: macdSigs,
        fibonacci: fib,
        rsiSignals: rsiSigs,
        rsiDivergences: rsiDivs.map(sig => {
          const formatted = dateStrMap.get(sig.date.getTime())
            ?? sig.date.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
          return {
            date: formatted,
            type: sig.type,
            value: sig.value
          };
        }),
        smaSignals,
        goldenDeathSignals,
        macdSmaStrategy,
      });
      setDisplayRange({ start: startDate, end: endDate });
    } catch (err) {
      if (err.name === 'AbortError') {
        // fetch was aborted; do not set global error
      } else {
        setError(err.message);
        setChartData(null);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [inputSymbol, startDate, endDate, dateRangeInDays]);

  useEffect(() => {
    if (inputSymbol) {
      handleSubmit({ preventDefault: () => {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page-container">
      <h1>Technical Indicators Dashboard</h1>
      <p>กรอกชื่อย่อหุ้น (ไทย/ต่างประเทศ) และเลือกช่วงวันที่ย้อนหลังเพื่อวิเคราะห์กราฟ</p>
      <form onSubmit={handleSubmit} className="indicator-form">
        <div className="form-group">
          <label>ชื่อหุ้น:</label>
          <input type="text" value={inputSymbol} onChange={e=>setInputSymbol(e.target.value)} placeholder="เช่น PTT, AOT" required />
        </div>
        <div className="date-range-row">
          <label className="date-label">
            จาก
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={e => {
                setStartDate(e.target.value);
                setSelectedPreset(null);
              }}
              required
            />
          </label>
          <label className="date-label">
            ถึง
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => {
                setEndDate(e.target.value);
                setSelectedPreset(null);
              }}
              required
            />
          </label>
        </div>
        <div className="preset-buttons">
          {PRESET_RANGES.map(option => (
            <button
              key={option.id}
              type="button"
              className={`range-button${selectedPreset === option.id ? ' active' : ''}`}
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
        <div className="range-summary notice">
          ช่วงวันที่ที่เลือก:{' '}
          {startDate && endDate
            ? `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)} (${dateRangeInDays} วัน, ต้องการ ≥ 35 วัน)`
            : 'ยังไม่ระบุ'}
        </div>
        <button type="submit" className="primary-button" disabled={loading}>
          {loading?'กำลังคำนวณ...':'วิเคราะห์'}
        </button>
      </form>

      {/* Chart vertical controls */}
      <div className="chart-controls">
        <div className="control">
          <label>ความสูงกราฟหลัก: x{heightScale.toFixed(2)} (~{Math.round(priceHeight)}px)</label>
          <input
            type="range"
            min="0.7"
            max="1.5"
            step="0.05"
            value={heightScale}
            onChange={(e)=> setHeightScale(parseFloat(e.target.value))}
          />
        </div>
        <div className="control">
          <label>ซูมแนวตั้ง (ราคา): Padding {Math.round(pricePadPct*100)}%</label>
          <input
            type="range"
            min="0.01"
            max="0.15"
            step="0.005"
            value={pricePadPct}
            onChange={(e)=> setPricePadPct(parseFloat(e.target.value))}
          />
        </div>
        <button type="button" className="primary-button reset-button" onClick={()=>{ setHeightScale(1.0); setPricePadPct(0.06); }}>รีเซ็ต</button>
      </div>

      {displayRange.start && displayRange.end && (
        <div className="analysis-range-banner">
          วิเคราะห์ช่วง {formatDisplayDate(displayRange.start)} - {formatDisplayDate(displayRange.end)} ({displayRangeInDays} วัน)
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {chartData && (
        <div className="results-wrapper tradingview-layout">
          <div className="tradingview-main">
            <PriceChart
              data={chartData.price}
              signals={chartData.macdSignals}
              smaSignals={chartData.smaSignals}
              goldenDeathSignals={chartData.goldenDeathSignals}
              macdStrategySignals={chartData.macdSmaStrategy}
              fibonacci={chartData.fibonacci}
              syncId="sync"
              height={priceHeight}
              padPct={pricePadPct}
              wrapperClassName="main-chart-card"
              currency={currency}
             />
            <VolumeChart
              data={chartData.volume}
              syncId="sync"
              height={volumeHeight}
              wrapperClassName="secondary-chart-card"
              currency={currency}
            />
            <RsiChart
              data={chartData.rsi}
              signals={chartData.rsiSignals}
              divergences={chartData.rsiDivergences}
              smoothingLabel={RSI_SETTINGS.smoothingType}
              syncId="sync"
              height={rsiHeight}
              wrapperClassName="secondary-chart-card"
              currency={currency}
            />            <MacdHistogramChart
              data={chartData.macd}
              syncId="sync"
              height={squeezeHeight}
              wrapperClassName="secondary-chart-card"
              currency={currency}
            />
          </div>
        </div>
      )}

      <Link to="/" className="primary-button back-button">กลับสู่หน้าหลัก</Link>
    </div>
  );
}
