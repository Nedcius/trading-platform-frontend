import { useEffect, useState } from 'react';
import CandlesChart from './components/CandlesChart';

const API_BASE = '/api';
const TIMEFRAMES = ['5m', '30m', '4h', '1d'];

export default function App() {
  const [health, setHealth] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [candles, setCandles] = useState([]);
  const [symbol, setSymbol] = useState('BTCUSDC');
  const [timeframe, setTimeframe] = useState('5m');

  useEffect(() => {
    fetch(`${API_BASE}/health`).then((r) => r.json()).then(setHealth).catch(() => setHealth({ ok: 0 }));
    fetch(`${API_BASE}/instruments`).then((r) => r.json()).then(setInstruments).catch(() => setInstruments([]));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/candles/${timeframe}?symbol=${symbol}`)
      .then((r) => r.json())
      .then(setCandles)
      .catch(() => setCandles([]));
  }, [symbol, timeframe]);

  const latest = candles.length ? candles[candles.length - 1] : null;

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Trading Platform</h1>
          <p>TradingView-style market UI for strategy development</p>
        </div>
        <div className="health">API: {health ? JSON.stringify(health) : 'Loading...'}</div>
      </header>

      <section className="toolbar card">
        <div>
          <label>Instrument</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
            {instruments.filter((i) => i.is_active).map((i) => (
              <option key={i.id} value={i.symbol}>{i.symbol}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Timeframe</label>
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
      </section>

      <section className="stats card">
        <div><strong>Symbol:</strong> {symbol}</div>
        <div><strong>Timeframe:</strong> {timeframe}</div>
        <div><strong>Last Close:</strong> {latest?.close ?? '-'}</div>
        <div><strong>Volume:</strong> {latest?.volume ?? '-'}</div>
        <div><strong>Updated:</strong> {latest?.ts ?? '-'}</div>
      </section>

      <section className="card chart-card">
        <h2>{symbol} Candles</h2>
        <CandlesChart data={candles} />
      </section>
    </div>
  );
}
