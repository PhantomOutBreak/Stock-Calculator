import React, { useState } from 'react';
import Sidebar from './Sidebar';
import '../css/Layout.css'; // นำเข้า CSS สำหรับ Layout

// Layout หลักของแอป มีปุ่ม toggle และ overlay สำหรับปิด sidebar
function Layout({ children }) {
  // state สำหรับเปิด/ปิด sidebar
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ฟังก์ชัน toggle sidebar (เปิด/ปิด)
  const toggleSidebar = () => setIsSidebarOpen(open => !open);

  return (
    <div className={`layout-container${isSidebarOpen ? ' sidebar-open' : ' sidebar-closed'}`}>
      {/* ปุ่ม hamburger toggle แสดงทุกอุปกรณ์ */}
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar"
      >
        {/* ไอคอน hamburger */}
        <span className="hamburger-bar"></span>
        <span className="hamburger-bar"></span>
        <span className="hamburger-bar"></span>
      </button>
      {/* Sidebar รับ prop isOpen และ onClose */}
      <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
      {/* overlay สำหรับปิด sidebar เมื่อเปิด */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={toggleSidebar} />
      )}
      {/* เนื้อหาหลัก (full-bleed เพื่อให้เพจขยายเต็ม viewport) */}
      <main className="layout-content full-bleed">
        {children}
      </main>
    </div>
  );
}

export default Layout;