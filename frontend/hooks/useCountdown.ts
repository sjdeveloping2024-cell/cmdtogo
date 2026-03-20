import { useState, useEffect } from 'react';

export type CountdownStatus = 'ok' | 'soon' | 'overdue';

export type CountdownResult = {
  secondsLeft: number;
  formatted:   string;
  status:      CountdownStatus;
};

function calcSeconds(dueDateStr: string): number {
  const [y, m, d] = dueDateStr.split('-').map(Number);
  return Math.floor((new Date(y, m - 1, d, 23, 59, 59).getTime() - Date.now()) / 1000);
}

function fmt(s: number): string {
  if (s <= 0) return 'OVERDUE';
  const d   = Math.floor(s / 86400);
  const h   = Math.floor((s % 86400) / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${String(h).padStart(2,'0')}h ${String(min).padStart(2,'0')}m`;
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

export function useCountdown(dueDateStr: string): CountdownResult {
  const [secondsLeft, set] = useState(() => calcSeconds(dueDateStr));

  useEffect(() => {
    set(calcSeconds(dueDateStr));
    const id = setInterval(() => set(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(id);
  }, [dueDateStr]);

  const status: CountdownStatus =
    secondsLeft <= 0      ? 'overdue' :
    secondsLeft <= 172800 ? 'soon'    : 'ok';

  return { secondsLeft, formatted: fmt(secondsLeft), status };
}
