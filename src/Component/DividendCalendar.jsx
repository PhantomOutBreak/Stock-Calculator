import React, { useMemo, useState } from 'react';
import '../css/DividendCalendar.css';

/**
 * DividendCalendar - แสดงปฏิทินปันผลแบบ Month View
 * @param {Object} props
 * @param {Array} props.events - รายการเหตุการณ์ปันผล [{ date: 'YYYY-MM-DD', amountPerShare, currency, ... }]
 * @param {string} props.currency - สกุลเงินหลัก
 */
function DividendCalendar({ events = [], currency = '' }) {
    const today = new Date();
    const [currentYear, setCurrentYear] = useState(today.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(today.getMonth());

    // สร้าง Map สำหรับเข้าถึง events ตามวันที่ได้เร็ว
    const eventMap = useMemo(() => {
        const map = new Map();
        for (const ev of events) {
            if (ev.date) {
                const key = ev.date; // format: YYYY-MM-DD
                if (!map.has(key)) {
                    map.set(key, []);
                }
                map.get(key).push(ev);
            }
        }
        return map;
    }, [events]);

    // หาจำนวนวันในเดือน
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // หาวันแรกของเดือนเริ่มที่วันไหนในสัปดาห์ (0 = Sunday)
    const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

    // สร้าง Array ของวันที่ในเดือน
    const calendarDays = useMemo(() => {
        const days = [];
        // เติมช่องว่างก่อนวันแรกของเดือน
        for (let i = 0; i < firstDayOfWeek; i++) {
            days.push(null);
        }
        // เติมวันที่จริง
        for (let d = 1; d <= daysInMonth; d++) {
            days.push(d);
        }
        return days;
    }, [currentYear, currentMonth, daysInMonth, firstDayOfWeek]);

    // Navigation functions
    const goToPrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear((y) => y - 1);
        } else {
            setCurrentMonth((m) => m - 1);
        }
    };

    const goToNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear((y) => y + 1);
        } else {
            setCurrentMonth((m) => m + 1);
        }
    };

    // ชื่อเดือนภาษาไทย
    const monthNames = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    // Helper: สร้าง key วันที่แบบ ISO
    const toDateKey = (day) => {
        if (!day) return null;
        const m = String(currentMonth + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${currentYear}-${m}-${d}`;
    };

    // Format number
    const formatNumber = (value) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        }).format(value);
    };

    return (
        <div className="dividend-calendar">
            <div className="calendar-header">
                <button className="calendar-nav-btn" onClick={goToPrevMonth} aria-label="เดือนก่อนหน้า">
                    ‹
                </button>
                <h3 className="calendar-title">
                    {monthNames[currentMonth]} {currentYear + 543} {/* แสดงปี พ.ศ. */}
                </h3>
                <button className="calendar-nav-btn" onClick={goToNextMonth} aria-label="เดือนถัดไป">
                    ›
                </button>
            </div>

            <div className="calendar-grid">
                {/* Header: ชื่อวัน */}
                {dayNames.map((name) => (
                    <div key={name} className="calendar-day-name">
                        {name}
                    </div>
                ))}

                {/* Body: วันที่ */}
                {calendarDays.map((day, idx) => {
                    const dateKey = toDateKey(day);
                    const dayEvents = dateKey ? eventMap.get(dateKey) : null;
                    const hasDividend = dayEvents && dayEvents.length > 0;

                    const isToday = () => {
                        if (!day) return false;
                        return (
                            day === today.getDate() &&
                            currentMonth === today.getMonth() &&
                            currentYear === today.getFullYear()
                        );
                    };

                    return (
                        <div
                            key={idx}
                            className={`calendar-cell ${day ? '' : 'empty'} ${hasDividend ? 'has-dividend' : ''} ${isToday() ? 'is-today' : ''}`}
                            title={
                                hasDividend
                                    ? dayEvents
                                        .map(
                                            (ev) =>
                                                `${formatNumber(ev.amountPerShare)} ${ev.currency || currency}`
                                        )
                                        .join(', ')
                                    : ''
                            }
                        >
                            {day && (
                                <>
                                    <span className="day-number">{day}</span>
                                    {hasDividend && (
                                        <div className="dividend-indicator">
                                            <span className="dividend-dot"></span>
                                            <div className="dividend-amount" title={`${formatNumber(dayEvents[0].amountPerShare)} ${dayEvents[0].currency || currency}`}>
                                                {formatNumber(dayEvents[0].amountPerShare)}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="calendar-legend">
                <span className="legend-item">
                    <span className="dividend-dot"></span> วันที่มีการจ่ายปันผล
                </span>
            </div>
        </div>
    );
}

export default DividendCalendar;
