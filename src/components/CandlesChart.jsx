import { useEffect, useMemo, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

function formatPrice(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatLocalTickTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp * 1000));
}

function toChartCandle(candle) {
  return {
    time: Math.floor(new Date(candle.ts).getTime() / 1000),
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  };
}

function toDeltaBars(data) {
  return data.map((candle) => {
    const delta = Number(candle.buy_volume || 0) - Number(candle.sell_volume || 0);
    return {
      time: Math.floor(new Date(candle.ts).getTime() / 1000),
      value: delta,
      color: delta >= 0 ? '#22c55e' : '#ef4444',
    };
  });
}

function toFootprintRows(data) {
  return data.slice(-14).reverse().map((candle) => {
    const buyVolume = Number(candle.buy_volume || 0);
    const sellVolume = Number(candle.sell_volume || 0);
    const delta = buyVolume - sellVolume;

    return {
      ts: candle.ts,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      buyVolume,
      sellVolume,
      delta,
      totalVolume: Number(candle.volume || 0),
      tradeCount: Number(candle.trade_count || 0),
    };
  });
}

function ChartCanvas({ data, chartType }) {
  const mainContainerRef = useRef(null);
  const deltaContainerRef = useRef(null);
  const mainChartRef = useRef(null);
  const deltaChartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const deltaSeriesRef = useRef(null);
  const initializedRef = useRef(false);
  const lastTimeRef = useRef(null);
  const visibleRangeRef = useRef(null);
  const isUserInteractingRef = useRef(false);

  useEffect(() => {
    if (!mainContainerRef.current || !deltaContainerRef.current) return;

    const mainChart = createChart(mainContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#e5e7eb',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      width: mainContainerRef.current.clientWidth,
      height: mainContainerRef.current.clientHeight || 420,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        priceFormatter: formatPrice,
        timeFormatter: formatLocalTickTime,
      },
    });

    const deltaChart = createChart(deltaContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      width: deltaContainerRef.current.clientWidth,
      height: deltaContainerRef.current.clientHeight || 140,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1f2937',
      },
      localization: {
        timeFormatter: formatLocalTickTime,
      },
    });

    const mainSeries = mainChart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.1,
      },
    });

    const deltaSeries = deltaChart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      base: 0,
    });

    const syncRange = (range) => {
      visibleRangeRef.current = range;
      if (!range) return;

      deltaChart.timeScale().setVisibleLogicalRange(range);

      const latestIndex = Math.max(data.length - 1, 0);
      const distanceFromRight = latestIndex - range.to;
      isUserInteractingRef.current = distanceFromRight > 3;
    };

    mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncRange);

    mainChartRef.current = mainChart;
    deltaChartRef.current = deltaChart;
    mainSeriesRef.current = mainSeries;
    deltaSeriesRef.current = deltaSeries;

    const handleResize = () => {
      if (!mainContainerRef.current || !deltaContainerRef.current) return;
      mainChart.applyOptions({
        width: mainContainerRef.current.clientWidth,
        height: mainContainerRef.current.clientHeight || 420,
      });
      deltaChart.applyOptions({
        width: deltaContainerRef.current.clientWidth,
        height: deltaContainerRef.current.clientHeight || 140,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mainChart.remove();
      deltaChart.remove();
    };
  }, []);

  useEffect(() => {
    if (!mainSeriesRef.current || !deltaSeriesRef.current || !mainChartRef.current || !deltaChartRef.current || !data.length) {
      return;
    }

    const candleData = data.map(toChartCandle);
    const deltaBars = toDeltaBars(data);
    const latest = candleData[candleData.length - 1];
    const previousLastTime = lastTimeRef.current;

    if (!initializedRef.current) {
      mainSeriesRef.current.setData(candleData);
      deltaSeriesRef.current.setData(deltaBars);
      mainChartRef.current.timeScale().fitContent();
      deltaChartRef.current.timeScale().fitContent();
      initializedRef.current = true;
      lastTimeRef.current = latest.time;
      return;
    }

    if (previousLastTime === latest.time) {
      mainSeriesRef.current.update(latest);
      deltaSeriesRef.current.update(deltaBars[deltaBars.length - 1]);
    } else if (previousLastTime && latest.time > previousLastTime) {
      const previousCandle = candleData[candleData.length - 2];
      const previousDelta = deltaBars[deltaBars.length - 2];
      if (previousCandle) mainSeriesRef.current.update(previousCandle);
      if (previousDelta) deltaSeriesRef.current.update(previousDelta);
      mainSeriesRef.current.update(latest);
      deltaSeriesRef.current.update(deltaBars[deltaBars.length - 1]);
    } else {
      mainSeriesRef.current.setData(candleData);
      deltaSeriesRef.current.setData(deltaBars);
    }

    lastTimeRef.current = latest.time;

    if (!isUserInteractingRef.current) {
      mainChartRef.current.timeScale().scrollToRealTime();
      deltaChartRef.current.timeScale().scrollToRealTime();
    } else if (visibleRangeRef.current) {
      mainChartRef.current.timeScale().setVisibleLogicalRange(visibleRangeRef.current);
      deltaChartRef.current.timeScale().setVisibleLogicalRange(visibleRangeRef.current);
    }
  }, [data]);

  return (
    <div className="chart-stack">
      <div ref={mainContainerRef} className="main-chart-canvas" />
      <div ref={deltaContainerRef} className="delta-chart-canvas" />
      {chartType === 'footprint' && <FootprintOverlay data={data} />}
    </div>
  );
}

function FootprintOverlay({ data }) {
  const rows = useMemo(() => toFootprintRows(data), [data]);

  return (
    <div className="footprint-overlay">
      <div className="footprint-header">
        <span>Footprint</span>
        <span>Buy x Sell</span>
        <span>Delta</span>
      </div>
      <div className="footprint-body">
        {rows.map((row) => (
          <div key={row.ts} className="footprint-row">
            <div className="footprint-time">{formatLocalTickTime(Math.floor(new Date(row.ts).getTime() / 1000))}</div>
            <div className="footprint-price-range">
              <strong>{formatPrice(row.close)}</strong>
              <small>{formatPrice(row.low)} - {formatPrice(row.high)}</small>
            </div>
            <div className="footprint-flow">
              <span className="buy-volume">{formatPrice(row.buyVolume)}</span>
              <span className="divider">x</span>
              <span className="sell-volume">{formatPrice(row.sellVolume)}</span>
            </div>
            <div className={`footprint-delta ${row.delta >= 0 ? 'positive' : 'negative'}`}>
              {row.delta >= 0 ? '+' : ''}{formatPrice(row.delta)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CandlesChart({ data, chartType = 'candles' }) {
  return <ChartCanvas data={data} chartType={chartType} />;
}
