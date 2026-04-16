import { useEffect, useMemo, useState } from 'react';
import CandlesChart from './components/CandlesChart';

function formatUtcTimestamp(ts) {
  if (!ts) return 'Waiting for data';

  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatPrice(value) {
  if (value === null || value === undefined || value === '') return 'Waiting for data';

  const number = Number(value);
  if (Number.isNaN(number)) return value;

  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(number);
}

const API_BASE = '/api';
const TIMEFRAMES = ['5m', '30m', '4h', '1d'];
const CHART_TYPES = [
  { value: 'candles', label: 'Candles' },
  { value: 'footprint', label: 'Footprint' },
];

const STRATEGY_OPTIONS = [
  { name: 'Momentum Breakout', description: 'Follow strong directional continuation after range expansion.' },
  { name: 'Mean Reversion', description: 'Look for pullbacks into value after stretched candles.' },
  { name: 'Trend Pullback', description: 'Stay aligned with the dominant move and buy dips or sell rallies.' },
];

export default function App() {
  const [health, setHealth] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [candles, setCandles] = useState([]);
  const [symbol, setSymbol] = useState('BTCUSDC');
  const [timeframe, setTimeframe] = useState('5m');
  const [chartType, setChartType] = useState('candles');
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGY_OPTIONS[0].name);

  useEffect(() => {
    fetch(`${API_BASE}/health`).then((r) => r.json()).then(setHealth).catch(() => setHealth({ ok: 0 }));
    fetch(`${API_BASE}/instruments`).then((r) => r.json()).then(setInstruments).catch(() => setInstruments([]));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCandles = () => {
      fetch(`${API_BASE}/candles/${timeframe}?symbol=${symbol}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) {
            setCandles(data);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setCandles([]);
          }
        });
    };

    loadCandles();
    const interval = window.setInterval(loadCandles, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [symbol, timeframe]);

  const latest = candles.length ? candles[candles.length - 1] : null;
  const activeInstruments = instruments.filter((i) => i.is_active);
  const selectedStrategyDetails = useMemo(
    () => STRATEGY_OPTIONS.find((strategy) => strategy.name === selectedStrategy),
    [selectedStrategy]
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-group">
          <div className="brand">Trading Platform</div>
          <div className="topbar-control compact-control">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {activeInstruments.map((instrument) => (
                <option key={instrument.id} value={instrument.symbol}>{instrument.symbol}</option>
              ))}
            </select>
          </div>
          <div className="topbar-control timeframe-control">
            <span className="topbar-label">Candles</span>
            <div className="timeframes">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  className={tf === timeframe ? 'active' : ''}
                  onClick={() => setTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="topbar-control timeframe-control">
            <span className="topbar-label">Chart</span>
            <div className="timeframes">
              {CHART_TYPES.map((type) => (
                <button
                  key={type.value}
                  className={type.value === chartType ? 'active' : ''}
                  onClick={() => setChartType(type.value)}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="status-pill">API {health ? 'connected' : 'loading'}</div>
      </header>

      <main className="workspace">
        <section className="chart-panel">
          <div className="chart-frame">
            <CandlesChart
              data={candles.map((candle) => ({
                ...candle,
                time: candle.time ?? Math.floor(new Date(candle.ts).getTime() / 1000),
              }))}
              chartType={chartType}
            />
          </div>
        </section>

        <aside className="right-sidebar">
          <div className="sidebar-card">
            <h2>Strategies</h2>
            <div className="strategy-list">
              {STRATEGY_OPTIONS.map((strategy) => (
                <button
                  key={strategy.name}
                  className={`strategy-button ${selectedStrategy === strategy.name ? 'selected' : ''}`}
                  onClick={() => setSelectedStrategy(strategy.name)}
                >
                  <span>{strategy.name}</span>
                  <small>{strategy.description}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar-card">
            <h2>Strategy details</h2>
            <p className="sidebar-copy">{selectedStrategyDetails?.description}</p>
            <ul className="sidebar-list">
              <li>Preferred symbol: {symbol}</li>
              <li>Working timeframe: {timeframe}</li>
              <li>Chart type: {chartType}</li>
              <li>Last close: {formatPrice(latest?.close)}</li>
              <li>Latest candle time: {formatUtcTimestamp(latest?.ts)}</li>
            </ul>
          </div>

          <div className="sidebar-card">
            <h2>Flow snapshot</h2>
            <ul className="sidebar-list">
              <li>Buy volume: {formatPrice(latest?.buy_volume)}</li>
              <li>Sell volume: {formatPrice(latest?.sell_volume)}</li>
              <li>Delta: {formatPrice((Number(latest?.buy_volume || 0) - Number(latest?.sell_volume || 0)).toFixed(2))}</li>
              <li>Trades: {latest?.trade_count ?? 'Waiting for data'}</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
