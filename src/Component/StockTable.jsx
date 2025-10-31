// src/components/StockTable.jsx
import React from 'react';

const StockTable = ({ data }) => (
  <div className="table-container">
    <table className="stock-table">
      <thead>
        <tr>
          <th>วันที่</th>
          <th>ราคาปิด (บาท)</th>
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row.date}>
            <td>{row.date}</td>
            <td>{typeof row.close === 'number' ? row.close.toFixed(2) : '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default StockTable;