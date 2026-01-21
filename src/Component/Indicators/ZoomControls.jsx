import React from 'react';

/**
 * ZoomControls - ปุ่มควบคุม Zoom แบบง่าย ๆ (Horizontal)
 * 
 * Props:
 * - totalItems: จำนวนข้อมูลทั้งหมด
 * - visibleStart: index เริ่มต้นที่แสดง
 * - visibleEnd: index สิ้นสุดที่แสดง
 * - onZoomChange: callback (newStart, newEnd) => void
 * - zoomStep: (optional) จำนวน % ที่ zoom ต่อครั้ง (default: 20%)
 * - minWindow: (optional) ขนาดหน้าต่างขั้นต่ำ (default: 10)
 */
export default React.memo(function ZoomControls({
    totalItems,
    visibleStart,
    visibleEnd,
    onZoomChange,
    zoomStep = 0.2,
    minWindow = 10
}) {
    const currentRange = visibleEnd - visibleStart;
    const isFullyZoomedOut = visibleStart === 0 && visibleEnd === totalItems;
    const isFullyZoomedIn = currentRange <= minWindow;

    // Zoom In: ลดจำนวนข้อมูลที่แสดง (ดูน้อยลง = ซูมเข้า)
    const handleZoomIn = () => {
        if (totalItems === 0 || isFullyZoomedIn) return;

        const reduction = Math.max(1, Math.round(currentRange * zoomStep));
        const leftReduction = Math.floor(reduction / 2);
        const rightReduction = reduction - leftReduction;

        let newStart = visibleStart + leftReduction;
        let newEnd = visibleEnd - rightReduction;

        // Ensure min window size
        if (newEnd - newStart < minWindow) {
            const center = Math.round((newStart + newEnd) / 2);
            newStart = Math.max(0, center - Math.floor(minWindow / 2));
            newEnd = Math.min(totalItems, newStart + minWindow);
        }

        onZoomChange(newStart, newEnd);
    };

    // Zoom Out: เพิ่มจำนวนข้อมูลที่แสดง (ดูมากขึ้น = ซูมออก)
    const handleZoomOut = () => {
        if (totalItems === 0 || isFullyZoomedOut) return;

        const expansion = Math.max(1, Math.round(currentRange * zoomStep));
        const leftExpansion = Math.floor(expansion / 2);
        const rightExpansion = expansion - leftExpansion;

        let newStart = visibleStart - leftExpansion;
        let newEnd = visibleEnd + rightExpansion;

        // Clamp to data bounds
        if (newStart < 0) {
            newEnd = Math.min(totalItems, newEnd - newStart);
            newStart = 0;
        }
        if (newEnd > totalItems) {
            newStart = Math.max(0, newStart - (newEnd - totalItems));
            newEnd = totalItems;
        }

        onZoomChange(newStart, newEnd);
    };

    // Reset: แสดงข้อมูลทั้งหมด
    const handleReset = () => {
        onZoomChange(0, totalItems);
    };

    // Pan Left: เลื่อนไปทางซ้าย (ข้อมูลเก่า)
    const handlePanLeft = () => {
        if (visibleStart === 0) return;
        const panAmount = Math.max(1, Math.round(currentRange * 0.3));
        const newStart = Math.max(0, visibleStart - panAmount);
        const newEnd = newStart + currentRange;
        onZoomChange(newStart, Math.min(totalItems, newEnd));
    };

    // Pan Right: เลื่อนไปทางขวา (ข้อมูลใหม่)
    const handlePanRight = () => {
        if (visibleEnd === totalItems) return;
        const panAmount = Math.max(1, Math.round(currentRange * 0.3));
        const newEnd = Math.min(totalItems, visibleEnd + panAmount);
        const newStart = newEnd - currentRange;
        onZoomChange(Math.max(0, newStart), newEnd);
    };

    const buttonStyle = {
        padding: '8px 14px',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(255, 255, 255, 0.05)',
        color: '#cbd5e1',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px'
    };

    const disabledStyle = {
        ...buttonStyle,
        opacity: 0.4,
        cursor: 'not-allowed'
    };

    const handleMouseEnter = (e) => {
        if (e.target.disabled) return;
        e.target.style.background = 'rgba(99, 102, 241, 0.15)';
        e.target.style.borderColor = 'rgba(99, 102, 241, 0.4)';
        e.target.style.color = '#fff';
        e.target.style.transform = 'translateY(-1px)';
    };

    const handleMouseLeave = (e) => {
        e.target.style.background = 'rgba(255, 255, 255, 0.05)';
        e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        e.target.style.color = '#cbd5e1';
        e.target.style.transform = 'none';
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'rgba(10, 15, 25, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            backdropFilter: 'blur(10px)'
        }}>
            {/* Pan Left */}
            <button
                onClick={handlePanLeft}
                disabled={visibleStart === 0}
                style={visibleStart === 0 ? disabledStyle : buttonStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                title="เลื่อนซ้าย (ข้อมูลเก่า)"
            >
                ◀
            </button>

            {/* Zoom Out */}
            <button
                onClick={handleZoomOut}
                disabled={isFullyZoomedOut}
                style={isFullyZoomedOut ? disabledStyle : buttonStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                title="Zoom Out (ดูข้อมูลมากขึ้น)"
            >
                🔍−
            </button>

            {/* Reset */}
            <button
                onClick={handleReset}
                style={{
                    ...buttonStyle,
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderColor: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8'
                }}
                onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(99, 102, 241, 0.2)';
                    e.target.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(99, 102, 241, 0.1)';
                    e.target.style.color = '#818cf8';
                }}
                title="รีเซ็ต (ดูทั้งหมด)"
            >
                ⟲ Reset
            </button>

            {/* Zoom In */}
            <button
                onClick={handleZoomIn}
                disabled={isFullyZoomedIn}
                style={isFullyZoomedIn ? disabledStyle : buttonStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                title="Zoom In (ดูข้อมูลละเอียดขึ้น)"
            >
                🔍+
            </button>

            {/* Pan Right */}
            <button
                onClick={handlePanRight}
                disabled={visibleEnd === totalItems}
                style={visibleEnd === totalItems ? disabledStyle : buttonStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                title="เลื่อนขวา (ข้อมูลใหม่)"
            >
                ▶
            </button>

            {/* Info */}
            <span style={{
                marginLeft: '8px',
                fontSize: '11px',
                color: '#94a3b8',
                fontFamily: 'monospace'
            }}>
                {visibleStart + 1}–{visibleEnd} / {totalItems}
            </span>
        </div>
    );
});
