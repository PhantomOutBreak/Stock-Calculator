import { useState, useRef, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { calculateRSI, calculateMACD, calculateBollingerBands, calculateSMA, calculateFibonacciRetracement, calculateSqueezeMomentum, generateMacdSignals, generateSmaCrossSignals, detectRsiDivergences } from '../utils/indicators/calculations';

export function useIndicators() {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  const run = useCallback(async ({ ticker, startDate, endDate, setCurrency }) => {
    // perform fetch quote -> setCurrency(q.currency)
    // fetch history -> compute calculations -> setChartData(...)
  }, []);

  return { chartData, loading, error, run };
}