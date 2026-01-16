/**
 * =====================================================
 * Layout.jsx - โครงสร้างหน้าเว็บหลัก (Main Layout Wrapper)
 * =====================================================
 * 
 * **จุดประสงค์:**
 * Component นี้เป็น Wrapper หลักที่ครอบทุกหน้าของแอปพลิเคชัน
 * จัดการโครงสร้างพื้นฐาน: Sidebar + Main Content Area
 * 
 * **โครงสร้าง:**
 * ```
 * Layout
 * ├── Hamburger Button (Toggle Sidebar)
 * ├── Sidebar (Navigation Menu)
 * └── Main Content (children)
 * ```
 * 
 * **Props:**
 * @param {ReactNode} children - เนื้อหาหน้าเว็บที่จะแสดงในพื้นที่หลัก
 */

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

      {/* เนื้อหาหลัก (full-bleed เพื่อให้เพจขยายเต็ม viewport) */}
      <main className="layout-content full-bleed">
        {children}
      </main>
    </div>
  );
}

export default Layout;