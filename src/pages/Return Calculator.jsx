import React, { useMemo, useState } from 'react'; // นำเข้า Library หลักของ React และ Hooks สำหรับจัดการ State และ Memoization
import '../css/App.css'; // นำเข้าไฟล์สไตล์หลักของแอป
import '../css/ReturnCalculatorPage.css'; // นามเข้าไฟล์สไตล์เฉพาะของหน้าเครื่องคำนวณผลตอบแทน
import { apiFetch } from '../utils/api';
import DividendCalendar from '../Component/DividendCalendar'; // นำเข้า Component ปฏิทินปันผล

/* ---------------------------
   Helpers: parsing & formatters 
   (ฟังก์ชันช่วยสำหรับแปลงข้อมูลและจัดรูปแบบการแสดงผล)
   --------------------------- */

// ฟังก์ชันแปลงค่าต่างๆ ให้เป็นตัวเลขที่ใช้งานได้ (Finite Number)
const toFiniteNumber = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v; // ถ้าเป็นตัวเลขอยู่แล้วและไม่ใช่ Infinity ให้คืนค่าเลย
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '')); // ถ้าเป็น String ให้ลบเครื่องหมายคอมมาออกก่อนแปลงเป็นตัวเลข
    return Number.isFinite(n) ? n : null; // คืนค่าตัวเลขถ้าแปลงสำเร็จ ถ้าไม่สำเร็จคืน null
  }
  return null;
};

// ฟังก์ชันจัดรูปแบบตัวเลขสำหรับการแสดงผล (เช่น ใส่คอมมา, กำหนดทศนิยม) ตามมาตรฐานไทย (th-TH)
const formatNumber = (value, { minimumFractionDigits = 0, maximumFractionDigits = 2 } = {}) => {
  const n = toFiniteNumber(value);
  if (n === null) return '—'; // ถ้าไม่มีข้อมูลให้แสดงขีด
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(n);
};

// ฟังก์ชันจัดรูปแบบตัวเลขเป็นเปอร์เซ็นต์
const formatPercent = (value, digits = 2) => {
  const n = toFiniteNumber(value);
  return n === null ? '—' : `${formatNumber(n, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
};

// ฟังก์ชันสำหรับแกะข้อมูลวันที่จากหลายรูปแบบ (Date object, Timestamp, หรือ String) ให้เป็น Date object ที่ถูกต้อง
const parseDateInput = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value * 1000; // ตรวจสอบว่าเป็นวินาทีหรือมิลลิวินาที
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return parseDateInput(Number(trimmed)); // ถ้าเป็น String ตัวเลขล้วน ให้ส่งไปคำนวณแบบ number
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

// แปลงวันที่ให้เป็นรูปแบบ ISO (YYYY-MM-DD) สำหรับใช้งานกับ <input type="date">
const toISODate = (value) => {
  const d = parseDateInput(value);
  return d ? d.toISOString().slice(0, 10) : '';
};

// จัดรูปแบบวันที่สำหรับการแสดงผลในตาราง (DD/MM/YYYY)
const formatISODate = (iso) => {
  const d = parseDateInput(iso);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
};

// ตรวจสอบวันที่ หากเป็นวันที่ในอนาคต ให้จำกัดไว้แค่ไม่เกิน "วันนี้"
const clampToTodayISO = (iso) => {
  const d = parseDateInput(iso);
  const today = new Date();
  if (!d) return '';
  if (d > today) return today.toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
};

/* ---------------------------
   Small UI helpers 
   --------------------------- */

// คอมโพเนนต์แสดงสัญลักษณ์หมุนตอนกำลังโหลดข้อมูล (Loading Spinner)
function Spinner({ size = 18 }) {
  const s = size;
  return (
    <svg
      role="img"
      aria-hidden="true"
      width={s}
      height={s}
      viewBox="0 0 50 50"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" />
      <path
        d="M45 25a20 20 0 0 0-20-20"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        transform="rotate(90 25 25)"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 25 25"
          to="360 25 25"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}

// ฟังก์ชันสร้างข้อความรูปแบบ CSV จากข้อมูลเหตุการณ์เงินปันผลเพื่อใช้ดาวน์โหลด
const generateCSV = (events = [], summaries = {}) => {
  const header = ['date', 'amountPerShare', `currency(${summaries.currency || '-'})`, 'priceAtEvent', 'priceDate', 'yieldPercent', 'amountUSD'];
  const rows = events.map((ev) => [
    formatISODate(ev.date),
    (toFiniteNumber(ev.amountPerShare) !== null) ? toFiniteNumber(ev.amountPerShare) : '',
    ev.currency || summaries.currency || '',
    (toFiniteNumber(ev.priceAtEvent) !== null) ? toFiniteNumber(ev.priceAtEvent) : '',
    ev.priceDate ? formatISODate(ev.priceDate) : '',
    (toFiniteNumber(ev.yieldPercent) !== null) ? toFiniteNumber(ev.yieldPercent) : '',
    (toFiniteNumber(ev.amountUSD) !== null) ? toFiniteNumber(ev.amountUSD) : '',
  ]);
  // รวม Header และ Rows เข้าด้วยกัน และทำการ Escape เครื่องหมายคำพูด
  const csv = [header.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  return csv;
};

/* ---------------------------
   Main Component: ReturnCalculator
   --------------------------- */

function ReturnCalculator() {
  // --- States ของแอปพลิเคชัน ---
  const [ticker, setTicker] = useState(''); // เก็บชื่อหุ้นที่ผู้ใช้กรอก
  const [startDate, setStartDate] = useState(() => { // กำหนดวันที่เริ่มต้นเริ่มต้น (ย้อนหลัง 1 ปี)
    const past = new Date();
    past.setFullYear(past.getFullYear() - 1);
    return past.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10)); // วันที่สิ้นสุดเริ่มต้น (วันนี้)
  const [result, setResult] = useState(null); // เก็บข้อมูลที่ได้จาก API
  const [loading, setLoading] = useState(false); // สถานะการโหลด
  const [error, setError] = useState(''); // เก็บข้อความแสดงข้อผิดพลาด

  // ดึงรายการ events (เงินปันผล) ออกมา ถ้าไม่มีให้เป็น array ว่าง (ใช้ useMemo เพื่อลดการคำนวณซ้ำ)
  const events = useMemo(() => (Array.isArray(result?.events) ? result.events : []), [result]);

  // คำนวณช่วงวันที่ที่ใช้ในการขอข้อมูล เพื่อใช้แสดงผลบน UI
  const requestedRange = useMemo(() => {
    const req = result?.quality?.requestedRange || result?.period;
    const start = toISODate(req?.start || startDate);
    const end = clampToTodayISO(req?.end || endDate);
    return { start, end };
  }, [result, startDate, endDate]);

  // ฟังก์ชันตรวจสอบว่าวันที่หนึ่งๆ อยู่ในช่วงที่เลือกหรือไม่
  const isWithinRange = (iso) => {
    const d = parseDateInput(iso);
    if (!d) return false;
    const s = parseDateInput(requestedRange.start);
    const e = parseDateInput(requestedRange.end);
    if (!s || !e) return false;
    s.setHours(0, 0, 0, 0); // ตั้งเป็นเวลาเริ่มวัน
    e.setHours(23, 59, 59, 999); // ตั้งเป็นเวลาจบวัน
    return d >= s && d <= e;
  };

  // --- การคำนวณข้อมูลสรุป (Summaries) ---
  const summaries = useMemo(() => {
    // ถ้าไม่มีข้อมูลเงินปันผล ให้คืนค่าเริ่มต้นทั้งหมด
    if (!events.length) {
      return {
        currency: result?.currency || '',
        inRangeCount: 0,
        totalEvents: 0,
        totalPerShare: null,
        totalUSD: null,
        totalTHB: null,
        avgYield: null,
        medianYield: null,
        highestYield: null,
        highestYieldDate: null,
        lastPayoutDate: null,
        ttmPerShare: null,
        perYear: [],
        usedFallback: false,
      };
    }

    // กรองข้อมูลเฉพาะที่อยู่ในช่วงวันที่ต้องการ
    const inRange = events.filter((ev) => (typeof ev.withinRequestedRange === 'boolean' ? ev.withinRequestedRange : isWithinRange(ev.date)));
    const usedFallback = inRange.length === 0; // ถ้าในช่วงที่กรองไม่มีข้อมูลเลย ให้ใช้ข้อมูลทั้งหมดที่มีแทน (Fallback)
    const target = usedFallback ? events : inRange;

    const currency = result?.currency || target[0]?.currency || '';

    // ตัวแปรสะสมค่าต่างๆ
    let totalPerShare = 0;
    let totalUSD = 0;
    let totalTHB = 0;
    let haveNative = false;
    let haveUSD = false;
    let haveTHB = false;
    const yields = [];

    let lastPayoutDate = null;
    let highestYield = null;
    let highestYieldDate = null;

    // คำนวณสำหรับ TTM (Trailing Twelve Months - 12 เดือนย้อนหลัง)
    const ttmEnd = parseDateInput(requestedRange.end) || new Date();
    const ttmStart = new Date(ttmEnd);
    ttmStart.setDate(ttmStart.getDate() - 365);
    let ttmPerShare = 0;

    const yearMap = new Map(); // เก็บข้อมูลแยกรายปี

    // วนลูปคำนวณค่าจากรายการปันผลแต่ละครั้ง
    for (const ev of target) {
      const amt = toFiniteNumber(ev.amountPerShare);
      const usd = toFiniteNumber(ev.amountUSD);
      const thb = toFiniteNumber(ev.amountTHB);
      const yld = toFiniteNumber(ev.yieldPercent);
      const d = parseDateInput(ev.date);

      if (amt !== null) {
        totalPerShare += amt;
        haveNative = true;
      }
      if (usd !== null) {
        totalUSD += usd;
        haveUSD = true;
      }
      if (thb !== null) {
        totalTHB += thb;
        haveTHB = true;
      }
      if (yld !== null) {
        yields.push(yld);
        if (highestYield === null || yld > highestYield) {
          highestYield = yld;
          highestYieldDate = ev.date || null;
        }
      }
      if (d && !Number.isNaN(d.getTime())) {
        if (!lastPayoutDate || d > lastPayoutDate) lastPayoutDate = d; // หาวันที่จ่ายล่าสุด
        if (d >= ttmStart && d <= ttmEnd && amt !== null) ttmPerShare += amt; // บวกค่าเข้า TTM

        // เก็บข้อมูลสรุปรายปี
        const y = d.getFullYear();
        const entry = yearMap.get(y) || { perShare: 0, usd: 0, thb: 0, count: 0 };
        if (amt !== null) entry.perShare += amt;
        if (usd !== null) entry.usd += usd;
        if (thb !== null) entry.thb += thb;
        entry.count += 1;
        yearMap.set(y, entry);
      }
    }

    // คำนวณค่าเฉลี่ยและมัธยฐานของ Yield
    const avgYield = yields.length ? yields.reduce((a, b) => a + b, 0) / yields.length : null;
    const medianYield = yields.length
      ? (() => {
        const sorted = [...yields].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      })()
      : null;

    // แปลง Map ข้อมูลรายปีเป็น Array เพื่อใช้แสดงในตาราง
    const perYear = [...yearMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([year, val]) => ({ year, ...val }));

    return {
      currency,
      inRangeCount: inRange.length,
      totalEvents: events.length,
      totalPerShare: haveNative ? Number(totalPerShare.toFixed(4)) : null,
      totalUSD: haveUSD ? Number(totalUSD.toFixed(2)) : null,
      totalTHB: haveTHB ? Number(totalTHB.toFixed(2)) : null,
      avgYield: avgYield !== null ? Number(avgYield.toFixed(2)) : null,
      medianYield: medianYield !== null ? Number(medianYield.toFixed(2)) : null,
      highestYield,
      highestYieldDate,
      lastPayoutDate,
      ttmPerShare: haveNative ? Number(ttmPerShare.toFixed(4)) : null,
      perYear,
      usedFallback,
    };
  }, [events, result, requestedRange]);

  // ฟังก์ชันจัดการเมื่อผู้ใช้กดปุ่มค้นหา (Submit Form)
  const onSubmit = async (e) => {
    e.preventDefault();
    const trimmed = ticker.trim().toUpperCase();
    if (!trimmed) {
      setError('กรุณากรอกสัญลักษณ์หุ้นก่อนค้นหา');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
      return;
    }

    setLoading(true);
    setError('');

    // เตรียม Query Parameters
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', clampToTodayISO(endDate));

    const url = `/api/stock/dividends/${encodeURIComponent(trimmed)}?${params.toString()}`;

    try {
      const payload = await apiFetch(url); // เรียกใช้งาน API (apiFetch คืน parsed JSON หรือ throw)
      setResult(payload); // เก็บผลลัพธ์ลง state
      setTicker(trimmed); // อัปเดต ticker เป็นตัวใหญ่
    } catch (err) {
      setError(err?.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ');
      setResult(null);
    } finally {
      setLoading(false); // ปิดสถานะการโหลด
    }
  };

  // ฟังก์ชันคัดลอกชื่อหุ้นลง Clipboard
  const copyTickerToClipboard = async () => {
    const textToCopy = ticker || result?.resolvedTicker || result?.ticker || '';

    if (!textToCopy) {
      console.warn("No ticker found to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      // แจ้งเตือน user ว่าสำเร็จ (Optional)
      // showToast("Copied to clipboard!"); 
    } catch (err) {
      console.error("Failed to copy ticker:", err);
      // แจ้งเตือน user ว่าล้มเหลว (Optional)
      // showToast("Failed to copy. Please try again.");
    }
  };

  // ฟังก์ชันสร้างและดาวน์โหลดไฟล์ CSV
  const downloadCSV = () => {
    const csv = generateCSV(events, summaries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileTicker = (result?.resolvedTicker || result?.ticker || ticker || 'data').replace(/[^a-z0-9_-]/gi, '_');
    a.download = `${fileTicker}_dividends_${requestedRange.start || 'all'}_${requestedRange.end || 'all'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* --- การ Render UI --- */
  return (
    <div className="page-container return-calculator" aria-live="polite">
      <h1>Dividend Distribution History</h1>
      <p className="page-description">
        สำรวจประวัติการจ่ายปันผลย้อนหลังของหุ้น พร้อมสรุปรวม, ค่าเฉลี่ย/มัธยฐานของ Dividend Yield, ยอดปันผล TTM และสรุปตามปีปฏิทิน
      </p>

      {/* ส่วนฟอร์มรับค่าสัญลักษณ์หุ้นและวันที่ */}
      <form className="return-form" onSubmit={onSubmit} aria-label="ค้นหาประวัติการจ่ายปันผล">
        <div className="form-row">
          <label htmlFor="ticker">สัญลักษณ์หุ้น</label>
          <input
            id="ticker"
            type="text"
            placeholder="เช่น AAPL, PTTEP หรือ ADVANC"
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            autoComplete="off"
            aria-label="สัญลักษณ์หุ้น"
          />
        </div>

        <div className="date-row">
          <div className="form-row">
            <label htmlFor="startDate">วันที่เริ่มต้น</label>
            <input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor="endDate">วันที่สิ้นสุด</label>
            <input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* ปุ่มกดต่างๆ */}
        <div className="form-actions" style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
            <button
              className="primary-button"
              type="submit"
              disabled={loading}
              aria-disabled={loading}
              aria-label="ดึงข้อมูลปันผล"
            >
              {loading ? (
                <>
                  <Spinner size={16} /> <span style={{ marginLeft: 8 }}>กำลังดึงข้อมูล…</span>
                </>
              ) : (
                'ดึงข้อมูลปันผล'
              )}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={copyTickerToClipboard}
              title="คัดลอกสัญลักษณ์หุ้น"
              aria-label="คัดลอกสัญลักษณ์หุ้น"
              style={{ padding: '0.6rem 1rem' }}
            >
              คัดลอกสัญลักษณ์
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={downloadCSV}
              title="ดาวน์โหลดรายการปันผลเป็น CSV"
              aria-label="ดาวน์โหลด CSV"
              style={{ padding: '0.6rem 1rem' }}
            >
              ดาวน์โหลด CSV
            </button>
          </div>
        </div>
      </form>

      {/* แสดง Error ถ้ามี */}
      {error && (
        <div className="error-banner" role="status" aria-live="assertive">
          {error}
        </div>
      )}

      {/* แสดงผลลัพธ์เมื่อได้ข้อมูลมาแล้ว */}
      {result && (
        <div className="results-card" role="region" aria-label="สรุปผลปันผล">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <h2 style={{ marginBottom: 6 }}>
                สรุปภาพรวม — {result?.resolvedTicker || result?.ticker || '-'}
              </h2>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
                สกุลเงินหลัก {result?.currency || 'N/A'}
                {summaries.usedFallback ? ' • *ไม่มีข้อมูลในช่วงที่เลือก: แสดงทั้งหมด*' : ''}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>ช่วงที่ขอ</div>
                <div style={{ fontWeight: 700 }}>
                  {requestedRange.start || '—'} — {requestedRange.end || '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Grid แสดงการ์ดสรุปตัวเลขสำคัญ (Summary Cards) */}
          <div className="summary-grid" style={{ marginTop: 18 }}>
            <div className="summary-card summary-card--primary">
              <span className="label">จำนวนครั้งที่จ่าย (ในช่วงที่เลือก)</span>
              <strong className="value-large">{summaries.inRangeCount}</strong>
              <span className="value-sub">ทั้งหมด {summaries.totalEvents} ครั้ง</span>
            </div>

            <div className="summary-card">
              <span className="label">ปันผลรวมต่อหุ้น</span>
              <strong className="value-large">
                {formatNumber(summaries.totalPerShare, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                {summaries.currency ? ` ${summaries.currency}` : ''}
              </strong>
              <span className="value-sub">รวมทุกครั้งที่จ่ายในช่วง</span>
            </div>

            <div className="summary-card">
              <span className="label">รวมเป็น USD</span>
              <strong className="value-large">
                {formatNumber(summaries.totalUSD, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {Number.isFinite(summaries.totalUSD) ? ' USD' : ''}
              </strong>
            </div>

            <div className="summary-card">
              <span className="label">ค่าเฉลี่ย Dividend Yield</span>
              <strong className="value-large">{formatPercent(summaries.avgYield)}</strong>
              <span className="value-sub">มัธยฐาน: {formatPercent(summaries.medianYield)}</span>
            </div>

            <div className="summary-card">
              <span className="label">Yield สูงสุด</span>
              <strong className="value-large">{formatPercent(summaries.highestYield)}</strong>
              <span className="value-sub">{summaries.highestYieldDate ? formatISODate(summaries.highestYieldDate) : '—'}</span>
            </div>

            <div className="summary-card">
              <span className="label">ปันผลสะสม 12 เดือนล่าสุด (TTM)</span>
              <strong className="value-large">
                {formatNumber(summaries.ttmPerShare, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                {summaries.currency ? ` ${summaries.currency}` : ''}
              </strong>
            </div>

            <div className="summary-card">
              <span className="label">จ่ายล่าสุด</span>
              <strong className="value-large">{summaries.lastPayoutDate ? formatISODate(summaries.lastPayoutDate) : '—'}</strong>
            </div>
          </div>

          {/* ปฏิทินปันผล (Dividend Calendar) */}
          {events.length > 0 && (
            <div className="dividend-table-wrapper" style={{ marginTop: 20 }}>
              <h3>ปฏิทินปันผล</h3>
              <DividendCalendar events={events} currency={summaries.currency} />
            </div>
          )}

          {/* ตารางสรุปรายปีปฏิทิน */}
          {summaries.perYear.length > 0 && (
            <div className="dividend-table-wrapper" style={{ marginTop: 20 }}>
              <h3>สรุปตามปีปฏิทิน</h3>
              <table className="dividend-table" aria-label="สรุปตามปี">
                <thead>
                  <tr>
                    <th>ปี</th>
                    <th>ครั้งที่จ่าย</th>
                    <th>รวม/หุ้น ({summaries.currency || '-'})</th>
                    <th>รวม (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.perYear.map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <td>{row.count}</td>
                      <td>{formatNumber(row.perShare, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                      <td>{formatNumber(row.usd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ตารางรายละเอียดการปันผลรายครั้ง */}
          <div className="dividend-table-wrapper" style={{ marginTop: 18 }}>
            <h3>รายละเอียดการจ่ายปันผล</h3>
            {events.length === 0 ? (
              <div className="no-data">ไม่พบข้อมูลปันผล</div>
            ) : (
              <table className="dividend-table" aria-label="รายละเอียดการจ่ายปันผล">
                <thead>
                  <tr>
                    <th>วันที่จ่าย</th>
                    <th>จำนวนต่อหุ้น ({summaries.currency || '—'})</th>
                    <th>ราคาปิดใกล้เคียง</th>
                    <th>Dividend Yield</th>
                    <th>เป็น USD</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, index) => (
                    <tr key={`${ev.date}-${index}`}>
                      <td>{formatISODate(ev.date)}</td>

                      <td>
                        {formatNumber(ev.amountPerShare, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        {summaries.currency ? ` ${ev.currency || summaries.currency}` : ''}
                      </td>

                      <td>
                        {Number.isFinite(ev.priceAtEvent)
                          ? `${formatNumber(ev.priceAtEvent, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ev.currency || summaries.currency || ''} ${ev.priceDate ? `(${formatISODate(ev.priceDate)})` : ''
                          }`
                          : '—'}
                      </td>

                      <td>{formatPercent(ev.yieldPercent)}</td>

                      <td>
                        {Number.isFinite(ev.amountUSD)
                          ? `${formatNumber(ev.amountUSD, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReturnCalculator; // ส่งออกคอมโพเนนต์ไปใช้งาน