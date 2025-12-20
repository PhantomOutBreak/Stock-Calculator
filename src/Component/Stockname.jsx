import React from 'react';
import '../css/Stockname.css';

// Component สำหรับกรอกชื่อหุ้น
function Stockname() {
  return (
    // กล่องหลักสำหรับจัด layout และตกแต่ง
    <div className="stockname-container">
      {/* label เชื่อมกับ input ด้วย htmlFor เพื่อ accessibility */}
      <label className="stockname-label" htmlFor="sname">
        <span role="img" aria-label="หุ้น"></span> ชื่อหุ้น:
      </label>
      {/* input สำหรับกรอกชื่อหุ้น */}
      <input
        type="text"
        id="sname"
        className="stockname-input"
        placeholder="กรอกชื่อหุ้น เช่น AOT, PTT, SCB"
        autoComplete="off"
      />
    </div>
  );
}

export default Stockname;