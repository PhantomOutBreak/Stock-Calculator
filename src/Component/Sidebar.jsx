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
    // ใช้ class 'sidebar' เสมอ และเพิ่ม 'sidebar--open' เมื่อเปิด
    <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      {/* ส่วนหัวของ Sidebar */}
      <div className="sidebar-header">
        <h2>Stock Calculator</h2>
        {/* ปุ่มปิดแสดงทุกอุปกรณ์ */}
        <button
          className="close-button"
          onClick={onClose}
          aria-label="Close Sidebar"
        >
          ✕
        </button>
      </div>
      {/* เมนูหลัก */}
      <nav className="sidebar-nav">
        <ul>
          {menuItems.map(({ path, label, icon }) => (
            <li key={path}>
              <Link
                to={path}
                className={location.pathname === path ? 'active' : ''}
                onClick={onClose} // ปิด sidebar เมื่อคลิกเมนู
              >
                <span className="menu-icon">{icon}</span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* ส่วนท้าย */}
      <div className="sidebar-footer">
        <p>Version 1.0</p>
      </div>
    </aside>
  );
}

export default Sidebar;
