/**
 * =====================================================
 * Sidebar.jsx - แถบเมนูด้านข้าง (Navigation Menu)
 * =====================================================
 * 
 * **จุดประสงค์:**
 * Component นี้แสดงเมนูหลักของแอปพลิเคชันในรูปแบบ Sidebar
 * รองรับทั้ง Desktop (แสดงค้างไว้) และ Mobile (เปิด/ปิดแบบ Drawer)
 * 
 * **Features:**
 * - Responsive: ปรับตัวตามขนาดหน้าจอ
 * - Active State: ไฮไลท์เมนูที่กำลังเปิดอยู่
 * - Overlay: พื้นหลังมืดเมื่อเปิดใน Mobile
 * - Accessibility: รองรับ ARIA labels
 * 
 * **Props:**
 * @param {boolean} isOpen - สถานะเปิด/ปิด Sidebar
 * @param {function} onClose - Callback เมื่อต้องการปิด Sidebar
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../css/Sidebar.css';

// กำหนดเมนูหลักของ Sidebar
const menuItems = [
  { path: '/', label: 'หน้าหลัก', icon: '🏠' },
  { path: '/about', label: 'คำนวนกำไรขาดทุน', icon: '💵' },
  { path: '/return-calculator', label: 'คำนวนปันผลย้อนหลัง', icon: '💰' },
  { path: '/indicator', label: 'Indicator', icon: '📊' },
];

function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  return (
    // ใช้ class 'sidebar' และเพิ่ม 'open' เมื่อเปิด (ตรงกับ CSS)
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* ส่วนหัวของ Sidebar */}
        <div className="sidebar-header">
          <div className="sidebar-logo">Stock Calculator</div>
          {/* ปุ่มปิดแสดงทุกอุปกรณ์ (ใน Mobile) */}
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Close Sidebar"
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '1.5rem',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            ✕
          </button>
        </div>
        {/* เมนูหลัก */}
        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            {menuItems.map(({ path, label, icon }) => (
              <li key={path} className="sidebar-item">
                <Link
                  to={path}
                  className={`sidebar-link ${location.pathname === path ? 'active' : ''}`}
                >
                  <span className="sidebar-icon">{icon}</span>
                  <span className="sidebar-label">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {/* ส่วนท้าย */}
        <div className="sidebar-footer" style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' }}>
          <p style={{ fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>Version 1.5</p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
