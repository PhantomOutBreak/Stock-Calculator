// src/pages/IndicatorsPage.jsx

// --- React and Library Imports ---
import React, { useState, useEffect } from 'react';
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
  ReferenceLine,
  Brush
} from 'recharts';

// --- CSS Imports ---
import '../css/App.css';
import '../css/IndicatorsPage.css';

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

async function fetchStockHistory(symbol, days) {
  // ส่งสัญลักษณ์ตามที่ผู้ใช้กรอก (ปล่อย backend ตัดสินใจ .BK)
  const ticker = symbol.trim().toUpperCase();
  const start = new Date();
  start.setDate(start.getDate() - days);
  const startStr = start.toISOString().split('T')[0];
  const res = await fetch(`http://localhost:5000/api/stock/history/${ticker}?startDate=${startStr}`);
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

const interpretRSI = v => {
  if (v == null) return 'N/A';
  if (v > 70) return 'Overbought';
  if (v < 30) return 'Oversold';
  return v > 50 ? 'Uptrend' : 'Downtrend';
};
const interpretMACD = (m, s) => {
  if (m == null || s == null) return 'N/A';
  return m > s ? 'Bullish' : m < s ? 'Bearish' : 'Neutral';
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
const commonTooltip = (
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
const PriceChart = ({ data, signals, smaSignals = [], goldenDeathSignals = [], macdStrategySignals = [], fibonacci, syncId, height, padPct }) => {
  const obos = data
    .filter(d => d.bbUpper != null && (d.close > d.bbUpper || d.close < d.bbLower))
    .map(d => ({
      date: d.date,
      type: d.close > d.bbUpper ? 'overbought' : 'oversold',
      value: d.close
    }));

  // Track visible X-range to drive vertical domain from visible data
  const [viewRange, setViewRange] = React.useState([0, Math.max(0, (data?.length || 1) - 1)]);
  React.useEffect(() => {
    setViewRange([0, Math.max(0, (data?.length || 1) - 1)]);
  }, [data?.length]);
  const vs = Math.max(0, viewRange[0] ?? 0);
  const ve = Math.min((data?.length || 1) - 1, viewRange[1] ?? ((data?.length || 1) - 1));
  const visible = Array.isArray(data) ? data.slice(vs, ve + 1) : [];

  return (
    <div className="chart-wrapper">
      <h3>ราคาปิด, Bollinger Bands & Fibonacci</h3>
      <ResponsiveContainer width="100%" height={height || 380}>
        <ComposedChart data={data} margin={chartMargin} syncId={syncId}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          {commonXAxis}
          {(() => {
            // Domain from visible data only
            const domainValues = visible
              .flatMap(d => [d.close, d.bbUpper, d.bbLower, d.sma10, d.sma50, d.sma100, d.sma200])
              .filter(v => typeof v === 'number');
            const [yMin, yMax] = getPaddedDomain(domainValues, padPct ?? 0.06);
            return (
              <YAxis
                yAxisId="left"
                tick={{ fill: '#607d8b', fontSize: 12 }}
                domain={[yMin, yMax]}
                allowDecimals
                tickFormatter={formatPriceTick}
                orientation="right"
              />
            );
          })()}
          {commonTooltip}
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
              stroke="#9e9e9e"
              strokeDasharray="3 3"
              label={{ value: `Last ${formatPriceTick(data[data.length - 1].close)}`, position: 'right', fill: '#9e9e9e', fontSize: 10 }}
            />
          )}

          {(fibonacci?.levels || []).map(l => (
            <ReferenceLine
              key={l.level}
              yAxisId="left"
              y={l.value}
              stroke="#ffd54f"
              strokeDasharray="4 4"
              label={{ value: l.level, position: 'right', fontSize: 10, fill: '#a3a3a3' }}
            />
          ))}
          {fibonacci && (
            <>
              <ReferenceLine yAxisId="left" y={fibonacci.high} stroke="#e53935" strokeWidth={2}
                label={{ value: 'Resistance', position: 'right', fill: '#e53935', fontSize: 12 }} />
              <ReferenceLine yAxisId="left" y={fibonacci.low} stroke="#43a047" strokeWidth={2}
                label={{ value: 'Support', position: 'right', fill: '#43a047', fontSize: 12 }} />
            </>
          )}

          {goldenDeathSignals.map((s, i) => {
            if (!data.some(d => d.date === s.date)) return null;
            const stroke = s.type === 'golden' ? '#ffd700' : '#b0bec5';
            const labelColor = s.type === 'golden' ? '#ffb300' : '#78909c';
            return (
              <ReferenceLine
                key={`gd-${i}-${s.date}`}
                x={s.date}
                stroke={stroke}
                strokeWidth={2}
                strokeDasharray="6 4"
                label={{ value: s.label, position: 'top', fill: labelColor, fontSize: 10 }}
              />
            );
          })}

          {signals.map(s => {
            const pt = data.find(d => d.date === s.date);
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
            const pt = data.find(d => d.date === s.date);
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
            const pt = data.find(d => d.date === s.date);
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
          <Brush
            dataKey="date"
            height={28}
            travellerWidth={8}
            stroke="#1976d2"
            onChange={(range) => {
              if (!range) return;
              const s = Math.max(0, range.startIndex || 0);
              const e = Math.min((data?.length || 1) - 1, range.endIndex || 0);
              setViewRange([s, e]);
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// Volume Chart
const VolumeChart = ({ data, syncId, height }) => (
  <div className="chart-wrapper">
    <h3>Volume</h3>
    <ResponsiveContainer width="101%" height={height || 260}>
      <ComposedChart data={data} margin={chartMargin} syncId={syncId}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
        {commonXAxis}
        <YAxis
          tick={{ fill: '#8bc34a', fontSize: 12 }}
          domain={[0, (max) => Math.ceil(max * 1.15)]}
          tickFormatter={v => v.toLocaleString()}
        />
        {commonTooltip}
        <Bar dataKey="volume" name="Volume" fillOpacity={0.9}>
          {data.map((e, i) => (
            <Cell key={i} fill={e.isUp ? 'var(--color-success)' : '#d32f2f'} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  </div>
);

// RSI Chart
const RsiChart = ({ data, signals = [], divergences = [], smoothingLabel, syncId, height }) => {
  const hasSmoothing = Array.isArray(data) && data.some(d => Number.isFinite(d.smoothing));
  const hasBands = Array.isArray(data) && data.some(d => Number.isFinite(d.smoothingUpper) && Number.isFinite(d.smoothingLower));
  const smoothingName = smoothingLabel ? `RSI ${smoothingLabel}` : 'RSI MA';

  return (
    <div className="chart-wrapper">
      <h3>RSI พร้อมเส้นค่าเฉลี่ย, Bollinger Bands และ Divergence</h3>
      <ResponsiveContainer width="100%" minWidth={350} height={height || 300}>
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
          {commonTooltip}

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
};

// MACD Chart
const MacdChart = ({ data, signals, strategySignals = [], syncId, height }) => (
  <div className="chart-wrapper">
    <h3>MACD(12,26,9) พร้อมสัญญาณละเอียด</h3>
    <ResponsiveContainer width="100%" minWidth={350} height={height || 1000}>
      <ComposedChart data={data} margin={chartMargin} syncId={syncId}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        {commonXAxis}
        {(() => {
          const vals = data.flatMap(d => [d.macdLine, d.signalLine, d.histogram]).filter(v => typeof v === 'number' && Number.isFinite(v));
          const absMax = vals.length ? Math.max(...vals.map(Math.abs)) : 1;
          const pad = absMax * 1.1;
          return (
            <YAxis
              yAxisId="left"
              tick={{ fill:'var(--color-text-secondary)',fontSize:11 }}
              tickFormatter={v=>v.toFixed(1)}
              width={40}
              domain={[-pad, pad]}
            />
          );
        })()}
        {commonTooltip}
        <Legend />

        <ReferenceLine yAxisId="left" y={0} stroke="var(--color-text-secondary)" strokeDasharray="3 3" />

        <Bar yAxisId="left" dataKey="histogram" name="Histogram" fillOpacity={0.6}>
          {data.map((e,i)=><Cell key={i} fill={e.histogram>=0? 'var(--color-success)':'var(--color-danger)'} />)}
        </Bar>
        <Line yAxisId="left" dataKey="macdLine" name="MACD Line" stroke="#4caf50" dot={false} />
        <Line yAxisId="left" dataKey="signalLine" name="Signal Line" stroke="#ff7300" dot={false} />

        {signals.map((s,i)=>{
          let r=6, fill, lbl;
          if(s.signalType==='macdCross'){ r=8; fill=s.type==='buy'? '#43a047':'#e53935'; lbl=s.type==='buy'?'M+':'M−'; }
          else if(s.signalType==='histCross'){ fill=s.type==='buy'? '#7cb342':'#d32f2f'; lbl=s.type==='buy'?'H+':'H−'; }
          else { fill=s.type==='buy'? '#c0ca33':'#f57c00'; lbl=s.type==='buy'?'Z+':'Z−'; }
          return (
            <ReferenceDot
              key={i}
              yAxisId="left"
              x={s.date}
              y={s.y}
              r={r}
              fill={fill}
              stroke="#fff"
              label={{ value: lbl, fill:'#fff',fontSize:10,textAnchor:'middle',dy:4 }}
            />
          );
        })}

        {strategySignals.map((s,i) => {
          const pt = data.find(d => d.date === s.date);
          if (!pt) return null;
          const fill = s.type === 'buy' ? '#00c853' : '#ff3d00';
          const label = s.type === 'buy' ? 'LE' : 'SE';
          return (
            <ReferenceDot
              key={`macd-strategy-${i}`}
              yAxisId="left"
              x={s.date}
              y={0}
              r={9}
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

// =================================================================
// === SECTION 3: MAIN PAGE COMPONENT                            ===
// =================================================================

export default function IndicatorsPage() {
  const [inputSymbol, setInputSymbol] = useState('');
  const [days, setDays] = useState(90);
  const [chartData, setChartData] = useState(null);
  const [indicatorValues, setIndicatorValues] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dynamic heights by viewport
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
  useEffect(() => {
    const onResize = () => setVh(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
  // User-adjustable scales
  const [heightScale, setHeightScale] = useState(1.0);
  const [pricePadPct, setPricePadPct] = useState(0.06); // vertical zoom: lower = zoom in
  const priceHeight = clamp(vh * 0.42 * heightScale, 280, 640);
  const volumeHeight = clamp(vh * 0.22 * heightScale, 160, 420);
  const rsiHeight = clamp(vh * 0.30 * heightScale, 200, 480);
  const macdHeight = clamp(vh * 0.30 * heightScale, 200, 480);

  const handleSubmit = async e => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const raw = await fetchStockHistory(inputSymbol, days);
      const sorted = raw.sort((a, b) => a.date - b.date);
      if (sorted.length < 35) throw new Error('Data not enough (~35 days)');

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

      // SMA series
      const sma10     = calculateSMA(sorted, 10);
      const sma50     = calculateSMA(sorted, 50);
      const sma100    = calculateSMA(sorted, 100);
      const sma200    = calculateSMA(sorted, 200);
      const smaFast   = calculateSMA(sorted, 12);
      const smaSlow   = calculateSMA(sorted, 26);

      const localeOpts = { day: '2-digit', month: 'short', year: 'numeric' };
      const dateStrMap = new Map(sorted.map(d => [d.date.getTime(), d.date.toLocaleDateString('th-TH', localeOpts)]));

      const mapPb   = new Map(bbands.map(d => [d.date.getTime(), d]));
      const mapM    = new Map(macd.macdLine.map(d => [d.date.getTime(), d.value]));
      const mapS    = new Map(macd.signalLine.map(d => [d.date.getTime(), d.value]));
      const mapS10  = new Map((sma10  || []).map(d => [d.date.getTime(), d.value]));
      const mapS50  = new Map((sma50  || []).map(d => [d.date.getTime(), d.value]));
      const mapS100 = new Map((sma100 || []).map(d => [d.date.getTime(), d.value]));
      const mapS200 = new Map((sma200 || []).map(d => [d.date.getTime(), d.value]));
      const mapSFast = new Map((smaFast || []).map(d => [d.date.getTime(), d.value]));
      const mapSSlow = new Map((smaSlow || []).map(d => [d.date.getTime(), d.value]));
      const mapHist = new Map(macd.histogram.map(d => [d.date.getTime(), d.value]));
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

      const macdData = macd.histogram.map(h => {
        const t = h.date.getTime();
        const ds = dateStrMap.get(t);
        return { date: ds, histogram: h.value, macdLine: mapM.get(t), signalLine: mapS.get(t) };
      });

      const latestR = rsi.slice(-1)[0]?.value ?? null;
      const latestM = macd.macdLine.slice(-1)[0]?.value ?? null;
      const latestS = macd.signalLine.slice(-1)[0]?.value ?? null;

      // MACD + SMA200 strategy signals
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

      // SMA crossover signals (bullish/bearish)
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
      setIndicatorValues({
        rsi: latestR,
        macdLine: latestM,
        signalLine: latestS,
        rsiSignal: interpretRSI(latestR),
        macdSignal: interpretMACD(latestM, latestS),
        macdSmaSignal: macdSmaStrategy.slice(-1)[0]?.type ?? null
      });
    } catch (err) {
      setError(err.message);
      setChartData(null);
      setIndicatorValues(null);
    }
    setLoading(false);
  };

  useEffect(() => { handleSubmit({ preventDefault:()=>{} }); }, []);

  return (
    <div className="page-container">
      <h1>📈 Technical Indicators Dashboard</h1>
      <p>กรอกชื่อย่อหุ้น (ไทย/ต่างประเทศ) และจำนวนวันย้อนหลังเพื่อวิเคราะห์กราฟ</p>
      <form onSubmit={handleSubmit} className="indicator-form">
        <div className="form-group">
          <label>ชื่อหุ้น:</label>
          <input type="text" value={inputSymbol} onChange={e=>setInputSymbol(e.target.value)} placeholder="เช่น PTT, AOT" required />
        </div>
        <div className="form-group">
          <label>จำนวนวัน:</label>
          <input type="number" value={days} min={35} max={730} onChange={e=>setDays(+e.target.value)} required />
        </div>
        <button type="submit" className="primary-button" disabled={loading}>
          {loading?'กำลังคำนวณ...':'วิเคราะห์'}
        </button>
      </form>

      {/* Chart vertical controls */}
      <div className="chart-controls">
        <div className="control">
          <label>ความสูงกราฟ: x{heightScale.toFixed(2)}</label>
          <input
            type="range"
            min="0.8"
            max="2.10"
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

      {error && <div className="error-message">{error}</div>}

      {chartData && (
        <div className="results-wrapper">
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
          />
          <VolumeChart data={chartData.volume} syncId="sync" height={volumeHeight} />
          <RsiChart
            data={chartData.rsi}
            signals={chartData.rsiSignals}
            divergences={chartData.rsiDivergences}
            smoothingLabel={RSI_SETTINGS.smoothingType}
            syncId="sync"
            height={rsiHeight}
          />
          <MacdChart
            data={chartData.macd}
            signals={chartData.macdSignals}
            strategySignals={chartData.macdSmaStrategy}
            syncId="sync"
            height={macdHeight}
          />

          <div className="indicators-results-container">
            <h2>สรุปผลสำหรับ {inputSymbol.trim().toUpperCase()}</h2>
            <div className="indicator-card-grid">
              <div className="indicator-card signal-card rsi-signal">
                <h3>สัญญาณ RSI</h3>
                <p className="indicator-value">{indicatorValues.rsiSignal}</p>
              </div>
              <div className="indicator-card signal-card macd-signal">
                <h3>สัญญาณ MACD</h3>
                <p className="indicator-value">{indicatorValues.macdSignal}</p>
              </div>
              <div className="indicator-card">
                <h3>RSI (14)</h3>
                <p className="indicator-value">{indicatorValues.rsi?.toFixed(2) ?? 'N/A'}</p>
              </div>
              <div className="indicator-card">
                <h3>MACD Line</h3>
                <p className="indicator-value">{indicatorValues.macdLine?.toFixed(2) ?? 'N/A'}</p>
              </div>
            <div className="indicator-card">
              <h3>Signal Line</h3>
              <p className="indicator-value">{indicatorValues.signalLine?.toFixed(2) ?? 'N/A'}</p>
            </div>
            <div className="indicator-card">
              <h3>MACD + SMA200</h3>
              <p className="indicator-value">
                {indicatorValues.macdSmaSignal === 'buy'
                  ? 'Bullish Setup'
                  : indicatorValues.macdSmaSignal === 'sell'
                    ? 'Bearish Setup'
                    : 'N/A'}
              </p>
            </div>
          </div>
        </div>
        </div>
      )}

      <Link to="/" className="primary-button back-button">กลับสู่หน้าหลัก</Link>
    </div>
  );
}
