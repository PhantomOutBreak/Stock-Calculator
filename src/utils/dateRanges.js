// src/utils/dateRanges.js
// Utility helpers for working with date ranges and preset shortcuts.

const formatDateToISO = (date) => date.toISOString().split('T')[0];

const clampToToday = (date) => {
  const today = new Date();
  return date > today ? new Date(today) : date;
};

const shiftByDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return clampToToday(result);
};

const shiftByMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return clampToToday(result);
};

const shiftByYears = (date, years) => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return clampToToday(result);
};

const buildRange = (computeStart) => {
  const end = clampToToday(new Date());
  const start = computeStart(new Date(end));
  return {
    start: formatDateToISO(start),
    end: formatDateToISO(end)
  };
};

const PRESET_RANGES = [
  {
    id: '1d',
    label: '1 วัน',
    getRange: () => buildRange(end => shiftByDays(end, -1))
  },
  {
    id: '5d',
    label: '5 วัน',
    // 5 Days: shift -8 days to ensure at least 5 trading days
    getRange: () => buildRange(end => shiftByDays(end, -8))
  },
  {
    id: '1m',
    label: '1 เดือน',
    // 1 Month: shift -45 days to ensure ~30 trading days (accounting for weekends/holidays)
    getRange: () => buildRange(end => shiftByDays(end, -45))
  },
  {
    id: '3m',
    label: '3 เดือน',
    // 3 Months: shift -135 days (approx 4.5 months) to ensure ~90 trading days
    getRange: () => buildRange(end => shiftByDays(end, -135))
  },
  {
    id: '6m',
    label: '6 เดือน',
    // 6 Months: shift -270 days (approx 9 months) to ensure ~180 trading days
    getRange: () => buildRange(end => shiftByDays(end, -270))
  },
  {
    id: 'ytd',
    label: 'YTD',
    getRange: () => {
      const end = clampToToday(new Date());
      const start = new Date(end.getFullYear(), 0, 1);
      return {
        start: formatDateToISO(start),
        end: formatDateToISO(end)
      };
    }
  },
  {
    id: '1y',
    label: '1 ปี',
    // 1 Year: shift -550 days (approx 1.5 years) to ensure ~250 trading days
    getRange: () => buildRange(end => shiftByDays(end, -550))
  },
  {
    id: '5y',
    label: '5 ปี',
    // 5 Years: shift -2700 days (approx 7.5 years) to ensure ~1250 trading days
    getRange: () => buildRange(end => shiftByDays(end, -2700))
  }
];

const DEFAULT_PRESET_ID = '1m';

const getPresetById = (id) => PRESET_RANGES.find(item => item.id === id) || null;

const getPresetRange = (presetId) => {
  const preset = getPresetById(presetId);
  return preset ? preset.getRange() : null;
};

const getDefaultRange = () => getPresetRange(DEFAULT_PRESET_ID);

const parseISODate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const calculateDateRangeInDays = (startISO, endISO) => {
  const start = parseISODate(startISO);
  const end = parseISODate(endISO);
  if (!start || !end) return 0;
  const diffMs = end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0);
  if (Number.isNaN(diffMs) || diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
};

export {
  PRESET_RANGES,
  DEFAULT_PRESET_ID,
  getPresetRange,
  getDefaultRange,
  parseISODate,
  calculateDateRangeInDays,
  formatDateToISO,
  clampToToday,
  shiftByDays,
  shiftByMonths,
  shiftByYears
};
