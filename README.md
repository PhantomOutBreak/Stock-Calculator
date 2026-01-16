# 📈 Stock Calculator & Analytics Platform (v1.5)

**Stock Calculator** is a comprehensive web application for stock traders and investors. It combines a powerful trading calculator (Buy/Sell/Stop Loss) with technical analysis tools (Indicators) and deep dividend history analytics.

Designed for the Thai market (SET) and US Stocks (Wall St.), supporting automatic currency detection (THB/USD).

![Version](https://img.shields.io/badge/version-1.5-blue.svg) ![License](https://img.shields.io/badge/license-MIT-green)

---

## 🚀 Key Features

### 1. 💹 Trade Calculator (เครื่องคำนวณเทรด)
- **Position Sizing:** Calculate profit/loss, fees (VAT included), and net return.
- **Risk Management:** Define Buy, Sell, and Stop Loss points.
- **Visual Graph:** Interactive chart showing Buy/Sell/Stop levels relative to historical price.
- **Risk Reward Ratio (RR):** Real-time calculation of RR to evaluate trade quality.

### 2. 📊 Technical Indicators (กราฟเทคนิค)
Visualize market trends with interactive charts:
- **Price Action:** Candlestick/Line chart.
- **RSI (Relative Strength Index):** Identify Overbought/Oversold conditions.
- **MACD (Moving Average Convergence Divergence):** Trend and momentum analysis.
- **Volume:** Trading volume bars.

### 3. 💰 Dividend History (ประวัติปันผล)
Deep dive into a company's dividend payouts:
- **Calendar View:** See payouts on a calendar.
- **Yield Analysis:** Calculate historical Dividend Yield at the time of payout.
- **TTM Yield:** Trailing Twelve Months dividend accumulation.
- **CSV Export:** Download dividend data for further analysis.

### 4. 🌍 Smart Currency (ระบบรองรับหลายสกุลเงิน)
- **Auto-Detection:** Automatically detects currency based on ticker (e.g., `PTT.BK` → THB, `AAPL` → USD).
- **Backend Driven:** Uses metadata from the API Source (Yahoo Finance/Twelve Data) for accuracy.

---

## 🛠 Tech Stack

### Frontend
- **React 19 (Vite):** Fast, modern UI framework.
- **Recharts:** Powerful charting library for financial data.
- **CSS3:** Custom responsive design (Dark theme).

### Backend
- **Node.js & Express:** Robust API server.
- **Yahoo Finance API:** Primary data source for real-time and historical data.
- **Twelve Data API:** Secondary/Backup data source.
- **In-Memory Cache:** Optimized JSON file-based caching to reduce API calls.
- **Circuit Breaker:** Protects against API rate limiting.

---

## 📦 Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Clone the repository
```bash
git clone https://github.com/PhantomOutBreak/Stock-Calculator.git
cd Stock-Calculator
```

### 2. Install Dependencies
This project has a single `package.json` at the root that manages both frontend and backend deps.
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in `Backend/` folder (or root, depending on your loader script, but codebase defaults to `Backend/.env`).
```env
# Backend/.env
PORT=7860
TWELVE_DATA_API_KEY=your_key_here
```

### 4. Run Locally (Development)
Open two terminals:

**Terminal 1 (Backend):**
```bash
npm run start:dev  # Runs nodemon Backend/index.js
```

**Terminal 2 (Frontend):**
```bash
npm run dev        # Runs vite
```
Access the app at `http://localhost:5173`.

---

## 🚀 Deployment (Production)

The project is configured to serve the frontend static files via the Backend server.

### 1. Build Frontend
```bash
npm run build
```
This generates the `dist/` folder.

### 2. Start Server
```bash
npm start
```
This runs `node Backend/index.js`. The server will serve the API at `/api/...` and the React app at `/` (from the `dist` folder).

**Platform Specifics:**
- **Render.com:** Set Build Command to `npm install && npm run build`, Start Command to `npm start`.

---

## 📂 Project Structure

```
Stock-Calculator/
├── Backend/               # Node.js API Server
│   ├── index.js           # Main Entry Point
│   ├── yahooDirect.js     # Custom Fetch implementation
│   └── stock_data_cache.json # Local Cache (GitIgnored)
├── src/                   # React Frontend
│   ├── Component/         # Reusable UI Components
│   │   ├── Indicators/    # Chart Components (RSI, MACD, etc)
│   │   └── Layout.jsx     # Main Layout Wrapper
│   ├── pages/             # Route Pages
│   │   ├── CalculatorPage.jsx
│   │   ├── IndicatorsPage.jsx
│   │   └── Return Calculator.jsx (Dividend History)
│   └── utils/             # Helper functions (API Fetch, Math)
├── public/                # Static assets (source)
├── dist/                  # Production Build (generated)
└── package.json           # Project Config
```

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

Developed with ❤️ by PhantomOutBreak
