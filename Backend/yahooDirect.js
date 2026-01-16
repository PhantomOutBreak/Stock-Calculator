import fetch from 'node-fetch'; // Ensure node-fetch is available if not global (Node 18+ has native fetch)

// Function to fetch Yahoo data directly (mimicking curl) as a robust fallback
export const fetchYahooDirectRaw = async (symbol, period1, period2, interval = '1d', events = '') => {
    try {
        const p1 = Math.floor(period1.getTime() / 1000);
        const p2 = Math.floor(period2.getTime() / 1000);
        let url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${p1}&period2=${p2}&interval=${interval}`;
        if (events) {
            url += `&events=${events}`;
        }

        console.log(`[Yahoo Direct] Fetching Raw: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const json = await response.json();
        return json.chart?.result?.[0]; // Return the raw result object
    } catch (err) {
        console.warn(`[Yahoo Direct] Raw Fetch Failed: ${err.message}`);
        return null;
    }
};

export const fetchYahooDirect = async (symbol, period1, period2, interval = '1d') => {
    const result = await fetchYahooDirectRaw(symbol, period1, period2, interval);
    if (!result) return null;

    const { timestamp, indicators } = result;
    const quotes = indicators?.quote?.[0];
    if (!timestamp || !quotes) return [];

    const history = timestamp.map((ts, i) => {
        const iso = new Date(ts * 1000).toISOString();
        return {
            date: iso,
            iso: iso,
            close: quotes.close?.[i] || null,
            volume: quotes.volume?.[i] || 0
        };
    }).filter(d => d.close !== null);

    return {
        history,
        currency: result.meta?.currency || 'USD'
    };
};
