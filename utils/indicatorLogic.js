// src/utils/indicatorLogic.js

// --- ฟังก์ชันการคำนวณ Indicators ---

export const calculateSMA = (data, period) => {
  if (data.length < period) return null;
  const sma = [];
  for (let i = period - 1; i < data.length; i++) {
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, val) => acc + val.close, 0);
    sma.push({ date: data[i].date, value: sum / period });
  }
  return sma;
};

export const calculateEMA = (data, period) => {
    if (data.length < period) return null;
    const ema = [];
    const multiplier = 2 / (period + 1);
    let currentEMA = data.slice(0, period).reduce((acc, val) => acc + val.close, 0) / period;
    ema.push({ date: data[period - 1].date, value: currentEMA });
    for (let i = period; i < data.length; i++) {
        currentEMA = (data[i].close - currentEMA) * multiplier + currentEMA;
        ema.push({ date: data[i].date, value: currentEMA });
    }
    return ema;
};

export const calculateRSI = (data, period = 14) => {
  if (data.length <= period) return null;
  const rsiValues = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    let gain = change > 0 ? change : 0;
    let loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    rsiValues.push({ date: data[i].date, value: rsi });
  }
  return rsiValues;
};

export const calculateMACD = (data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) => {
  if (data.length < slowPeriod) return null;
  const emaFast = calculateEMA(data, fastPeriod);
  const emaSlow = calculateEMA(data, slowPeriod);
  if (!emaFast || !emaSlow) return null;
  const macdLine = emaSlow.map((slowPoint, index) => {
    const fastIndex = index + (slowPeriod - fastPeriod);
    if (fastIndex < emaFast.length) {
      return { date: slowPoint.date, value: emaFast[fastIndex].value - slowPoint.value };
    }
    return null;
  }).filter(Boolean);
  if (macdLine.length < signalPeriod) return null;
  const signalData = macdLine.map(d => ({ close: d.value, date: d.date }));
  const signalLine = calculateEMA(signalData, signalPeriod);
  if (!signalLine) return null;
  const histogram = signalLine.map((signalPoint, index) => {
    const macdIndex = index + (macdLine.length - signalLine.length);
    if (macdIndex < macdLine.length) {
        return { date: signalPoint.date, value: macdLine[macdIndex].value - signalPoint.value };
    }
    return null;
  }).filter(Boolean);
  return { macdLine, signalLine, histogram };
};

// --- ฟังก์ชันสำหรับตีความหมาย Indicator ---

export const interpretRSI = (rsiValue) => {
  if (rsiValue === null || typeof rsiValue === 'undefined') return "N/A";
  if (rsiValue > 70) return "โซนซื้อมากไป (Overbought)";
  if (rsiValue < 30) return "โซนขายมากไป (Oversold)";
  if (rsiValue > 50) return "แนวโน้มขาขึ้น (Uptrend)";
  if (rsiValue < 50) return "แนวโน้มขาลง (Downtrend)";
  return "รอสัญญาณ (Neutral)";
};

export const interpretMACD = (macdLine, signalLine) => {
  if (macdLine === null || signalLine === null || typeof macdLine === 'undefined' || typeof signalLine === 'undefined') return "N/A";
  if (macdLine > signalLine) return "สัญญาณซื้อ (Bullish)";
  if (macdLine < signalLine) return "สัญญาณขาย (Bearish)";
  if (macdLine === signalLine) return "รอสัญญาณ (Neutral)"; // <-- แก้ไข Bug ที่นี่
  return "N/A";
};