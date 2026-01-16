import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, ReferenceLine, ReferenceDot,
  CartesianGrid, Legend, YAxis, ReferenceArea
} from 'recharts';
import { chartMargin, renderCommonXAxis, commonTooltip, formatPriceTick, getPaddedDomain } from './common.jsx';

export default function PriceChart({
  data = [], signals = [], smaSignals = [], goldenDeathSignals = [],
  goldenDeathZones = [], macdStrategySignals = [], highLowPeaks = [], fibonacci, syncId, height, padPct,
  wrapperClassName = '', currency = '', visible = {}
}) {
  const obos = useMemo(() => (data || [])
    .filter(d => d.bbUpper != null && (d.close > d.bbUpper || d.close < d.bbLower))
    .map(d => ({ date: d.date, type: d.close > d.bbUpper ? 'overbought' : 'oversold', value: d.close })), [data]);

  const wrapperClasses = ['chart-wrapper', wrapperClassName].filter(Boolean).join(' ');

  // Include Fibonacci levels in domain calculation so they're always visible
  const fibLevels = (visible.fib && fibonacci?.levels) ? fibonacci.levels.map(l => l.value) : [];

  const domainValues = useMemo(() => [
    ...(data || []).flatMap(d => [
      d.close,
      visible.bb ? d.bbUpper : null,
      visible.bb ? d.bbLower : null,
      visible.sma ? d.sma10 : null,
      visible.sma ? d.sma50 : null,
      visible.sma ? d.sma100 : null,
      visible.sma ? d.sma200 : null,
      visible.ema ? d.ema50 : null,
      visible.ema ? d.ema100 : null,
      visible.ema ? d.ema200 : null
    ]),
    ...fibLevels
  ].filter(v => typeof v === 'number'), [data, visible, fibonacci, padPct]);

  const [yMin, yMax] = useMemo(() => getPaddedDomain(domainValues, padPct ?? 0.06), [domainValues, padPct]);

  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className={wrapperClassName || 'chart-placeholder'} style={{ padding: 20 }}>No price data</div>;
  }

  return (
    <div className={wrapperClasses}>
      <h3>Price Action & Indicators</h3>
      <ResponsiveContainer width="100%" height={height || 380}>
        <ComposedChart data={data} margin={chartMargin} syncId={syncId}>
          <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
          {renderCommonXAxis()}
          <YAxis
            yAxisId="left"
            domain={[yMin, yMax]}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            tickFormatter={formatPriceTick}
            width={60}
          />

          {/* Bollinger Bands */}
          {visible.bb && <Line yAxisId="left" dataKey="bbUpper" name="Upper BB" stroke="#64b5f6" strokeDasharray="4 2" dot={false} strokeWidth={1.5} isAnimationActive={false} />}
          {visible.bb && <Line yAxisId="left" dataKey="bbMiddle" name="Middle BB" stroke="#ffa726" strokeWidth={2} dot={false} isAnimationActive={false} />}
          {visible.bb && <Line yAxisId="left" dataKey="bbLower" name="Lower BB" stroke="#64b5f6" strokeDasharray="4 2" dot={false} strokeWidth={1.5} isAnimationActive={false} />}

          {/* SMA */}
          {visible.sma && <Line yAxisId="left" dataKey="sma10" name="SMA 10" stroke="#e91e63" strokeWidth={2.5} dot={false} isAnimationActive={false} />}
          {visible.sma && <Line yAxisId="left" dataKey="sma50" name="SMA 50" stroke="#00bcd4" strokeWidth={2.5} dot={false} isAnimationActive={false} />}
          {visible.sma && <Line yAxisId="left" dataKey="sma100" name="SMA 100" stroke="#ffc107" strokeWidth={2.5} dot={false} isAnimationActive={false} />}
          {visible.sma && <Line yAxisId="left" dataKey="sma200" name="SMA 200" stroke="#4caf50" strokeWidth={2.5} dot={false} isAnimationActive={false} />}

          {/* EMA */}
          {visible.ema && <Line yAxisId="left" dataKey="ema50" name="EMA 50" stroke="#ff6f00" strokeWidth={2.5} dot={false} isAnimationActive={false} />}
          {visible.ema && <Line yAxisId="left" dataKey="ema100" name="EMA 100" stroke="#00897b" strokeWidth={2.5} dot={false} isAnimationActive={false} />}
          {visible.ema && <Line yAxisId="left" dataKey="ema200" name="EMA 200" stroke="#7b1fa2" strokeWidth={2.5} dot={false} isAnimationActive={false} />}

          {/* Peak High/Low Markers (Single dots at actual peak positions) */}
          {visible.weeklyHighLow && highLowPeaks
            .filter(p => p.type === 'weeklyHigh' || p.type === 'weeklyLow')
            .map((p, i) => (
              <ReferenceDot
                key={`weekly-${i}-${p.date}`}
                yAxisId="left"
                x={p.date}
                y={p.value}
                r={6}
                fill={p.type === 'weeklyHigh' ? '#2962ff' : '#00b0ff'}
                stroke="#fff"
                strokeWidth={1}
                label={{ value: p.type === 'weeklyHigh' ? 'W↑' : 'W↓', fill: '#fff', fontSize: 9, position: 'top' }}
              />
            ))
          }

          {visible.monthlyHighLow && highLowPeaks
            .filter(p => p.type === 'monthlyHigh' || p.type === 'monthlyLow')
            .map((p, i) => (
              <ReferenceDot
                key={`monthly-${i}-${p.date}`}
                yAxisId="left"
                x={p.date}
                y={p.value}
                r={7}
                fill={p.type === 'monthlyHigh' ? '#aa00ff' : '#ea80fc'}
                stroke="#fff"
                strokeWidth={1}
                label={{ value: p.type === 'monthlyHigh' ? 'M↑' : 'M↓', fill: '#fff', fontSize: 9, position: 'top' }}
              />
            ))
          }

          {visible.yearlyHighLow && highLowPeaks
            .filter(p => p.type === 'yearlyHigh' || p.type === 'yearlyLow')
            .map((p, i) => (
              <ReferenceDot
                key={`yearly-${i}-${p.date}`}
                yAxisId="left"
                x={p.date}
                y={p.value}
                r={8}
                fill={p.type === 'yearlyHigh' ? '#ff6d00' : '#ffd600'}
                stroke="#fff"
                strokeWidth={1.5}
                label={{ value: p.type === 'yearlyHigh' ? 'Y↑' : 'Y↓', fill: '#fff', fontSize: 10, position: 'top' }}
              />
            ))
          }

          {/* Price */}
          <Line yAxisId="left" dataKey="close" name="Close Price" stroke="#cececeff" strokeWidth={3} dot={false} isAnimationActive={false} />

          {commonTooltip(currency)}
          <Legend />

          {Number.isFinite(data?.[data.length - 1]?.close) && (
            <ReferenceLine
              yAxisId="left"
              y={data[data.length - 1].close}
              stroke="#555"
              strokeDasharray="3 3"
              label={{ value: `Last ${formatPriceTick(data[data.length - 1].close)}`, position: 'right', fill: '#555', fontSize: 10 }}
            />
          )}

          {/* Fibonacci - Enhanced Rendering */}
          {visible.fib && fibonacci && Array.isArray(fibonacci.levels) && fibonacci.levels.map(l => (
            <ReferenceLine
              key={`fib-${l.level}`}
              yAxisId="left"
              y={l.value}
              stroke={l.color || '#ffa000'}
              strokeDasharray={l.level.includes('0%') || l.level.includes('100%') ? '3 0' : '4 4'}
              strokeWidth={l.level.includes('0%') || l.level.includes('100%') ? 1.5 : 1}
              label={{ value: l.level, position: 'insideRight', fontSize: 11, fill: l.color || '#ffa000', fontWeight: 'bold' }}
            />
          ))}

          {/* Fibonacci Info Label */}
          {visible.fib && fibonacci && (
            <ReferenceDot
              yAxisId="left"
              x={data[0]?.date}
              y={fibonacci.high}
              r={0}
              label={{
                value: `Fib High: ${formatPriceTick(fibonacci.high)} | Low: ${formatPriceTick(fibonacci.low)}`,
                position: 'insideTopLeft',
                fill: '#e0e0e0',
                fontSize: 10,
                offset: 10
              }}
            />
          )}

          {/* Golden/Death Cross Background Zones */}
          {visible.goldenDeath && goldenDeathZones.map((zone, i) => (
            <ReferenceArea
              key={`gd-zone-${i}`}
              yAxisId="left"
              x1={zone.start}
              x2={zone.end}
              fill={zone.type === 'golden' ? '#ffd70020' : '#b0bec520'}
              fillOpacity={0.3}
            />
          ))}

          {/* Golden/Death Cross Signals */}
          {visible.goldenDeath && goldenDeathSignals.map((s, i) => {
            const hasPoint = data?.some(d => d.date === s.date);
            if (!hasPoint) return null;
            return (
              <ReferenceDot
                key={`gd-${i}-${s.date}`}
                yAxisId="left"
                x={s.date}
                y={s.price}
                r={12} // Increased size
                fill={s.type === 'golden' ? '#00e676' : '#ff1744'}
                stroke="#fff"
                strokeWidth={2}
                shape={(props) => {
                  const { cx, cy, fill } = props;
                  // Triangle Up for Golden, Triangle Down for Death
                  const size = 10;
                  const isGolden = s.type === 'golden';

                  const points = isGolden
                    ? `${cx},${cy - size} ${cx + size},${cy + size} ${cx - size},${cy + size}` // Up
                    : `${cx - size},${cy - size} ${cx + size},${cy - size} ${cx},${cy + size}`; // Down

                  return (
                    <g>
                      <polygon points={points} fill={fill} stroke="#ffffff" strokeWidth="2" />
                      <text x={cx} y={cy} dy={isGolden ? 30 : -30} textAnchor="middle" fill={fill} fontSize={12} fontWeight="bold" style={{ textShadow: '0 0 3px #000' }}>
                        {isGolden ? 'GOLDEN' : 'DEATH'}
                      </text>
                    </g>
                  );
                }}
              />
            );
          })}

          {signals.map(s => {
            const pt = data?.find(d => d.date === s.date);
            if (!pt) return null;
            return (
              <ReferenceDot key={s.date + s.type} yAxisId="left" x={s.date} y={pt.close} r={7} fill={s.type === 'buy' ? '#43a047' : '#e53935'} stroke="#fff" label={{ value: s.type === 'buy' ? 'B' : 'S', fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }} />
            );
          })}

          {visible.sma && smaSignals.map((s, i) => {
            const pt = data?.find(d => d.date === s.date);
            if (!pt) return null;
            const isGoldenPair = s.pair === '50/200';
            const fill = isGoldenPair ? (s.kind === 'bull' ? '#ffd700' : '#b0bec5') : (s.kind === 'bull' ? '#43a047' : '#e53935');
            const lbl = isGoldenPair ? (s.kind === 'bull' ? 'Golden' : 'Death') : `${s.pair} ${s.kind === 'bull' ? '+' : '−'}`;
            const radius = isGoldenPair ? 8 : 6;
            return <ReferenceDot key={`sma-${i}-${s.date}-${s.pair}`} yAxisId="left" x={s.date} y={pt.close} r={radius} fill={fill} stroke="#fff" label={{ value: lbl, fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }} />;
          })}

          {visible.macd && macdStrategySignals.map((s, i) => {
            const pt = data?.find(d => d.date === s.date);
            if (!pt) return null;
            const fill = s.type === 'buy' ? '#00c853' : '#ff3d00';
            const label = s.type === 'buy' ? 'MACD Buy' : 'MACD Sell';
            return <ReferenceDot key={`macd-strat-${i}-${s.date}`} yAxisId="left" x={s.date} y={pt.close} r={9} fill={fill} stroke="#fff" label={{ value: label, fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }} />;
          })}

          {visible.bb && obos.map((o, i) => (
            <ReferenceDot key={`ob-${i}-${o.date}`} yAxisId="left" x={o.date} y={o.value} r={6} fill={o.type === 'overbought' ? '#e53935' : '#43a047'} stroke="#fff" label={{ value: o.type === 'overbought' ? 'OB' : 'OS', fill: '#fff', fontSize: 10, textAnchor: 'middle', dy: 4 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}