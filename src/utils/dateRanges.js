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
    getRange: () => buildRange(end => shiftByDays(end, -5))
  },
  {
    id: '1m',
    label: '1 เดือน',
    getRange: () => buildRange(end => shiftByMonths(end, -1))
  },
  {
    id: '3m',
    label: '3 เดือน',
    getRange: () => buildRange(end => shiftByMonths(end, -3))
  },
  {
    id: '6m',
    label: '6 เดือน',
    getRange: () => buildRange(end => shiftByMonths(end, -6))
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
    getRange: () => buildRange(end => shiftByYears(end, -1))
  },
  {
    id: '5y',
    label: '5 ปี',
    getRange: () => buildRange(end => shiftByYears(end, -5))
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
