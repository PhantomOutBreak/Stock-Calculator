// src/pages/HomePage.jsx

import React, { useState, useMemo, useEffect } from 'react';
import '../css/HomePage.css';
import '../css/App.css';
import StockChart from '../Component/StockChart';
import StockTable from '../Component/StockTable';
import {
  PRESET_RANGES,
  DEFAULT_PRESET_ID,
  getPresetRange,
  calculateDateRangeInDays,
  parseISODate,
  getDefaultRange
} from '../utils/dateRanges';

/**
 * ฟังก์ชันสำหรับดึงข้อมูลประวัติราคาหุ้นจาก Backend API
 * @param {string} symbol - ชื่อย่อหุ้น
 * @param {string} startDate - วันที่เริ่มต้น (YYYY-MM-DD)
 * @param {string} endDate - วันที่สิ้นสุด (YYYY-MM-DD)
 */
async function fetchStockHistory(symbol, startDate, endDate) {
  const ticker = symbol.trim().toUpperCase();
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  
  const query = params.toString();
  const url = `http://localhost:5000/api/stock/history/${ticker}${query ? `?${query}` : ''}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Error ${res.status}: ไม่สามารถดึงข้อมูลได้`);
    }
    return await res.json();
  } catch (error) {
    console.error("Fetch error:", error);
    throw new Error(error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย');
  }
}

function HomePage() {
  // ─── 1. State Initialization ───────────────────────────────────────────────
  
  // Input States
  const [inputSymbol, setInputSymbol] = useState('');
  
  // Date Range Logic
  const preferredRange = getPresetRange('3m');
  const fallbackRange = preferredRange || getDefaultRange() || { start: '', end: '' };
  const initialPresetId = preferredRange ? '3m' : (fallbackRange.start ? DEFAULT_PRESET_ID : null);

  const [startDate, setStartDate] = useState(fallbackRange.start);
  const [endDate, setEndDate] = useState(fallbackRange.end);
  const [selectedPreset, setSelectedPreset] = useState(initialPresetId);

  // Data & Status States
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Display States (Snapshot ของข้อมูลที่กำลังแสดงผลอยู่)
  const [currentSymbol, setCurrentSymbol] = useState('');
  const [displayRange, setDisplayRange] = useState({ start: '', end: '' });
  const [currency, setCurrency] = useState(''); // <-- new: currency inferred from ticker

  // ─── 2. Computed Values (Memoization) ──────────────────────────────────────

  // คำนวณจำนวนวันที่เลือกในฟอร์ม (Real-time)
  const dateRangeInDays = useMemo(
    () => calculateDateRangeInDays(startDate, endDate),
    [startDate, endDate]
  );

  // คำนวณจำนวนวันที่กำลังแสดงผลจริง (หลังจากกด Submit)
  const displayRangeInDays = useMemo(
    () => calculateDateRangeInDays(displayRange.start, displayRange.end),
    [displayRange.start, displayRange.end]
  );

  // หาฟังก์ชันช่วยตัดสินค่าเงินจากสัญลักษณ์ (heuristic)
  const getCurrencyForTicker = (sym) => {
    if (!sym) return '';
    const s = sym.trim().toUpperCase();
    if (s.endsWith('.BK')) return 'THB';
    // ถ้าเป็นสัญลักษณ์สั้น ๆ (ไทยมักเป็น 1-4 อักษร) ให้ถือเป็น THB
    if (/^[A-Z]{1,4}$/.test(s)) return 'THB';
    return 'USD';
  };

  // ฟอร์แมตวันที่สำหรับแสดงผล
  const formatDisplayDate = (isoDate) => {
    if (!isoDate) return '-';
    const parsed = parseISODate(isoDate);
    if (!parsed) return '-';
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}/${m}/${y}`;
  };

  // ─── 3. Event Handlers ─────────────────────────────────────────────────────

  // จัดการเมื่อมีการเปลี่ยนแปลงวันที่เอง (Custom Date Selection)
  const handleDateChange = (type, value) => {
    if (type === 'start') setStartDate(value);
    else setEndDate(value);
    
    // เมื่อผู้ใช้เลือกวันที่เอง ให้ยกเลิกการเลือก Preset
    setSelectedPreset(null);
  };

  // จัดการเมื่อกดปุ่มเลือกช่วงเวลา (Preset Buttons)
  const handlePresetClick = (preset) => {
    const range = preset.getRange();
    setStartDate(range.start);
    setEndDate(range.end);
    setSelectedPreset(preset.id);
  };

  // ฟังก์ชันหลักเมื่อกดปุ่มค้นหา
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    const cleanSymbol = inputSymbol.trim().toUpperCase();
    if (!cleanSymbol) return setError('กรุณากรอกชื่อหุ้น');
    if (!startDate || !endDate) return setError('กรุณาเลือกช่วงวันที่ให้ครบถ้วน');

    const startObj = parseISODate(startDate);
    const endObj = parseISODate(endDate);

    if (!startObj || !endObj) return setError('รูปแบบวันที่ไม่ถูกต้อง');
    if (startObj > endObj) return setError('วันที่เริ่มต้นต้องมาก่อนวันที่สิ้นสุด');

    // Reset Status
    setLoading(true);
    setError('');

    try {
      const data = await fetchStockHistory(cleanSymbol, startDate, endDate);
      
      // ตรวจสอบข้อมูลว่าง
      if (!data || data.length === 0) {
        throw new Error('ไม่พบข้อมูลในช่วงเวลาที่ระบุ');
      }

      // Transform Data (Format Date for Chart/Table)
      const formattedData = data.map(row => ({
        ...row,
        // เก็บ date เดิมไว้สำหรับ sort/filter ถ้าจำเป็น แต่แสดงผลด้วย formatted string
        displayDate: formatDisplayDate(row.date),
        // แปลง date string เป็น object จริงเพื่อให้ Chart ใช้งานง่าย (ถ้า chart lib รองรับ)
        dateObj: new Date(row.date) 
      }));

      setHistory(formattedData);
      setCurrentSymbol(cleanSymbol);
      // ดึงสกุลจาก backend ก่อน แล้ว fallback เป็น heuristic
      try {
        const qRes = await fetch(`http://localhost:5000/api/stock/${cleanSymbol}`);
        if (qRes.ok) {
          const qData = await qRes.json();
          setCurrency(qData.currency || getCurrencyForTicker(cleanSymbol));
        } else {
          setCurrency(getCurrencyForTicker(cleanSymbol));
        }
      } catch (e) {
        setCurrency(getCurrencyForTicker(cleanSymbol));
      }
      setDisplayRange({ start: startDate, end: endDate });

    } catch (err) {
      setError(err.message);
      // setHistory([]); // Optional: จะเคลียร์ข้อมูลเก่าหรือไม่ก็ได้ตาม UX ที่ต้องการ
    } finally {
      setLoading(false);
    }
  };

  // ─── 4. Render Logic ───────────────────────────────────────────────────────

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Stock Price Checker</h1>
        <p className="page-subtitle">
          ตรวจสอบราคาปิดย้อนหลังและวิเคราะห์แนวโน้มหุ้นไทย/ต่างประเทศ ได้ง่ายๆ เพียงปลายนิ้ว
        </p>
      </header>
      
      {/* ─── Search Form Section ─── */}
      <form onSubmit={handleSubmit} className="return-form">
        
        {/* Input Group: Stock Symbol */}
        <div className="input-group">
          <input
            type="text"
            id="stock-symbol"
            placeholder="ชื่อหุ้น (เช่น PTT, AAPL)"
            autoComplete="off"
            value={inputSymbol}
            onChange={e => setInputSymbol(e.target.value)}
            className="main-input"
          />
        </div>

        {/* Date Range Selection Area */}
        <div className="date-range-row">
          <div className="date-label">
            <span>เริ่มต้น</span>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={e => handleDateChange('start', e.target.value)}
            />
          </div>
          <div className="date-label">
            <span>สิ้นสุด</span>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => handleDateChange('end', e.target.value)}
            />
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="preset-buttons">
          {PRESET_RANGES.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`range-button${selectedPreset === preset.id ? ' active' : ''}`}
              onClick={() => handlePresetClick(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Selected Range Summary Info */}
        <div className="range-summary-wrapper">
          <p className="range-summary">
            {formatDisplayDate(startDate)} — {formatDisplayDate(endDate)} 
            <span style={{ opacity: 0.6, marginLeft: '8px' }}>
              ({dateRangeInDays} วัน)
            </span>
          </p>
        </div>

        {/* Submit Action */}
        <div className="submit-group">
          <button 
            type="submit" 
            className="main-btn" 
            disabled={loading || !inputSymbol}
          >
            {loading ? (
              <span className="loading-text">กำลังค้นหาข้อมูล...</span>
            ) : (
              'ดูราคาย้อนหลัง 🔍'
            )}
          </button>
        </div>
      </form>

      {/* ─── Feedback Section ─── */}
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}

      {/* ─── Results Section ─── */}
      {/* เงื่อนไข: มีข้อมูลใน history และไม่ error */}
      {history.length > 0 && !error && (
        <div className={`results-container ${loading ? 'is-refetching' : ''}`}>
          
          {/* Loading Overlay (Semi-transparent) */}
          {loading && (
            <div className="loading-overlay">
              <div className="spinner"></div>
            </div>
          )}
          
          <div className="results-header">
            <h2>
              {currentSymbol} 
              <span style={{ fontSize: '0.6em', opacity: 0.7, marginLeft: '10px' }}>
                ({formatDisplayDate(displayRange.start)} - {formatDisplayDate(displayRange.end)})
              </span>
            </h2>
            
            <div className="result-item">
              <span className="result-label">จำนวนข้อมูล</span>
              <span className="result-value">{history.length} วันทำการ</span>
            </div>
          </div>

          <div className="chart-container">
            <StockChart data={history} currency={currency} />
          </div>
          
          <div className="dividend-table-wrapper" style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--theme-highlight)' }}>ตารางราคาปิดรายวัน</h3>
            <StockTable data={history} currency={currency} />
          </div>
        </div>
      )}

      {/* Initial Loading State (เมื่อยังไม่มีข้อมูล history เลย) */}
      {loading && history.length === 0 && (
        <div className="initial-loading">
          <div className="spinner"></div>
          <p>กำลังดึงข้อมูลตลาดหลักทรัพย์...</p>
        </div>
      )}
    </div>
  );
}

export default HomePage;