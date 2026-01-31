
import { TradeSignal, WatchlistItem, User, TradeStatus, LogEntry, ChatMessage, InsightData } from '../types';

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzsGgTmJET-j414jqdLl3mQSy0Rm444KOWORIUAnsZHB2SFZVJKuAeHIeoMA-dDEyef/exec'.trim();

export interface SheetData {
  signals: (TradeSignal & { sheetIndex: number })[];
  history: TradeSignal[];
  watchlist: WatchlistItem[];
  users: User[];
  logs: LogEntry[];
  messages: ChatMessage[];
  insights: InsightData[];
}

const robustParseJson = (text: string) => {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    const jsonMatch = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        throw new Error("JSON structure corrupted.");
      }
    }
    if (trimmed.toLowerCase().includes('<!doctype html>')) {
      throw new Error("Terminal access denied. Verify script deployment permissions.");
    }
    throw new Error("Invalid terminal response format.");
  }
};

const getVal = (obj: any, targetKey: string): any => {
  if (!obj || typeof obj !== 'object') return undefined;
  const normalizedTarget = targetKey.toLowerCase().replace(/\s|_|-/g, '');
  for (const key in obj) {
    if (key.toLowerCase().replace(/\s|_|-/g, '') === normalizedTarget) return obj[key];
  }
  return undefined;
};

const getNum = (obj: any, key: string): number | undefined => {
  let val = getVal(obj, key);
  if (val === undefined || val === null || String(val).trim() === '') return undefined;
  const cleanVal = String(val).replace(/[^\d.-]/g, '');
  const n = parseFloat(cleanVal);
  return isNaN(n) ? undefined : n;
};

const isTrue = (val: any): boolean => {
  if (val === true || val === 1 || val === '1') return true;
  const s = String(val || '').toUpperCase().trim().replace(/\./g, '');
  return ['TRUE', 'YES', 'Y', 'BTST', 'B.T.S.T', 'ADMIN', 'OK', '1'].includes(s);
};

const normalizeStatus = (val: any): TradeStatus => {
  if (val === undefined || val === null || val === '') return TradeStatus.ACTIVE;
  const s = String(val).toUpperCase().trim();
  if (s === '3' || s.includes('ALL TARGET')) return TradeStatus.ALL_TARGET;
  if (s.includes('PARTIAL') || s.includes('BOOKED')) return TradeStatus.PARTIAL;
  if (s.includes('STOP') || s.includes('SL HIT') || s.includes('LOSS') || s.includes('STOPPED')) return TradeStatus.STOPPED;
  if (s.includes('EXIT') || s.includes('CLOSE') || s.includes('SQUARE')) return TradeStatus.EXITED;
  return TradeStatus.ACTIVE;
};

const parseSignalRow = (s: any, index: number, tabName: string): TradeSignal | null => {
  const instrument = String(getVal(s, 'instrument') || '').trim();
  const symbol = String(getVal(s, 'symbol') || '').trim();
  const entryPrice = getNum(s, 'entryPrice');
  
  if (!instrument || !symbol || instrument.length < 2 || entryPrice === undefined || entryPrice === 0) return null;

  const rawTargets = getVal(s, 'targets');
  let parsedTargets: number[] = [];
  if (typeof rawTargets === 'string' && rawTargets.trim() !== '') {
    parsedTargets = rawTargets.split(',').map(t => parseFloat(t.trim())).filter(n => !isNaN(n));
  } else if (Array.isArray(rawTargets)) {
    parsedTargets = rawTargets.map(t => parseFloat(t)).filter(n => !isNaN(n));
  } else if (rawTargets != null && !isNaN(Number(rawTargets))) {
    parsedTargets = [Number(rawTargets)];
  }

  const rawId = getVal(s, 'id');
  const id = rawId ? String(rawId).trim() : 
    `sig-${instrument}-${symbol}-${entryPrice}-${getVal(s, 'timestamp') || index}`.replace(/\s+/g, '-');

  return {
    ...s,
    id,
    instrument,
    symbol,
    entryPrice: entryPrice,
    stopLoss: getNum(s, 'stopLoss') || 0,
    targets: parsedTargets,
    targetsHit: getNum(s, 'targetsHit') || 0, 
    trailingSL: getNum(s, 'trailingSL') ?? null,
    pnlPoints: getNum(s, 'pnlPoints'),
    pnlRupees: getNum(s, 'pnlRupees'),
    cmp: getNum(s, 'cmp'), 
    action: (getVal(s, 'action') || 'BUY') as 'BUY' | 'SELL',
    status: normalizeStatus(getVal(s, 'status')),
    timestamp: getVal(s, 'timestamp') || new Date().toISOString(),
    isBTST: isTrue(getVal(s, 'isBTST')),
    quantity: getNum(s, 'quantity') || 0
  };
};

export const fetchSheetData = async (retries = 3): Promise<SheetData | null> => {
  if (!SCRIPT_URL) return null;
  
  try {
    const response = await fetch(`${SCRIPT_URL}?v=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      redirect: 'follow'
    });
    
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const responseText = await response.text();
    const data = robustParseJson(responseText);
    
    return { 
      signals: (data.signals || [])
        .map((s: any, i: number) => ({ ...parseSignalRow(s, i, 'SIG'), sheetIndex: i }))
        .filter((s: any) => s !== null && s.id !== undefined) as (TradeSignal & { sheetIndex: number })[],
      history: (data.history || [])
        .map((s: any, i: number) => parseSignalRow(s, i, 'HIST'))
        .filter((s: any) => s !== null) as TradeSignal[],
      watchlist: (data.watchlist || []).map((w: any) => ({ 
        ...w, 
        symbol: String(getVal(w, 'symbol') || ''),
        price: Number(getVal(w, 'price') || 0),
        change: Number(getVal(w, 'change') || 0),
        isPositive: isTrue(getVal(w, 'isPositive'))
      })).filter((w: any) => w.symbol),
      users: (data.users || []).map((u: any) => ({
        id: String(getVal(u, 'id') || getVal(u, 'userId') || '').trim(),
        name: String(getVal(u, 'name') || 'Client').trim(),
        phoneNumber: String(getVal(u, 'phoneNumber') || '').trim(),
        expiryDate: String(getVal(u, 'expiryDate') || '').trim(),
        isAdmin: isTrue(getVal(u, 'isAdmin')),
        password: String(getVal(u, 'password') || '').trim(),
        lastPassword: String(getVal(u, 'lastPassword') || '').trim(),
        deviceId: String(getVal(u, 'deviceId') || getVal(u, 'hwid') || getVal(u, 'hardwareid') || '').trim() || null
      })),
      logs: (data.logs || []).map((l: any) => {
        const detailsVal = getVal(l, 'details') || getVal(l, 'detail') || '';
        return {
          timestamp: getVal(l, 'timestamp') || new Date().toISOString(),
          user: String(getVal(l, 'user') || 'System'),
          action: String(getVal(l, 'action') || 'N/A'),
          details: typeof detailsVal === 'object' ? JSON.stringify(detailsVal) : String(detailsVal),
          type: (String(getVal(l, 'type') || 'SYSTEM')).toUpperCase() as any
        };
      }),
      messages: (data.messages || []).map((m: any) => {
        const text = String(getVal(m, 'text') || '').trim();
        const timestamp = String(getVal(m, 'timestamp') || '').trim();
        const id = String(getVal(m, 'id') || '').trim() || 
                   `msg-${text.slice(0, 10)}-${timestamp}`.replace(/\s+/g, '-');
        
        // Attempt to find broadcaster in multiple potential columns
        const broadcasterRaw = getVal(m, 'broadcaster') || getVal(m, 'senderName') || getVal(m, 'adminName');
        const broadcaster = (broadcasterRaw === undefined || broadcasterRaw === null || String(broadcasterRaw).toLowerCase() === 'undefined') 
          ? '' 
          : String(broadcasterRaw).trim();

        return {
          id,
          userId: String(getVal(m, 'userId') || '').trim(),
          senderName: broadcaster, // Sync senderName with broadcaster for internal consistency
          text,
          timestamp: timestamp || new Date().toISOString(),
          isAdminReply: isTrue(getVal(m, 'isAdminReply')),
          broadcaster: broadcaster
        };
      }),
      insights: (data.insights || []).map((ins: any) => ({
        type: String(getVal(ins, 'type') || '').toUpperCase() as any,
        symbol: String(getVal(ins, 'symbol') || '').trim(),
        sentiment: getVal(ins, 'sentiment') as any,
        strength: getNum(ins, 'strength'),
        category: getVal(ins, 'category') as any,
        trend: getVal(ins, 'trend') as any,
        pattern: getVal(ins, 'pattern') as any,
        phase: getVal(ins, 'phase') as any,
        viewOrigin: getNum(ins, 'originPrice') ?? getNum(ins, 'viewOrigin'),
        cmp: getNum(ins, 'cmp'),
        date: String(getVal(ins, 'date') || '').trim()
      }))
    };
  } catch (error) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1500));
      return fetchSheetData(retries - 1);
    }
    return null;
  }
};

export const updateSheetData = async (target: string, action: string, payload: any, id?: string) => {
  if (!SCRIPT_URL) return false;
  try {
    const cleanPayload = { ...payload };
    if (cleanPayload.targets && Array.isArray(cleanPayload.targets)) {
      cleanPayload.targets = cleanPayload.targets.join(', ');
    }

    if (target === 'users' && payload.deviceId !== undefined) {
      cleanPayload.deviceId = payload.deviceId;
    }

    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ target, action, payload: cleanPayload, id })
    });
    return true; 
  } catch (error) { 
    return false; 
  }
};
