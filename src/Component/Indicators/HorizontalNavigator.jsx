import React, { useRef, useEffect, useState } from 'react';

export default function HorizontalNavigator({
    totalItems,
    visibleStart,
    visibleEnd,
    onZoomChange, // (newStart, newEnd) => ...
    height = 40
}) {
    const containerRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragAction, setDragAction] = useState(null); // 'move', 'left-resize', 'right-resize'
    const [startX, setStartX] = useState(0);
    const [initialWindow, setInitialWindow] = useState({ start: 0, end: 0 });

    // Calculate percentages for the visible window
    const startPct = totalItems > 0 ? (visibleStart / totalItems) * 100 : 0;
    const endPct = totalItems > 0 ? (visibleEnd / totalItems) * 100 : 100;
    const widthPct = Math.max(endPct - startPct, 1); // Min 1% width to be visible

    const handleMouseDown = (e, action) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragAction(action);
        setStartX(e.clientX);
        setInitialWindow({ start: visibleStart, end: visibleEnd });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging || !containerRef.current || totalItems <= 0) return;

            const rect = containerRef.current.getBoundingClientRect();
            const deltaPixels = e.clientX - startX;

            // Calculate how many items correspond to the pixel movement
            // pixelsPerItem = totalWidth / totalItems
            const pixelsPerItem = rect.width / totalItems;
            const deltaItems = Math.round(deltaPixels / pixelsPerItem);

            if (deltaItems === 0 && dragAction !== 'move') return; // Sensitivity check

            let newStart = initialWindow.start;
            let newEnd = initialWindow.end;
            const minWindowSize = Math.max(10, Math.floor(totalItems * 0.01)); // Min 1% or 10 items

            if (dragAction === 'move') {
                const span = initialWindow.end - initialWindow.start;
                // Shift both start and end
                newStart = initialWindow.start + deltaItems;
                newEnd = newStart + span;

                // Clamp keeping size
                if (newStart < 0) {
                    newStart = 0;
                    newEnd = span;
                }
                if (newEnd > totalItems) {
                    newEnd = totalItems;
                    newStart = totalItems - span;
                }
            } else if (dragAction === 'left-resize') {
                newStart = initialWindow.start + deltaItems;
                // Prevent crossing right side (min size)
                if (newStart > initialWindow.end - minWindowSize) {
                    newStart = initialWindow.end - minWindowSize;
                }
                // Clamp left
                if (newStart < 0) newStart = 0;
            } else if (dragAction === 'right-resize') {
                newEnd = initialWindow.end + deltaItems;
                // Prevent crossing left side (min size)
                if (newEnd < initialWindow.start + minWindowSize) {
                    newEnd = initialWindow.start + minWindowSize;
                }
                // Clamp right
                if (newEnd > totalItems) newEnd = totalItems;
            }

            // De-bounce slightly if needed, but for now direct update
            if (newStart !== visibleStart || newEnd !== visibleEnd) {
                onZoomChange(newStart, newEnd);
            }
        };
        const handleMouseUp = () => {
            setIsDragging(false);
            setDragAction(null);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragAction, startX, initialWindow, totalItems, onZoomChange]);

    return (
        <div
            ref={containerRef}
            style={{
                width: '100%',
                height: height,
                background: 'rgba(10, 15, 25, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                position: 'relative',
                borderRadius: '8px',
                overflow: 'hidden',
                cursor: 'grab',
                marginTop: '16px',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
            onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)'; }}
        >
            {/* Background Track - Mini Chart Placeholder / Grid Lines */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.1, backgroundImage: 'linear-gradient(90deg, transparent 49%, rgba(255,255,255,0.1) 50%, transparent 51%)', backgroundSize: '20px 100%' }}>
            </div>

            {/* The Window Thumb */}
            <div
                style={{
                    position: 'absolute',
                    left: `${startPct}%`,
                    width: `${widthPct}%`,
                    top: 4,
                    bottom: 4,
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid #6366f1',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    transition: isDragging ? 'none' : 'background 0.2s',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
                onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)'; }}
                onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'; }}
            >
                {/* Left Resize Handle */}
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '12px',
                        cursor: 'ew-resize',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'left-resize')}
                >
                    <div style={{ width: '3px', height: '16px', background: 'rgba(255,255,255,0.4)', borderRadius: '2px' }}></div>
                </div>

                {/* Center Grip Indicator */}
                <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '32px',
                    height: '4px',
                    background: 'linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.8), transparent)',
                    borderRadius: '2px',
                    pointerEvents: 'none'
                }} />

                {/* Right Resize Handle */}
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '12px',
                        cursor: 'ew-resize',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'right-resize')}
                >
                    <div style={{ width: '3px', height: '16px', background: 'rgba(255,255,255,0.4)', borderRadius: '2px' }}></div>
                </div>
            </div>
        </div>
    );
}
