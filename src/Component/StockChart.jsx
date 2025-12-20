// src/components/StockChart.jsx
import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

/**
 * กราฟราคาหุ้นย้อนหลัง 30 วัน
 * - ป้องกัน Error กรณี data เป็น undefined/null/empty
 * - ใช้ dark theme และรองรับ responsive
 * - formatter ป้องกัน value เป็น undefined/null
 */
const StockChart = ({ data, currency = 'THB' }) => {
  // ตรวจสอบ data ถ้าไม่ใช่ array หรือว่าง จะไม่ render กราฟ
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="chart-container" style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '2rem 0' }}>
        ไม่มีข้อมูลกราฟ
      </div>
    );
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="displayDate" tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} />
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
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default StockChart;