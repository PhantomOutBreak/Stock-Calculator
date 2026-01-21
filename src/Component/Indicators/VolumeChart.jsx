import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, CartesianGrid, Bar, YAxis, Cell } from 'recharts';
import { renderCommonXAxis, commonTooltip } from './common.jsx';

// React.memo for performance
export default React.memo(function VolumeChart({ data = [], syncId, height, wrapperClassName = '', currency = '' }) {
  const wrapperClasses = ['chart-wrapper', wrapperClassName].filter(Boolean).join(' ');
  const cells = useMemo(() => (data || []).map((e, i) => <Cell key={i} fill={e.isUp ? 'var(--color-success)' : '#d32f2f'} />), [data]);

  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className={wrapperClassName || 'chart-placeholder'} style={{ padding: 20 }}>No volume data</div>;
  }

  return (
    <div className={wrapperClasses}>
      <h3>Volume</h3>
      <ResponsiveContainer width="100%" height={height || 260}>
        <ComposedChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 20 }} syncId={syncId}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          {renderCommonXAxis()}
          <YAxis tick={{ fill: '#8bc34a', fontSize: 12 }} domain={[0, (max) => Math.ceil(max * 1.15)]} tickFormatter={v => v.toLocaleString()} />
          {commonTooltip(currency)}
          <Bar dataKey="volume" name="Volume" fillOpacity={0.9}>{cells}</Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
});