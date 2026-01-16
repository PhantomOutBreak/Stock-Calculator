import React from 'react';
import './css/App.css'; // นำเข้า CSS หลักของแอป
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import AboutPage from './pages/CalculatorPage';
import IndicatorsPage from './pages/IndicatorsPage';
import Layout from './Component/Layout';
import ReturnCalculator from './pages/Return Calculator';

// หน้า 404 ใช้ .page-container และสีจาก theme
function NotFoundPage() {
  return (
    <div className="page-container" style={{
      color: '#d32f2f',
      backgroundColor: 'var(--color-bg-secondary)',
      border: '1.5px solid #d32f2f'
    }}>
      <h1>404 - ไม่พบหน้า!</h1>
      <p style={{ fontSize: '1.2em' }}>ขออภัย, หน้าที่คุณกำลังมองหาไม่พบ.</p>
      <Link
        to="/"
        className="primary-button"
        style={{ marginTop: 30, background: '#d32f2f', color: '#fff' }}
      >
        กลับสู่หน้าหลัก
      </Link>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/Indicator" element={<IndicatorsPage />} />
          <Route path="/return-calculator" element={<ReturnCalculator />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
