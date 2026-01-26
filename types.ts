
export enum TradeStatus {
  ACTIVE = 'ACTIVE',
  PARTIAL = 'PARTIAL BOOKED',
  EXITED = 'EXITED',
  STOPPED = 'STOP LOSS HIT',
  ALL_TARGET = 'ALL TARGET DONE'
}

export enum InstrumentType {
  INDEX = 'INDEX',
  STOCK = 'STOCK'
}

export enum OptionType {
  CE = 'CE',
  PE = 'PE',
  FUT = 'FUT'
}

export interface TradeSignal {
  id: string;
  date?: string; // Format: YYYY-MM-DD
  instrument: string;
  symbol: string;
  type: OptionType;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  targets: number[];
  targetsHit?: number; 
  trailingSL?: number | null;
  status: TradeStatus;
  timestamp: string;
  lastTradedTimestamp?: string;
  pnlPoints?: number;
  pnlRupees?: number;
  comment?: string;
  quantity?: number;
  cmp?: number;
  isBTST?: boolean;
  sheetIndex?: number;
}

export interface InsightData {
  type: 'TREND' | 'DOMINANCE' | 'FLOW';
  symbol: string;
  sentiment?: 'Bullish' | 'Bearish';
  strength?: number;
  category?: 'Scalp' | 'Intraday' | 'Short-term' | 'Long-term';
  trend?: 'Bullish' | 'Bearish';
  pattern?: 'Narrow' | 'Range';
  phase?: 'Accumulation' | 'Distribution';
  viewOrigin?: number;
  cmp?: number;
  date?: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isAdminReply: boolean;
  broadcaster?: string;
}

export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  expiryDate: string;
  isAdmin: boolean;
  password?: string;
  lastPassword?: string; 
  deviceId?: string | null;
}

export interface LogEntry {
  timestamp: string;
  user: string;
  action: string;
  details: string;
  type: 'SECURITY' | 'TRADE' | 'USER' | 'SYSTEM';
}

export interface PnLStats {
  totalTrades: number;
  winRate: number;
  netPoints: number;
  estimatedPnL: number;
  accuracy: number;
}

export interface WatchlistItem {
  symbol: string;
  price: number;
  change: number;
  isPositive: boolean;
  lastUpdated: string;
}
