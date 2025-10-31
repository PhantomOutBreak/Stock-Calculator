// src/pages/HomePage.jsx

import React, { useState } from 'react';
import '../css/HomePage.css';
import '../css/App.css';
import StockChart from '../Component/StockChart';
import StockTable from '../Component/StockTable';

// ฟังก์ชัน fetch ข้อมูลหุ้น (เหมือนเดิม)
async function fetchStockHistory(symbol, days) {
  // ส่งสัญลักษณ์ตามที่ผู้ใช้กรอก (ปล่อย backend ตัดสินใจ .BK)
  const ticker = symbol.trim().toUpperCase();

  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - days);
  const startDateString = startDate.toISOString().split('T')[0];

  const url = `http://localhost:5000/api/stock/history/${ticker}?startDate=${startDateString}`;

  const res = await fetch(url);
  if (!res.ok) {
    let err;
    try {
      err = await res.json();
    } catch {
      throw new Error('เกิดข้อผิดพลาดในการเชื่อมต่อหรือข้อมูลไม่ถูกต้อง');
    }
    throw new Error(err.error || 'เกิดข้อผิดพลาด');
  }
  return await res.json();
}

function HomePage() {
  // --- State Management (เหมือนเดิม) ---
  const [inputSymbol, setInputSymbol] = useState('');
  const [days, setDays] = useState(90);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSymbol, setCurrentSymbol] = useState('');
  const [displayDays, setDisplayDays] = useState(90);

  // --- Handlers ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // ⭐ 1. ไม่ล้างข้อมูลเก่า: เอาบรรทัด setHistory([]) และ setCurrentSymbol('') ออก
    try {
      const data = await fetchStockHistory(inputSymbol, days);
      // เมื่อได้ข้อมูลใหม่แล้วค่อย set ทีเดียว
      setHistory(data.map(row => ({
        ...row,
        date: row.date ? new Date(row.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year:'numeric' }) : '-'
      })));
      setCurrentSymbol(inputSymbol.trim().toUpperCase());
      setDisplayDays(days);
    } catch (err) {
      setError(err.message);
      setHistory([]); // หากเกิด error ให้ล้างข้อมูลเก่าทิ้ง
    }
    setLoading(false);
  };

  return (
    <div className="page-container">
      <h1>📊 Stock Price Checker</h1>
  <p>กรุณากรอกชื่อย่อหุ้น (ไทย/ต่างประเทศ) เพื่อดูราคาปิดย้อนหลังตามจำนวนวันที่กำหนด</p>
      
      {/* --- Form (เหมือนเดิม) --- */}
      <form onSubmit={handleSubmit} className="stock-form">
          <div className="form-group">
              <label className="stockname-label" htmlFor="sname">ชื่อหุ้น:</label>
              <input type="text" id="sname" className="stockname-input" placeholder="เช่น PTT, AOT" autoComplete="off" value={inputSymbol} onChange={e => setInputSymbol(e.target.value)} />
          </div>
          <div className="form-group">
              <label className="stockname-label" htmlFor="days">จำนวนวันย้อนหลัง:</label>
              <input type="number" id="days" className="stockname-input" value={days} onChange={e => setDays(Math.max(1, parseInt(e.target.value) || 1))} min="1" max="730" />
          </div>
          <div className="form-group">
          <label className="stockname-label" htmlFor="days">กดผุ่มเพื่อยืนยัน:</label>
          <button type="submit" className="primary-button" disabled={loading || !inputSymbol}>
              {loading ? 'กำลังโหลด...' : 'ดูราคาย้อนหลัง'}
          </button>
          </div>
      </form>

      {/* ⭐ 2. ปรับปรุงการแสดงผล Error และ Loading */}
      {/* แสดง Error ด้านบนสุดเสมอถ้ามี */}
      {error && <div className="error-message">{error}</div>}

      {/* --- ส่วนแสดงผลลัพธ์ --- */}
      {/* เงื่อนไขเปลี่ยนเป็น: ถ้ามีข้อมูลใน history ให้แสดง container นี้เสมอ
        แต่จะเพิ่ม class 'is-refetching' เข้าไปเมื่อกำลัง loading
      */}
      {history.length > 0 && !error && (
        <div className={`results-container ${loading ? 'is-refetching' : ''}`}>
          {/* แสดง Spinner ทับเมื่อกำลัง refetch */}
          {loading && <div className="loading-spinner-overlay"></div>}
          
          <h2>
            ราคาปิดย้อนหลัง {displayDays} วัน ({currentSymbol})
          </h2>
          <div className="chart-container">
            <StockChart data={history} />
          </div>
          <StockTable data={history} />
        </div>
      )}

      {/* แสดง Spinner เฉพาะตอนโหลดครั้งแรก (ที่ยังไม่มีข้อมูลใน history) */}
      {loading && history.length === 0 && <div className="loading-spinner"></div>}
    </div>
  );
}

export default HomePage;
