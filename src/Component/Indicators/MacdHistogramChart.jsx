import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, CartesianGrid, YAxis, ReferenceLine, Bar, Cell } from 'recharts';
import { renderCommonXAxis, commonTooltip } from './common.jsx';

// React.memo for performance
export default React.memo(function MacdHistogramChart({ data = [], syncId, height, wrapperClassName = '', currency = '' }) {
  const chartRows = Array.isArray(data) ? data : [];
  const values = useMemo(() => chartRows.map(d => d.histogram).filter(v => Number.isFinite(v)), [chartRows]);
  const absMax = values.length ? Math.max(...values.map(v => Math.abs(v))) : 1;
  const pad = useMemo(() => Math.max(absMax * 1.15, 0.5), [absMax]);
  const wrapperClasses = ['chart-wrapper', wrapperClassName].join(' ');

  const barCells = useMemo(() => chartRows.map((row, idx) => {
    const val = row.histogram ?? 0;
    const prev = chartRows[idx - 1]?.histogram ?? val;
    const rising = val >= prev;
    const fill = val >= 0 ? (rising ? '#18f26a' : '#0e9f47') : (rising ? '#ff2f45' : '#b71c1c');
    return <Cell key={`macd-bar-${idx}`} fill={fill} />;
  }), [chartRows]);

  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className={wrapperClassName || 'chart-placeholder'} style={{ padding: 20 }}>No MACD data</div>;
  }

  return (
    <div className={wrapperClasses}>
      <h3>MACD Histogram</h3>
      <ResponsiveContainer width="100%" minWidth={280} height={height || 320}>
        <ComposedChart data={chartRows} margin={{ top: 5, right: 30, left: 0, bottom: 20 }} syncId={syncId}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          {renderCommonXAxis()}
          <YAxis yAxisId="left" tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} tickFormatter={v => (Number.isFinite(v) ? v.toFixed(2) : '')} width={44} domain={[-pad, pad]} />
          {commonTooltip(currency)}
          <ReferenceLine yAxisId="left" y={0} stroke="var(--color-border)" strokeWidth={1.2} />
          <Bar yAxisId="left" dataKey="histogram" name="MACD Histogram" barSize={8}>{barCells}</Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});