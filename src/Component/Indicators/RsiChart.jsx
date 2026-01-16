/**
 * =====================================================
 * RsiChart.jsx - กราฟ RSI (Relative Strength Index)
 * =====================================================
 * 
 * **จุดประสงค์:**
 * แสดงกราฟ RSI พร้อม Smoothing และ Divergence Detection
 * 
 * **Features:**
 * - RSI Line: เส้น RSI (0-100)
 * - RSI MA/Bollinger Bands: เส้นค่าเฉลี่ยและแถบ Bollinger สำหรับ RSI
 * - Overbought/Oversold Zones: โซนสีแดง (>70) และเขียว (<30)
 * - Bullish/Bearish Divergence: จุดสัญญาณ Divergence อัตโนมัติ
 * - Cross Signals: จุดตัด RSI กับเส้นค่าเฉลี่ย
 * 
 * **Props:**
 * @param {Array} data - ข้อมูล RSI พร้อม smoothing
 * @param {Array} signals - จุดสัญญาณ Bullish/Bearish
 * @param {Array} divergences - จุด Divergence
 * @param {string} currency - สกุลเงิน
 */

import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Line, ReferenceArea, YAxis, CartesianGrid } from 'recharts';
import { renderCommonXAxis, commonTooltip } from './common';

export default function RsiChart({ data = [], signals = [], divergences = [], smoothingLabel, syncId, height, wrapperClassName = '', currency = '' }) {
  const hasSmoothing = useMemo(() => Array.isArray(data) && data.some(d => Number.isFinite(d.smoothing)), [data]);
  const hasBands = useMemo(() => Array.isArray(data) && data.some(d => Number.isFinite(d.smoothingUpper) && Number.isFinite(d.smoothingLower)), [data]);
  const smoothingName = smoothingLabel ? `RSI ${smoothingLabel}` : 'RSI MA';
  const wrapperClasses = useMemo(() => ['chart-wrapper', wrapperClassName].filter(Boolean).join(' '), [wrapperClassName]);

  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className={wrapperClasses || 'chart-placeholder'} style={{ padding: 20 }}>No RSI data</div>;
  }

  return (
    <div className={wrapperClasses}>
      <h3>RSI พร้อมเส้นค่าเฉลี่ย, Bollinger Bands และ Divergence</h3>
      <ResponsiveContainer width="100%" minWidth={280} height={height || 300}>
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 20 }} syncId={syncId}>
          <defs>
            <linearGradient id="rsiMidFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#42a5f5" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#42a5f5" stopOpacity={0.10} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          {renderCommonXAxis()}
          <YAxis yAxisId="left" domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} />
          {commonTooltip(currency)}

          {hasBands && (
            <>
              <Line yAxisId="left" dataKey="smoothingUpper" name="RSI Upper Band" stroke="#26a69a" strokeDasharray="4 2" dot={false} />
              <Line yAxisId="left" dataKey="smoothingLower" name="RSI Lower Band" stroke="#26a69a" strokeDasharray="4 2" dot={false} />
            </>
          )}

          {hasSmoothing && <Line yAxisId="left" dataKey="smoothing" name={smoothingName} stroke="#ffd54f" strokeWidth={1.8} dot={false} />}

          <Line yAxisId="left" dataKey="value" name="RSI" stroke="#7e57c2" strokeWidth={2} dot={false} />

          <ReferenceArea yAxisId="left" y1={30} y2={70} fill="url(#rsiMidFill)" />
          <ReferenceArea yAxisId="left" y1={70} y2={100} fill="#26ff00ff" fillOpacity={0.12} label={{ value: 'Overbought', position: 'insideTopRight', fill: '#26ff00ff' }} />
          <ReferenceArea yAxisId="left" y1={0} y2={30} fill="#ff0000ff" fillOpacity={0.12} label={{ value: 'Oversold', position: 'insideBottomRight', fill: '#ff0000ff' }} />

          {signals.map((s, i) => {
            const pt = data.find(d => d.date === s.date);
            if (!pt) return null;
            return <ReferenceDot key={`rsi-signal-${i}`} yAxisId="left" x={s.date} y={pt.value} r={6} fill={s.type === 'bullish' ? '#43a047' : '#e53935'} stroke="#fff" label={{ value: s.type === 'bullish' ? 'BULL' : 'BEAR', fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }} />;
          })}

          {divergences.map((s, i) => {
            const pt = data.find(d => d.date === s.date);
            const y = s.value ?? pt?.value;
            if (!pt || !Number.isFinite(y)) return null;
            const fill = s.type === 'bull' ? '#66bb6a' : '#ef5350';
            const label = s.type === 'bull' ? 'Bull Div' : 'Bear Div';
            return <ReferenceDot key={`rsi-div-${i}`} yAxisId="left" x={s.date} y={y} r={7} fill={fill} stroke="#fff" label={{ value: label, fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }} />;
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}