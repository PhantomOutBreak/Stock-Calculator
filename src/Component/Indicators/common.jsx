import React from 'react';
import { XAxis, Tooltip } from 'recharts';

export const chartMargin = { top: 5, right: 30, left: 0, bottom: 20 };

export const renderCommonXAxis = () => (
  <XAxis
    dataKey="date"
    tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
    angle={-20}
    textAnchor="end"
    height={50}
  />
);

export const commonTooltip = (currency) => (
  <Tooltip
    contentStyle={{
      background: 'var(--color-bg-secondary)',
      color: 'var(--color-text)',
      borderRadius: '8px',
      border: '1px solid var(--color-border)'
    }}
    labelStyle={{ color: 'var(--color-accent)', fontWeight: 'bold' }}
    formatter={(value, name) => {
      const seriesName = name || '';
      const isNumber = typeof value === 'number' && Number.isFinite(value);
      const lower = seriesName.toLowerCase();
      const excludeKeywords = ['sma', 'ema', 'rsi', 'macd', 'histogram', 'volume', 'bb', 'bollinger', 'smoothing', 'signal'];
      const isExcluded = excludeKeywords.some(k => lower.includes(k));
      const isPlainPrice = /(^|\W)(price|close|open|high|low|ราคาปิด|ราคา)(\W|$)/i.test(seriesName);
      const isPriceSeries = !isExcluded && isPlainPrice;
      const curLabel = currency === 'THB' ? 'บาท' : (currency || 'USD');
      let formattedValue;
      if (isNumber) {
        formattedValue = isPriceSeries ? `${value.toFixed(2)} ${curLabel}` : value.toFixed(2);
      } else {
        formattedValue = value ?? '-';
      }
      return [formattedValue, seriesName];
    }}
  />
);

export const formatPriceTick = (v) => {
  if (v == null || Number.isNaN(v)) return '';
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 100) return v.toFixed(1);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(4);
};

export function getPaddedDomain(values, padPct = 0.05) {
  const nums = values.filter((x) => typeof x === 'number' && Number.isFinite(x));
  if (!nums.length) return ['auto', 'auto'];
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return ['auto', 'auto'];

  const range = max - min;
  // If range is 0 (flat line), use 0.1% of value. Else use percentage of range.
  // We avoid using a fixed % of *price* as minimum padding because it flattens low-volatility charts.
  let pad = range === 0 ? max * 0.001 : range * padPct;

  // Ensure a tiny minimum padding to avoid edge-touching on ultra-flat charts
  pad = Math.max(pad, max * 0.0005);

  return [Math.max(0, min - pad), max + pad];
}