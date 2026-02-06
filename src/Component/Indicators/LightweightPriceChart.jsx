/**
 * =====================================================
 * LightweightPriceChart.jsx - กราฟราคาหุ้นแบบ TradingView
 * =====================================================
 * 
 * ใช้ Lightweight Charts v5 API
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createChart, LineSeries } from 'lightweight-charts';

// === Chart Theme Configuration ===
const CHART_THEME = {
    layout: {
        background: { type: 'solid', color: '#1a1a2e' },
        textColor: '#d1d4dc',
    },
    grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
    },
    crosshair: {
        mode: 1,
    },
    rightPriceScale: {
        borderColor: '#2B2B43',
    },
    timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
    },
    // ซ่อนลายน้ำ TradingView
    watermark: {
        visible: false,
    },
};

// === Series Colors ===
const COLORS = {
    price: '#2962FF',
    sma10: '#e91e63',
    sma50: '#00bcd4',
    sma100: '#ffc107',
    sma200: '#4caf50',
    ema50: '#ff6f00',
    ema100: '#00897b',
    ema200: '#7b1fa2',
    bbUpper: '#64b5f6',
    bbMiddle: '#ffa726',
    bbLower: '#64b5f6',
    fibUp: '#4caf50',
    fibDown: '#ff5722',
};

/**
 * LightweightPriceChart Component
 */
export default function LightweightPriceChart({
    data = [],
    visible = {},
    height = 400,
    fibonacci = null,
    goldenDeathSignals = [],
    highLowPeaks = [],
}) {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const [error, setError] = useState(null);

    // สร้าง key สำหรับ trigger re-render เมื่อ visible เปลี่ยน
    const visibleKey = useMemo(() => {
        return JSON.stringify({
            sma: visible.sma,
            ema: visible.ema,
            bb: visible.bb,
            fib: visible.fib,
            goldenDeath: visible.goldenDeath,
            weeklyHighLow: visible.weeklyHighLow,
        });
    }, [visible.sma, visible.ema, visible.bb, visible.fib, visible.goldenDeath, visible.weeklyHighLow]);

    useEffect(() => {
        // Guard clauses
        if (!chartContainerRef.current) return;
        if (!data || !Array.isArray(data) || data.length === 0) return;

        // Cleanup previous chart ทุกครั้งเมื่อ visibleKey เปลี่ยน
        if (chartRef.current) {
            try {
                chartRef.current.remove();
            } catch (e) {
                // Ignore cleanup errors
            }
            chartRef.current = null;
        }

        try {
            // === แปลงข้อมูลเป็น format ที่ lightweight-charts ต้องการ ===
            const baseTimestamp = Math.floor(new Date('2024-01-01').getTime() / 1000);

            const priceData = data.map((d, index) => ({
                time: baseTimestamp + (index * 86400),
                value: typeof d.close === 'number' ? d.close : 0,
            })).filter(d => d.value > 0);

            if (priceData.length === 0) {
                setError('No valid price data');
                return;
            }

            // === สร้าง Chart ===
            const containerWidth = chartContainerRef.current.clientWidth || 800;

            const chart = createChart(chartContainerRef.current, {
                ...CHART_THEME,
                width: containerWidth,
                height: height,
            });
            chartRef.current = chart;

            // === Main Price Line ===
            const priceSeries = chart.addSeries(LineSeries, {
                color: COLORS.price,
                lineWidth: 2,
                crosshairMarkerVisible: true,
                crosshairMarkerRadius: 4,
                title: 'Price',
                priceLineVisible: false,
            });
            priceSeries.setData(priceData);

            // === Helper function สำหรับเพิ่ม indicator lines ===
            const addLine = (key, color, title, lineWidth = 1.5, lineStyle = 0) => {
                const lineData = data
                    .map((d, i) => ({
                        time: baseTimestamp + (i * 86400),
                        value: d[key],
                    }))
                    .filter(d => typeof d.value === 'number' && Number.isFinite(d.value));

                if (lineData.length > 0) {
                    const series = chart.addSeries(LineSeries, {
                        color,
                        lineWidth,
                        lineStyle,
                        title,
                        priceLineVisible: false,
                    });
                    series.setData(lineData);
                    return series;
                }
                return null;
            };

            // === SMA Lines ===
            if (visible.sma) {
                addLine('sma10', COLORS.sma10, 'SMA 10');
                addLine('sma50', COLORS.sma50, 'SMA 50');
                addLine('sma100', COLORS.sma100, 'SMA 100');
                addLine('sma200', COLORS.sma200, 'SMA 200');
            }

            // === EMA Lines ===
            if (visible.ema) {
                addLine('ema50', COLORS.ema50, 'EMA 50');
                addLine('ema100', COLORS.ema100, 'EMA 100');
                addLine('ema200', COLORS.ema200, 'EMA 200');
            }

            // === Bollinger Bands ===
            if (visible.bb) {
                addLine('bbUpper', COLORS.bbUpper, 'BB Upper', 1, 2);
                addLine('bbMiddle', COLORS.bbMiddle, 'BB Middle', 1.5, 0);
                addLine('bbLower', COLORS.bbLower, 'BB Lower', 1, 2);
            }

            // === Fibonacci Levels ===
            if (visible.fib && fibonacci && Array.isArray(fibonacci.levels)) {
                fibonacci.levels.forEach((level) => {
                    try {
                        priceSeries.createPriceLine({
                            price: level.value,
                            color: level.color || '#ffa000',
                            lineWidth: 1,
                            lineStyle: 2, // dashed
                            axisLabelVisible: true,
                            title: level.level,
                        });
                    } catch (e) {
                        // Ignore if price line fails
                    }
                });
            }

            // === Golden/Death Cross Markers ===
            if (visible.goldenDeath && goldenDeathSignals && goldenDeathSignals.length > 0) {
                try {
                    const markers = goldenDeathSignals
                        .filter(signal => signal && signal.price)
                        .map((signal, index) => {
                            const dataIndex = data.findIndex(d => Math.abs(d.close - signal.price) < 0.01);
                            const time = dataIndex >= 0
                                ? baseTimestamp + (dataIndex * 86400)
                                : baseTimestamp + (index * 86400);

                            return {
                                time,
                                position: signal.type === 'golden' ? 'belowBar' : 'aboveBar',
                                color: signal.type === 'golden' ? '#00e676' : '#ff1744',
                                shape: signal.type === 'golden' ? 'arrowUp' : 'arrowDown',
                                text: signal.type === 'golden' ? 'GC' : 'DC',
                            };
                        })
                        .sort((a, b) => a.time - b.time); // ต้อง sort ตาม time

                    if (markers.length > 0) {
                        priceSeries.setMarkers(markers);
                    }
                } catch (e) {
                    console.warn('Markers error:', e);
                }
            }

            // === High/Low Peaks ===
            if (visible.weeklyHighLow && highLowPeaks && highLowPeaks.length > 0) {
                try {
                    const peakMarkers = highLowPeaks
                        .filter(p => p && p.value)
                        .map((peak, index) => {
                            const dataIndex = data.findIndex(d => Math.abs(d.close - peak.value) < 0.01);
                            const time = dataIndex >= 0
                                ? baseTimestamp + (dataIndex * 86400)
                                : baseTimestamp + (index * 86400);

                            const isHigh = peak.type?.includes('High');
                            return {
                                time,
                                position: isHigh ? 'aboveBar' : 'belowBar',
                                color: isHigh ? '#2962FF' : '#00b0ff',
                                shape: 'circle',
                                text: isHigh ? '▲' : '▼',
                            };
                        })
                        .sort((a, b) => a.time - b.time);

                    // Combine with existing markers if any
                    const existingMarkers = priceSeries.markers?.() || [];
                    const allMarkers = [...existingMarkers, ...peakMarkers].sort((a, b) => a.time - b.time);

                    if (allMarkers.length > 0) {
                        priceSeries.setMarkers(allMarkers);
                    }
                } catch (e) {
                    console.warn('Peak markers error:', e);
                }
            }

            // === Fit Content ===
            chart.timeScale().fitContent();
            setError(null);

            // === Handle Resize ===
            const handleResize = () => {
                if (chartContainerRef.current && chartRef.current) {
                    chartRef.current.applyOptions({
                        width: chartContainerRef.current.clientWidth
                    });
                }
            };
            window.addEventListener('resize', handleResize);

            // === Cleanup ===
            return () => {
                window.removeEventListener('resize', handleResize);
                if (chartRef.current) {
                    try {
                        chartRef.current.remove();
                    } catch (e) {
                        // Ignore
                    }
                    chartRef.current = null;
                }
            };

        } catch (err) {
            console.error('Chart error:', err);
            setError(err.message || 'Failed to create chart');
        }
    }, [data, visibleKey, height, fibonacci, goldenDeathSignals, highLowPeaks]);

    // === Error State ===
    if (error) {
        return (
            <div className="chart-wrapper" style={{
                padding: 40,
                textAlign: 'center',
                color: '#ff5252',
                background: '#1a1a2e',
                borderRadius: 8,
            }}>
                <p>⚠️ Chart Error: {error}</p>
                <p style={{ fontSize: 12, color: '#888' }}>กรุณาลองรีเฟรชหน้าหรือใช้กราฟเดิม</p>
            </div>
        );
    }

    // === Empty State ===
    if (!data || !Array.isArray(data) || data.length === 0) {
        return (
            <div className="chart-wrapper" style={{
                padding: 40,
                textAlign: 'center',
                color: '#888',
                background: '#1a1a2e',
                borderRadius: 8,
            }}>
                No price data available
            </div>
        );
    }

    return (
        <div className="chart-wrapper">
            <h3>📈 Price Action (TradingView Style)</h3>
            <div
                ref={chartContainerRef}
                style={{
                    width: '100%',
                    height: height,
                    borderRadius: '8px',
                    overflow: 'hidden',
                }}
            />
            {/* Legend */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '8px 0',
                fontSize: '12px',
                color: '#d1d4dc',
            }}>
                <span style={{ color: COLORS.price }}>● Price</span>
                {visible.sma && (
                    <>
                        <span style={{ color: COLORS.sma10 }}>● SMA 10</span>
                        <span style={{ color: COLORS.sma50 }}>● SMA 50</span>
                        <span style={{ color: COLORS.sma100 }}>● SMA 100</span>
                        <span style={{ color: COLORS.sma200 }}>● SMA 200</span>
                    </>
                )}
                {visible.ema && (
                    <>
                        <span style={{ color: COLORS.ema50 }}>● EMA 50</span>
                        <span style={{ color: COLORS.ema100 }}>● EMA 100</span>
                        <span style={{ color: COLORS.ema200 }}>● EMA 200</span>
                    </>
                )}
                {visible.bb && (
                    <span style={{ color: COLORS.bbMiddle }}>● Bollinger Bands</span>
                )}
                {visible.fib && (
                    <span style={{ color: '#ffa000' }}>● Fibonacci</span>
                )}
                {visible.goldenDeath && (
                    <span style={{ color: '#00e676' }}>● Golden/Death Cross</span>
                )}
                {visible.weeklyHighLow && (
                    <span style={{ color: '#2962FF' }}>● W-High/Low</span>
                )}
            </div>
        </div>
    );
}
