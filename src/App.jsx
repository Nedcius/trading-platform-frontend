import { useEffect, useState } from 'react';

const API_BASE = '/api';

export default function App() {
  const [health, setHealth] = useState(null);
  const [instruments, setInstruments] = useState([]);
  const [candles, setCandles] = useState([]);
  const [symbol, setSymbol] = useState('BTCUSDC');

  useEffect(() => {
    fetch(`${API_BASE}/health`).then((r) => r.json()).then(setHealth).catch(() => setHealth({ ok: 0 }));
    fetch(`${API_BASE}/instruments`).then((r) => r.json()).then(setInstruments).catch(() => setInstruments([]));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/candles/5m?symbol=${symbol}`)
      .then((r) => r.json())
      .then(setCandles)
      .catch(() => setCandles([]));
  }, [symbol]);

  return (
    <div className="app">
      <header>
        <h1>Trading Platform</h1>
        <p>Phase 1 frontend for market data and strategy UI</p>
      </header>

      <section className="card">
        <h2>API health</h2>
        <p>{health ? JSON.stringify(health) : 'Loading...'}</p>
      </section>

      <section className="card">
        <h2>Instrument</h2>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
          {instruments.filter((i) => i.is_active).map((i) => (
            <option key={i.id} value={i.symbol}>{i.symbol}</option>
          ))}
        </select>
      </section>

      <section className="card">
        <h2>Latest 5m candles for {symbol}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              {candles.slice(-20).reverse().map((c) => (
                <tr key={`${c.instrument_id}-${c.ts}`}>
                  <td>{c.ts}</td>
                  <td>{c.open}</td>
                  <td>{c.high}</td>
                  <td>{c.low}</td>
                  <td>{c.close}</td>
                  <td>{c.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
