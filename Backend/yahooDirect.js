/**
 * =====================================================
 * yahooDirect.js - ดึงข้อมูลจาก Yahoo Finance โดยตรง (Direct HTTP)
 * =====================================================
 * 
 * ไฟล์นี้ทำหน้าที่เป็น **Fallback** เมื่อ yahoo-finance2 Library ล้มเหลว
 * โดยเรียก Yahoo Finance API โดยตรงผ่าน HTTP Request (คล้าย curl)
 * 
 * **เหตุผลที่ต้องมี:**
 * - yahoo-finance2 บางครั้งมีปัญหา Rate Limit หรือ Parsing Error
 * - การเรียก API โดยตรงให้ควบคุมได้มากกว่า (Custom Headers, Error Handling)
 * 
 * **วิธีการทำงาน:**
 * 1. สร้าง URL ตาม Format ของ Yahoo Finance API v8
 * 2. ส่ง HTTP GET Request พร้อม User-Agent ปลอมตัวเป็น Browser
 * 3. Parse JSON Response และแปลงเป็น Format มาตรฐานของเรา
 * 4. Return ทั้ง history และ currency metadata
 */

import fetch from 'node-fetch'; // node-fetch สำหรับ HTTP Request (Node 18+ มี native fetch)

/**
 * ฟังก์ชันดึงข้อมูล Raw จาก Yahoo Finance API โดยตรง (ไม่ผ่าน Library)
 * @param {string} symbol - สัญลักษณ์หุ้น เช่น 'AAPL', 'PTT.BK'
 * @param {Date} period1 - วันที่เริ่มต้น (Date object)
 * @param {Date} period2 - วันที่สิ้นสุด (Date object)
 * @param {string} interval - ช่วงเวลา เช่น '1d' (รายวัน), '1wk' (รายสัปดาห์)
 * @param {string} events - เหตุการณ์พิเศษ เช่น 'div' (dividend), 'split' (stock split)
 * @returns {object|null} - Raw result object จาก Yahoo API หรือ null ถ้าล้มเหลว
 */
export const fetchYahooDirectRaw = async (symbol, period1, period2, interval = '1d', events = '') => {
    try {
        // แปลงวันที่เป็น Unix Timestamp (วินาที)
        const p1 = Math.floor(period1.getTime() / 1000);
        const p2 = Math.floor(period2.getTime() / 1000);

        // สร้าง URL ตาม Format ของ Yahoo Finance Chart API
        let url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${p1}&period2=${p2}&interval=${interval}`;

        // เพิ่ม events (dividend/split) ถ้ามี
        if (events) {
            url += `&events=${events}`;
        }

        console.log(`[Yahoo Direct] Fetching Raw: ${url}`);

        // ส่ง HTTP GET Request พร้อม Headers ปลอมตัวเป็น Browser
        // (Yahoo บางครั้งบล็อค Request ที่ไม่มี User-Agent)
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });

        // ตรวจสอบ HTTP Status Code
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        // Parse JSON Response
        const json = await response.json();

        // Return เฉพาะส่วน result[0] ที่มีข้อมูลหุ้น
        return json.chart?.result?.[0];

    } catch (err) {
        console.warn(`[Yahoo Direct] Raw Fetch Failed: ${err.message}`);
        return null;
    }
};

/**
 * ฟังก์ชันดึงข้อมูลประวัติราคาและแปลงเป็น Format มาตรฐาน
 * @param {string} symbol - สัญลักษณ์หุ้น
 * @param {Date} period1 - วันที่เริ่มต้น
 * @param {Date} period2 - วันที่สิ้นสุด  
 * @param {string} interval - ช่วงเวลา (default: '1d')
 * @returns {object|null} - { history: [...], currency: 'USD'|'THB' } หรือ null
 */
export const fetchYahooDirect = async (symbol, period1, period2, interval = '1d') => {
    // เรียกใช้ fetchYahooDirectRaw เพื่อดึงข้อมูล Raw
    const result = await fetchYahooDirectRaw(symbol, period1, period2, interval);
    if (!result) return null;

    // แยกข้อมูลที่ต้องการออกมา
    const { timestamp, indicators } = result;
    const quotes = indicators?.quote?.[0]; // ข้อมูลราคา (open, high, low, close, volume)

    if (!timestamp || !quotes) return [];

    // แปลง timestamp และ quotes เป็น Array ของ Object แต่ละวัน
    const history = timestamp.map((ts, i) => {
        const iso = new Date(ts * 1000).toISOString(); // Unix Timestamp → ISO String
        return {
            date: iso,          // วันที่ในรูปแบบ ISO
            iso: iso,          // ซ้ำกับ date (เพื่อ backward compatibility)
            close: quotes.close?.[i] || null,  // ราคาปิด
            volume: quotes.volume?.[i] || 0    // ปริมาณการซื้อขาย
        };
    }).filter(d => d.close !== null); // กรองเฉพาะวันที่มีราคาปิด

    // Return พร้อมข้อมูล currency จาก metadata
    return {
        history,
        currency: result.meta?.currency || 'USD' // ดึง currency จาก meta (THB, USD, JPY ฯลฯ)
    };
};
