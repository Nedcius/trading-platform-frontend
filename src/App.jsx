import { useEffect, useMemo, useState } from 'react';

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
import CandlesChart from './components/CandlesChart';

const API_BASE = '/api';
const TIMEFRAMES = ['5m', '30m', '4h', '1d'];

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
          <div className="topbar-control">
            <span className="topbar-label">Instrument</span>
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
        </div>

        <div className="status-pill">API {health ? 'connected' : 'loading'}</div>
      </header>

      <main className="workspace">
        <section className="chart-panel">
          <div className="chart-frame">
            <CandlesChart data={candles} />
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
              <li>Last close: {latest?.close ?? 'Waiting for data'}</li>
              <li>Latest candle time: {formatUtcTimestamp(latest?.ts)}</li>
            </ul>
          </div>

          <div className="sidebar-card">
            <h2>Suggestions</h2>
            <ul className="sidebar-list">
              <li>Add volume bars under the chart.</li>
              <li>Add EMA overlays for trend context.</li>
              <li>Add strategy signal markers on candles.</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
