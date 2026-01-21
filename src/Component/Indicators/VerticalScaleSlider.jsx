import React from 'react';

export default function VerticalScaleSlider({ scale, onChange, min = 0.1, max = 5.0, step = 0.1 }) {
    // Logic for +/- buttons
    const increment = () => onChange(Math.min(max, scale + step));
    const decrement = () => onChange(Math.max(min, scale - step));
    const reset = () => onChange(1.0);

    const buttonStyle = {
        width: '28px',
        height: '28px',
        cursor: 'pointer',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: '#cbd5e1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    };

    const handleMouseEnter = (e) => {
        e.target.style.background = 'rgba(34, 211, 238, 0.1)';
        e.target.style.borderColor = 'rgba(34, 211, 238, 0.4)';
        e.target.style.color = '#fff';
        e.target.style.transform = 'translateY(-2px)';
        e.target.style.boxShadow = '0 4px 12px rgba(34, 211, 238, 0.2)';
    };

    const handleMouseLeave = (e) => {
        e.target.style.background = 'rgba(255, 255, 255, 0.05)';
        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        e.target.style.color = '#cbd5e1';
        e.target.style.transform = 'none';
        e.target.style.boxShadow = 'none';
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '12px 6px',
            background: 'rgba(10, 15, 25, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            height: '100%',
            justifyContent: 'center',
            gap: '12px',
            backdropFilter: 'blur(10px)'
        }}>
            <div style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#94a3b8',
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
            }}>
                Scale
            </div>

            <button
                onClick={increment}
                style={buttonStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                title="Zoom In (Height)"
            >
                +
            </button>

            <div style={{ position: 'relative', height: '180px', display: 'flex', alignItems: 'center' }}>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={scale}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    className="vertical-slider-input" // Using a class for pseudo-elements if needed, but styling inline for now
                    style={{
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                        appearance: 'slider-vertical',
                        width: '6px',
                        height: '100%',
                        margin: 0,
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '3px',
                        cursor: 'ns-resize',
                        accentColor: '#22d3ee'
                    }}
                />
            </div>

            <button
                onClick={decrement}
                style={buttonStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                title="Zoom Out (Height)"
            >
                -
            </button>

            <button
                onClick={reset}
                title="Reset to 1x"
                style={{
                    ...buttonStyle,
                    fontSize: '10px',
                    height: 'auto',
                    padding: '4px 6px',
                    width: '100%',
                    marginTop: '4px',
                    borderRadius: '8px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderColor: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8'
                }}
                onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(99, 102, 241, 0.2)';
                    e.target.style.color = '#fff';
                    e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                    e.target.style.color = '#818cf8';
                    e.target.style.transform = 'none';
                }}
            >
                1x
            </button>

            <div style={{ fontSize: '10px', color: '#22d3ee', fontWeight: '600', fontFamily: 'monospace' }}>
                {scale.toFixed(1)}x
            </div>
        </div>
    );
}
