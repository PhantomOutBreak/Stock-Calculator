// src/components/StockTable.jsx
import React from 'react';

// improved currency heuristic
const getCurrencyForTicker = (sym) => {
  if (!sym) return '';
  const s = sym.trim().toUpperCase();
  if (s.endsWith('.BK')) return 'THB';
  // Treat 4-letter tickers as US (AAPL, MSFT, etc.)
  if (s.length === 4 && /^[A-Z0-9]{4}$/.test(s)) return 'USD';
  // Short tickers (<=3) usually Thai in your app (PTT, SCC, KBANK)
  if (s.length <= 3 && /^[A-Z0-9]{1,3}$/.test(s)) return 'THB';
  // fallback
  return 'USD';
};

const StockTable = ({ data, currency }) => (
  <div className="table-container">
    <table className="stock-table">
      <thead>
        <tr>
          <th>วันที่</th>
          <th>ราคาปิด ({currency === 'THB' ? 'บาท' : (currency || 'USD')})</th>
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row.date}>
            <td>{row.displayDate || row.date}</td>
            <td>{typeof row.close === 'number' ? row.close.toFixed(2) : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default StockTable;