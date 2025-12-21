// src/pages/CalculatorPage.jsx

import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import '../css/App.css';
import '../css/CalculatorPage.css';
import StockChart from '../Component/StockChart';
import {
  PRESET_RANGES,
  DEFAULT_PRESET_ID,
  getPresetRange,
  calculateDateRangeInDays,
  parseISODate
} from '../utils/dateRanges';
import { apiFetch } from '../utils/api';

// --- Default ค่าเริ่มต้น ---
const DEFAULT_COMMISSION = 0.00157; // ค่าคอมมิชชั่นมาตรฐาน
const DEFAULT_VAT = 0.07;           // VAT มาตรฐาน
const DEFAULT_RISK_PERCENT = 2;     // % ความเสี่ยงเริ่มต้น

function CalculatorPage() {
  // --- State Management ---
  const [budget, setBudget] = useState(100000); // งบประมาณที่ใช้ลงทุน
  const [commissionRate, setCommissionRate] = useState(DEFAULT_COMMISSION); // ค่าคอมมิชชั่น
  const [vatRate, setVatRate] = useState(DEFAULT_VAT); // VAT
  const [riskPercent, setRiskPercent] = useState(DEFAULT_RISK_PERCENT); // % ความเสี่ยง
  const [buyPrice, setBuyPrice] = useState(''); // ราคาซื้อ
  const [stopLossPrice, setStopLossPrice] = useState(''); // ราคาตัดขาดทุน
  const [sellPrice, setSellPrice] = useState(''); // ราคาเป้าหมายขาย
  const [inputSymbol, setInputSymbol] = useState(''); // ชื่อหุ้น
  const initialRange = getPresetRange(DEFAULT_PRESET_ID) || { start: '', end: '' };
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [selectedPreset, setSelectedPreset] = useState(initialRange.start ? DEFAULT_PRESET_ID : null);
  const [history, setHistory] = useState([]); // ข้อมูลราคาหุ้นย้อนหลัง
  const [currency, setCurrency] = useState(''); // display currency (what UI shows)
  const [originalCurrency, setOriginalCurrency] = useState(''); // currency from backend (original)
  const [fxRate, setFxRate] = useState(1); // <-- FX rate used to convert to THB
  const [error, setError] = useState(''); // error message

  // --- Logic: คำนวณราคาที่ควรซื้อ, stoploss, เป้าหมายขาย ---
  // 1. คำนวณ stoploss จาก %risk ของงบประมาณ
  const calculatedStopLoss = useMemo(() => {
    const buy = parseFloat(buyPrice);
    const risk = parseFloat(riskPercent);
    if (!buy || !risk || risk <= 0) return '';
    // สมมติความเสี่ยงคิดเป็น % จากราคาซื้อ
    return (buy * (1 - risk / 100)).toFixed(2);
  }, [buyPrice, riskPercent]);

  // 2. คำนวณราคาขายเป้าหมาย (เช่น RR = 2)
  const calculatedSellPrice = useMemo(() => {
    const buy = parseFloat(buyPrice);
    const stop = parseFloat(stopLossPrice || calculatedStopLoss);
    if (!buy || !stop || buy <= stop) return '';
    // RR = 2 (กำไรต่อความเสี่ยง)
    const rr = 2;
    const profitPerShare = (buy - stop) * rr;
    return (buy + profitPerShare).toFixed(2);
  }, [buyPrice, stopLossPrice, calculatedStopLoss]);

  // 3. คำนวณจำนวนหุ้นที่ควรซื้อ (risk amount / risk per share)
  const sharesToBuy = useMemo(() => {
    const buy = parseFloat(buyPrice);
    const stop = parseFloat(stopLossPrice || calculatedStopLoss);
    const risk = parseFloat(riskPercent);
    const totalBudget = parseFloat(budget);
    if (!buy || !stop || !risk || !totalBudget || buy <= stop) return 0;
    const riskAmount = (risk / 100) * totalBudget;
    const riskPerShare = buy - stop;
    if (riskPerShare <= 0) return 0;
    return Math.floor(riskAmount / riskPerShare);
  }, [buyPrice, stopLossPrice, calculatedStopLoss, riskPercent, budget]);

  // --- Calculations ---
  const calculations = useMemo(() => {
    const buy = parseFloat(buyPrice);
    const sell = parseFloat(sellPrice || calculatedSellPrice);
    const stop = parseFloat(stopLossPrice || calculatedStopLoss);
    const totalBudget = parseFloat(budget);
    const commission = parseFloat(commissionRate);
    const vat = parseFloat(vatRate);

    // ตรวจสอบ input ว่าครบและถูกต้องหรือไม่
    if (!buy || !sell || !stop || !totalBudget || !commission || !vat || buy <= stop || sell <= buy) {
      return null;
    }

    // 1. คำนวณค่าธรรมเนียมและ VAT
    const shares = sharesToBuy;
    if (shares <= 0) return { error: "งบประมาณหรือความเสี่ยงไม่เพียงพอที่จะซื้ออย่างน้อย 1 หุ้น" };

    const actualBuyValue = shares * buy;
    const feeBuy = (actualBuyValue * commission) * (1 + vat);
    const totalCost = actualBuyValue + feeBuy;

    // ขาย
    const grossSellValue = shares * sell;
    const feeSell = (grossSellValue * commission) * (1 + vat);
    const netSellValue = grossSellValue - feeSell;
    const netProfit = netSellValue - totalCost;
    const profitPercent = (netProfit / totalCost) * 100;

    // Stop loss
    const grossStopValue = shares * stop;
    const feeStop = (grossStopValue * commission) * (1 + vat);
    const netStopValue = grossStopValue - feeStop;
    const netLoss = netStopValue - totalCost;
    const lossPercent = (netLoss / totalCost) * 100;

    // RR
    const riskRewardRatio = (sell - buy) / (buy - stop);

    // คืนผลลัพธ์ทั้งหมด
    return {
      sharesToBuy: shares,
      totalCost,
      riskRewardRatio,
      profitResult: { netProfit, profitPercent },
      stopLossResult: { netLoss, lossPercent },
      feeBuy,
      feeSell,
      feeStop,
      stopLossPrice: stop,
      sellPrice: sell,
    };
  }, [buyPrice, sellPrice, stopLossPrice, budget, commissionRate, vatRate, calculatedSellPrice, calculatedStopLoss, sharesToBuy]);

  // เตรียมข้อมูลสำหรับกราฟ พร้อมจุด marker
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    // แปลงวันที่เป็น string สำหรับแกน X
    return history.map(row => ({
      ...row,
      date: row.date
        ? new Date(row.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
        : '-',
      isBuy: parseFloat(buyPrice) === row.close,
      isSell: parseFloat(sellPrice) === row.close,
      isStop: parseFloat(stopLossPrice) === row.close,
    }));
  }, [history, buyPrice, sellPrice, stopLossPrice]);

  // --- Helper Functions ---
  const formatNumber = (num, digits = 2) => num ? num.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '0.00';

  const formatDisplayDate = (isoDate) => {
    if (!isoDate) return '-';
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const dateRangeInDays = useMemo(() => calculateDateRangeInDays(startDate, endDate), [startDate, endDate]);

  const getRRClassName = (rr) => {
    if (!rr) return '';
    if (rr >= 2) return 'rr-good';
    if (rr >= 1) return 'rr-ok';
    return 'rr-bad';
  };

  // --- Event Handlers ---
  // ดึงข้อมูลราคาหุ้นย้อนหลังจาก backend เมื่อ submit ฟอร์ม
  const handleFetchHistory = async (e) => {
    e.preventDefault();
    setError('');
    if (!inputSymbol.trim()) {
      setError('กรุณากรอกชื่อหุ้น');
      return;
    }
    if (!startDate || !endDate) {
      setError('กรุณาเลือกช่วงวันที่ให้ครบ');
      return;
    }
    const start = parseISODate(startDate);
    const end = parseISODate(endDate);
    if (!start || !end) {
      setError('รูปแบบวันที่ไม่ถูกต้อง');
      return;
    }
    if (start > end) {
      setError('วันที่เริ่มต้นต้องมาก่อนหรือเท่ากับวันที่สิ้นสุด');
      return;
    }

    try {
      // 1) ตรวจสกุลหุ้นจาก quote endpoint ก่อน เพื่อเตรียม FX หากจำเป็น
      const t = inputSymbol.trim().toUpperCase();
      let detectedCurrency = '';
      let rate = 1;
      try {
        const q = await apiFetch(`/api/stock/${t}`);
        detectedCurrency = q.currency || (t.endsWith('.BK') || /^[A-Z0-9]{1,3}$/.test(t) ? 'THB' : 'USD');
      } catch (e) {
        detectedCurrency = (t.endsWith('.BK') || /^[A-Z0-9]{1,3}$/.test(t) ? 'THB' : 'USD');
      }
      // 2) ถ้าเป็น USD ให้ดึงอัตรา USD->THB จาก backend
      if (detectedCurrency === 'USD') {
        try {
          const fx = await apiFetch('/api/forex/usd-thb');
          rate = Number(fx.rate) || rate;
        } catch (e) {
          // fallback keep rate = 1
        }
      }
      setOriginalCurrency(detectedCurrency);
      // ถ้าแปลงเป็น THB ให้แสดงผลเป็น THB (UI) แต่เก็บ originalCurrency แยกไว้
      const displayCurrency = detectedCurrency === 'USD' ? 'THB' : (detectedCurrency || 'THB');
      setCurrency(displayCurrency);
      setFxRate(rate);

      // 3) ดึง history แล้วแปลงราคาทุกตัวเป็น THB (เก็บ originalClose)
      const data = await fetchStockHistory(t, startDate, endDate);
      const converted = (Array.isArray(data) ? data : []).map(row => {
        const orig = typeof row.close === 'number' ? Number(row.close) : null;
        const conv = (orig !== null && detectedCurrency === 'USD') ? Number((orig * rate).toFixed(4)) : orig;
        return { ...row, originalClose: orig, originalCurrency: detectedCurrency, close: conv };
      });
      setHistory(converted);
      if (data.length > 0) {
        // ตั้งราคาซื้อ/SL/TP เป็นค่าที่แปลงเป็น THB แล้ว (ถ้ามี)
        const last = converted[converted.length - 1];
        setBuyPrice(last?.close ?? '');
        setStopLossPrice(Math.min(...converted.map(d => d.close)));
        setSellPrice(Math.max(...converted.map(d => d.close)));
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // --- Render ---
  return (
    <div className="page-container calculator-page">
      <h1>Equity Trade Calculator</h1>
      <p>
        วางแผนการซื้อขาย, ประเมินความเสี่ยง, คำนวณ Risk/Reward, จำนวนหุ้นที่ควรซื้อ, ค่าธรรมเนียม และราคาที่ควรตั้ง Stop Loss/เป้าหมายขาย <br />
        <span style={{ color: '#f7ca18', fontWeight: 600 }}>สามารถปรับค่าธรรมเนียมและ % ความเสี่ยงได้เอง</span>
      </p>

      {/* --- Input Form --- */}
      <div className="calculator-form">
        {/* ช่องกรอกงบประมาณ */}
        <div className="form-group">
          <label htmlFor="budget">งบประมาณ (บาท)</label>
          <input id="budget" type="number" className="stockname-input" value={budget} onChange={e => setBudget(e.target.value)} placeholder="100,000" />
        </div>
        {/* ช่องกรอกค่าคอมมิชชั่น */}
        <div className="form-group">
          <label htmlFor="commission">ค่าคอมมิชชั่น (%)</label>
          <input id="commission" type="number" step="0.0001" className="stockname-input" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} placeholder="0.00157" />
        </div>
        {/* ช่องกรอก VAT */}
        <div className="form-group">
          <label htmlFor="vat">VAT (%)</label>
          <input id="vat" type="number" step="0.01" className="stockname-input" value={vatRate} onChange={e => setVatRate(e.target.value)} placeholder="0.07" />
        </div>
        {/* ช่องกรอก % ความเสี่ยง */}
        <div className="form-group">
          <label htmlFor="riskPercent">% ความเสี่ยงต่อเทรด</label>
          <input id="riskPercent" type="number" step="0.1" className="stockname-input" value={riskPercent} onChange={e => setRiskPercent(e.target.value)} placeholder="2" />
          <span style={{ fontSize: '0.9em', color: '#bfc9d1' }}>เช่น 2% ของงบประมาณ</span>
        </div>
        {/* ช่องกรอกราคาซื้อ */}
        <div className="form-group">
          <label htmlFor="buyPrice">ราคาเข้าซื้อ {originalCurrency ? `(${originalCurrency} → THB @ ${fxRate.toFixed(4)})` : '(บาท)'}</label>
          <input
            id="buyPrice"
            type="number"
            className="stockname-input"
            value={buyPrice}
            onChange={e => {
              const v = e.target.value;
              const n = v === '' ? '' : Number(v);
              if (v === '' || Number.isNaN(n)) return setBuyPrice('');
              const conv = currency === 'USD' ? Number((n * fxRate).toFixed(4)) : n;
              setBuyPrice(conv);
            }}
            placeholder={currency ? `ใส่เป็น ${currency} จะถูกแปลงเป็น THB` : '10.50'}
            required
          />
        </div>
        {/* ช่องกรอกราคาตัดขาดทุน */}
        <div className="form-group">
          <label htmlFor="stopLossPrice">ราคาตัดขาดทุน (SL)</label>
          <input
            id="stopLossPrice"
            type="number"
            className="stockname-input"
            value={stopLossPrice || calculatedStopLoss}
            onChange={e => {
              const v = e.target.value;
              const n = v === '' ? '' : Number(v);
              if (v === '' || Number.isNaN(n)) return setStopLossPrice('');
              const conv = currency === 'USD' ? Number((n * fxRate).toFixed(4)) : n;
              setStopLossPrice(conv);
            }}
            placeholder="คำนวณอัตโนมัติ"
          />
          <span style={{ fontSize: '0.9em', color: '#bfc9d1' }}>คำนวณจาก % ความเสี่ยง</span>
        </div>
        {/* ช่องกรอกราคาเป้าหมายขาย */}
        <div className="form-group">
          <label htmlFor="sellPrice">ราคาเป้าหมาย (TP)</label>
          <input
            id="sellPrice"
            type="number"
            className="stockname-input"
            value={sellPrice || calculatedSellPrice}
            onChange={e => {
              const v = e.target.value;
              const n = v === '' ? '' : Number(v);
              if (v === '' || Number.isNaN(n)) return setSellPrice('');
              const conv = currency === 'USD' ? Number((n * fxRate).toFixed(4)) : n;
              setSellPrice(conv);
            }}
            placeholder="คำนวณอัตโนมัติ"
          />
          <span style={{ fontSize: '0.9em', color: '#bfc9d1' }}>RR = 2 เท่า</span>
        </div>
      </div>

      {/* --- Results --- */}
      {calculations && !calculations.error && (
        <div className="results-container">
          <h2>สรุปแผนการเทรด</h2>
          <div className="profit-loss-section">
            <h3>ภาพรวมการเทรด</h3>
            <div className="indicator-card-grid">
              {/* จำนวนหุ้นที่ควรซื้อ */}
              <div className="indicator-card">
                <h3>จำนวนหุ้นที่ควรซื้อ</h3>
                <p className="indicator-value">{calculations.sharesToBuy.toLocaleString()}</p>
                <span>หุ้น</span>
              </div>
              {/* เงินลงทุนทั้งหมด */}
              <div className="indicator-card">
                <h3>เงินลงทุนทั้งหมด</h3>
                <p className="indicator-value">{formatNumber(calculations.totalCost)}</p>
                <span>บาท (รวมค่าธรรมเนียม)</span>
              </div>
              {/* Risk:Reward Ratio */}
              <div className={`indicator-card ${getRRClassName(calculations.riskRewardRatio)}`}>
                <h3>Risk:Reward Ratio</h3>
                <p className="indicator-value">1 : {formatNumber(calculations.riskRewardRatio)}</p>
                <span>(เป้าหมาย &gt; 1.5)</span>
              </div>
            </div>
          </div>
          <div className="profit-loss-section">
            <h3>ผลลัพธ์ที่เป็นไปได้</h3>
            <div className="indicator-card-grid">
              {/* กำไรเป้าหมาย */}
              <div className="indicator-card">
                <h3>กำไรเป้าหมาย</h3>
                <p className="indicator-value text-success">+{formatNumber(calculations.profitResult.netProfit)}</p>
                <span>({formatNumber(calculations.profitResult.profitPercent)}%)</span>
              </div>
              {/* ขาดทุนสูงสุด (SL) */}
              <div className="indicator-card">
                <h3>ขาดทุนสูงสุด (SL)</h3>
                <p className="indicator-value text-danger">{formatNumber(calculations.stopLossResult.netLoss)}</p>
                <span>({formatNumber(calculations.stopLossResult.lossPercent)}%)</span>
              </div>
              {/* ค่าธรรมเนียมซื้อ */}
              <div className="indicator-card">
                <h3>ค่าธรรมเนียมซื้อ</h3>
                <p className="indicator-value">{formatNumber(calculations.feeBuy)}</p>
                <span>บาท</span>
              </div>
              {/* ค่าธรรมเนียมขาย */}
              <div className="indicator-card">
                <h3>ค่าธรรมเนียมขาย</h3>
                <p className="indicator-value">{formatNumber(calculations.feeSell)}</p>
                <span>บาท</span>
              </div>
              {/* ค่าธรรมเนียม SL */}
              <div className="indicator-card">
                <h3>ค่าธรรมเนียม SL</h3>
                <p className="indicator-value">{formatNumber(calculations.feeStop)}</p>
                <span>บาท</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* แสดง error ถ้ามี */}
      {calculations && calculations.error && (
        <div className="error-message">{calculations.error}</div>
      )}

      {/* --- กราฟราคาหุ้นย้อนหลัง + จุด marker --- */}
      {chartData.length > 0 && (
         <div className="chart-container" style={{ marginBottom: 32 }}>
             <StockChartWithMarkers
               data={chartData}
               buyPrice={Number(parseFloat(buyPrice) || NaN)}
               sellPrice={Number(parseFloat(sellPrice) || NaN)}
               stopLossPrice={Number(parseFloat(stopLossPrice) || NaN)}
               currency={currency}
             />
           </div>
         )}
      {/* --- Stock History Form --- */}
      <div className="stock-history-form">
        <h2>ดึงข้อมูลราคาหุ้นย้อนหลัง</h2>
        <form onSubmit={handleFetchHistory}>
          <div className="history-grid">
            <input
              type="text"
              value={inputSymbol}
              onChange={e => setInputSymbol(e.target.value)}
              placeholder="ชื่อหุ้น เช่น PTT"
            />
            <div className="date-range-row">
              <label className="date-label">
                จาก
                <input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={e => {
                    setStartDate(e.target.value);
                    setSelectedPreset(null);
                  }}
                />
              </label>
              <label className="date-label">
                ถึง
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={e => {
                    setEndDate(e.target.value);
                    setSelectedPreset(null);
                  }}
                />
              </label>
            </div>
            <div className="preset-buttons">
              {PRESET_RANGES.map(option => (
                <button
                  key={option.id}
                  type="button"
                  className={`range-button${selectedPreset === option.id ? ' active' : ''}`}
                  onClick={() => {
                    const range = option.getRange();
                    setStartDate(range.start);
                    setEndDate(range.end);
                    setSelectedPreset(option.id);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="submit" className="history-submit">ดึงราคาย้อนหลัง</button>
          </div>
        </form>
        {error && (
          <div className="error-message" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
        {/* แสดงราคาปิดย้อนหลัง */}
        {history.length > 0 && (
          <div style={{ marginTop: 16, color: '#bfc9d1', fontSize: 14 }}>
            ราคาปิดช่วง {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)} ({dateRangeInDays} วัน):
            {' '}
            {history.map(d => (
              d.originalClose != null ? `${d.originalClose} ${d.originalCurrency} → ${d.close}` : `${d.close}`
            )).join(', ')}
          </div>
        )}
      </div>

      {/* ปุ่มกลับหน้าหลัก */}
      <Link to="/" className="primary-button back-button">กลับสู่หน้าหลัก</Link>
    </div>
  );
}

export default CalculatorPage;

// --- ดึงราคาหุ้นย้อนหลังจาก backend ---
async function fetchStockHistory(symbol, startDate, endDate) {
  // ส่งสัญลักษณ์ตามที่ผู้ใช้กรอก (ปล่อย backend ตัดสินใจ .BK)
  const ticker = symbol.trim().toUpperCase();

  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const query = params.toString();

  const path = `/api/stock/history/${ticker}${query ? `?${query}` : ''}`;
  return await apiFetch(path);
}
 
// กราฟราคาหุ้นย้อนหลัง + จุด marker (Buy/Sell/Stop)
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceDot } from 'recharts';

function StockChartWithMarkers({ data, buyPrice, sellPrice, stopLossPrice, currency = 'THB' }) {
   return (
     <ResponsiveContainer width="100%" height={350}>
       <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
         <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
         <XAxis dataKey="date" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
         <YAxis
           tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }}
           domain={['auto', 'auto']}
           tickFormatter={value => (typeof value === 'number' ? value.toFixed(0) : '')}
         />
         <Tooltip
           contentStyle={{
             background: 'var(--color-bg-secondary)',
             color: 'var(--color-text)',
             borderRadius: '8px',
             border: '1px solid var(--color-border)'
           }}
           labelStyle={{ color: 'var(--color-accent)', fontWeight: 'bold' }}
           formatter={(value) => {
             const curLabel = currency === 'THB' ? 'บาท' : (currency || 'USD');
             return typeof value === 'number' ? [`${value.toFixed(2)} ${curLabel}`, 'ราคาปิด'] : ['-', 'ราคาปิด'];
           }}
         />
         <Line type="monotone" dataKey="close" stroke="var(--color-accent)" strokeWidth={2.5} dot={false} />
         {/* จุดซื้อ */}
         {Number.isFinite(buyPrice) && (
           <ReferenceDot
             x={data.find(d => Math.abs((d.close||0) - buyPrice) < 1e-6)?.date}
             y={buyPrice}
             r={8}
             fill="#4caf50"
             stroke="#fff"
             label="ซื้อ"
           />
         )}
         {/* จุดขาย */}
         {Number.isFinite(sellPrice) && (
           <ReferenceDot
             x={data.find(d => Math.abs((d.close||0) - sellPrice) < 1e-6)?.date}
             y={sellPrice}
             r={8}
             fill="#f7ca18"
             stroke="#fff"
             label="ขาย"
           />
         )}
         {/* จุด Stop Loss */}
         {Number.isFinite(stopLossPrice) && (
           <ReferenceDot
             x={data.find(d => Math.abs((d.close||0) - stopLossPrice) < 1e-6)?.date}
             y={stopLossPrice}
             r={8}
             fill="#d32f2f"
             stroke="#fff"
             label="SL"
           />
         )}
       </LineChart>
     </ResponsiveContainer>
   );
}
