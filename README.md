# 📈 Stock Calculator & Analytics Platform

[![Version](https://img.shields.io/badge/version-1.5-blue.svg)](https://github.com/PhantomOutBreak/Stock-Calculator/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19-61DAFB.svg)](https://react.dev/)

**Stock Calculator** is a comprehensive web application for stock traders and investors. It combines a powerful trading calculator (Buy/Sell/Stop Loss) with technical analysis tools (Indicators) and deep dividend history analytics.

🌏 Designed for the **Thai market (SET)** and **US Stocks (Wall St.)**, supporting automatic currency detection (THB/USD).

---

## ✨ Demo

> 🔗 **Live Demo:** [https://stock-calculator-xxxx.onrender.com](https://stock-calculator-xxxx.onrender.com) *(Replace with your deployed URL)*

<!-- Add screenshots here -->
<!-- ![Dashboard](./docs/screenshot-dashboard.png) -->

---

## 🚀 Key Features

### 1. 💹 Trade Calculator (เครื่องคำนวณเทรด)
| Feature | Description |
|---------|-------------|
| **Position Sizing** | Calculate profit/loss, fees (VAT included), and net return |
| **Risk Management** | Define Buy, Sell, and Stop Loss points |
| **Visual Graph** | Interactive chart showing Buy/Sell/Stop levels relative to historical price |
| **Risk Reward Ratio** | Real-time RR calculation to evaluate trade quality |

### 2. 📊 Technical Indicators (กราฟเทคนิค)
Visualize market trends with interactive charts:
- 📈 **Price Action** – Candlestick/Line chart with SMA/EMA overlays
- 📉 **RSI (Relative Strength Index)** – Identify Overbought/Oversold conditions
- 📊 **MACD** – Trend and momentum analysis with histogram
- 📊 **Volume** – Trading volume bars

### 3. 💰 Dividend History (ประวัติปันผล)
Deep dive into a company's dividend payouts:
- 📅 **Calendar View** – See payouts on a calendar
- 📈 **Yield Analysis** – Calculate historical Dividend Yield at time of payout
- 🔄 **TTM Yield** – Trailing Twelve Months dividend accumulation
- 📥 **CSV Export** – Download dividend data for analysis

### 4. 🌍 Smart Currency
- **Auto-Detection** – Automatically detects currency based on ticker  
  (e.g., `PTT.BK` → THB, `AAPL` → USD)
- **Backend Driven** – Uses metadata from Yahoo Finance/Twelve Data API

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, Recharts, CSS3 (Dark Theme) |
| **Backend** | Node.js, Express 5 |
| **Data Sources** | Yahoo Finance API (Primary), Twelve Data API (Fallback) |
| **Caching** | JSON File-based In-Memory Cache |
| **Resilience** | Circuit Breaker Pattern |

---

## 📦 Installation & Setup

### Prerequisites
- **Node.js** v18 or higher
- **npm** or **yarn**

### 1. Clone the Repository
```bash
git clone https://github.com/PhantomOutBreak/Stock-Calculator.git
cd Stock-Calculator
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file inside the `Backend/` folder:

```env
# Backend/.env
PORT=7860
TWELVE_DATA_API_KEY=your_api_key_here
```

> 💡 **Tip:** Get a free API key from [Twelve Data](https://twelvedata.com/) for backup data fetching.

### 4. Run Locally (Development)

**Option A: Two Terminals**
```bash
# Terminal 1 - Backend
cd Backend && node index.js

# Terminal 2 - Frontend
npm run dev
```

**Option B: Concurrent (Recommended)**
```bash
npm run start:dev   # Uses nodemon for auto-reload
npm run dev         # Vite dev server
```

Access the app at: **http://localhost:5173**

---

## 🚀 Deployment (Production)

### Build & Start
```bash
# 1. Build frontend
npm run build

# 2. Start server (serves both API and static files)
npm start
```

### Platform-Specific Commands

| Platform | Build Command | Start Command |
|----------|---------------|---------------|
| **Render.com** | `npm install && npm run build` | `npm start` |
| **Railway** | `npm install && npm run build` | `npm start` |
| **Heroku** | `npm install && npm run build` | `npm start` |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/stock/:ticker` | Get current quote for a stock |
| `GET` | `/api/stock/history/:ticker` | Get historical price data |
| `GET` | `/api/stock/dividends/:ticker` | Get dividend history |
| `GET` | `/api/forex/usd-thb` | Get current USD/THB exchange rate |
| `GET` | `/health` | Health check endpoint |

**Example:**
```bash
curl http://localhost:7860/api/stock/AAPL
curl http://localhost:7860/api/stock/history/PTT.BK?startDate=2025-01-01
```

---

## 📂 Project Structure

```
Stock-Calculator/
├── Backend/                    # Node.js API Server
│   ├── index.js                # Main server entry point
│   ├── envLoader.js            # Smart .env loader (UTF-16 support)
│   ├── yahooDirect.js          # Direct Yahoo Finance fetch
│   └── stock_data_cache.json   # Local cache (gitignored)
│
├── src/                        # React Frontend
│   ├── Component/              # Reusable UI Components
│   │   ├── Indicators/         # Chart Components (RSI, MACD, Volume)
│   │   ├── DividendCalendar.jsx
│   │   ├── Layout.jsx
│   │   ├── Sidebar.jsx
│   │   └── StockChart.jsx
│   │
│   ├── pages/                  # Route Pages
│   │   ├── CalculatorPage.jsx  # Trade Calculator
│   │   ├── IndicatorsPage.jsx  # Technical Analysis
│   │   └── Return Calculator.jsx # Dividend History
│   │
│   ├── utils/                  # Helper utilities
│   │   ├── api.js              # API fetch wrapper
│   │   └── indicators/         # Calculation functions
│   │
│   └── css/                    # Stylesheets
│
├── hooks/                      # Custom React Hooks
│   └── useIndicators.js
│
├── public/                     # Static assets (source)
├── dist/                       # Production build (generated)
├── package.json
├── vite.config.js
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. Create a **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. Open a **Pull Request**

---

## 📋 Changelog

### v1.5 (2026-01-16)
- ✅ Added Technical Indicators (RSI, MACD, Volume charts)
- ✅ Added Dividend Calendar component
- ✅ Improved currency detection (backend-driven)
- ✅ Added Twelve Data API as fallback
- ✅ Performance: JSON file-based caching
- ✅ Fixed static serving for production deployment

### v1.0 (Initial Release)
- Trade Calculator with Risk Reward Ratio
- Basic stock price fetching

---

## 🙏 Acknowledgments

- [Yahoo Finance](https://finance.yahoo.com/) – Primary data source
- [Twelve Data](https://twelvedata.com/) – Backup data provider
- [Recharts](https://recharts.org/) – Charting library
- [Vite](https://vitejs.dev/) – Lightning-fast build tool

---

## 📝 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Developed with ❤️ by <a href="https://github.com/PhantomOutBreak">PhantomOutBreak</a>
</p>
