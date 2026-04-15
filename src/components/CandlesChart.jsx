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

function toChartCandle(candle, index) {
  return {
    time: index,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    ts: candle.ts,
  };
}

function toDeltaBars(data) {
  return data.map((candle, index) => {
    const delta = Number(candle.buy_volume || 0) - Number(candle.sell_volume || 0);
    return {
      time: index,
      value: delta,
      color: delta >= 0 ? '#22c55e' : '#ef4444',
      ts: candle.ts,
    };
  });
}

function toFootprintRows(data) {
  return data.slice(-18).map((candle) => {
    const buyVolume = Number(candle.buy_volume || 0);
    const sellVolume = Number(candle.sell_volume || 0);
    const delta = buyVolume - sellVolume;
    const totalVolume = Number(candle.volume || 0);
    const footprintLevels = [
      { label: 'H', left: buyVolume * 0.18, right: sellVolume * 0.18 },
      { label: 'M', left: buyVolume * 0.32, right: sellVolume * 0.32 },
      { label: 'L', left: buyVolume * 0.5, right: sellVolume * 0.5 },
    ];

    const pointOfControlSide = buyVolume >= sellVolume ? 'buy' : 'sell';

    return {
      ts: candle.ts,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      buyVolume,
      sellVolume,
      delta,
      totalVolume,
      tradeCount: Number(candle.trade_count || 0),
      footprintLevels,
      pointOfControlSide,
    };
  });
}

function FootprintChart({ data }) {
  const rows = useMemo(() => toFootprintRows(data), [data]);

  return (
    <div className="footprint-chart">
      <div className="footprint-chart-grid">
        {rows.map((row) => {
          const bullish = row.close >= row.open;
          return (
            <div key={row.ts} className="footprint-column">
              <div className={`footprint-candle ${bullish ? 'bullish' : 'bearish'}`}>
                <div className="footprint-wick" />
                <div className="footprint-body-box">
                  {row.footprintLevels.map((level) => (
                    <div key={level.label} className="footprint-level">
                      <span className={`footprint-left ${row.pointOfControlSide === 'buy' ? 'point-of-control' : ''}`}>{Math.round(level.left)}</span>
                      <span className="footprint-mid">{level.label}</span>
                      <span className={`footprint-right ${row.pointOfControlSide === 'sell' ? 'point-of-control' : ''}`}>{Math.round(level.right)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="footprint-column-meta">
                <strong>{formatPrice(row.close)}</strong>
                <small>{formatLocalTickTime(Math.floor(new Date(row.ts).getTime() / 1000))}</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CandlesChart({ data, chartType = 'candles' }) {
  const deltaContainerRef = useRef(null);
  const mainContainerRef = useRef(null);
  const mainChartRef = useRef(null);
  const deltaChartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const deltaSeriesRef = useRef(null);
  const initializedRef = useRef(false);
  const lastLogicalTimeRef = useRef(null);
  const visibleRangeRef = useRef(null);
  const isUserInteractingRef = useRef(false);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (chartType !== 'candles') return;
    if (!mainContainerRef.current || !deltaContainerRef.current) return;

    const timeFormatter = (logical) => {
      const item = dataRef.current?.[logical];
      if (!item?.ts) return '';
      return formatLocalTickTime(Math.floor(new Date(item.ts).getTime() / 1000));
    };

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
        tickMarkFormatter: timeFormatter,
      },
      localization: {
        priceFormatter: formatPrice,
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
        tickMarkFormatter: timeFormatter,
      },
      rightPriceScale: {
        borderColor: '#1f2937',
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
      const latestIndex = Math.max(dataRef.current.length - 1, 0);
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
      mainChartRef.current = null;
      deltaChartRef.current = null;
      mainSeriesRef.current = null;
      deltaSeriesRef.current = null;
      initializedRef.current = false;
      lastLogicalTimeRef.current = null;
    };
  }, [chartType]);

  useEffect(() => {
    if (!deltaContainerRef.current || !data.length) return;

    if (chartType === 'candles') {
      if (!mainSeriesRef.current || !deltaSeriesRef.current || !mainChartRef.current || !deltaChartRef.current) {
        return;
      }

      const candleData = data.map(toChartCandle);
      const deltaBars = toDeltaBars(data);
      const latest = candleData[candleData.length - 1];
      const previousLastTime = lastLogicalTimeRef.current;

      if (!initializedRef.current) {
        mainSeriesRef.current.setData(candleData);
        deltaSeriesRef.current.setData(deltaBars);
        mainChartRef.current.timeScale().fitContent();
        deltaChartRef.current.timeScale().fitContent();
        initializedRef.current = true;
        lastLogicalTimeRef.current = latest.time;
        return;
      }

      if (previousLastTime === latest.time) {
        mainSeriesRef.current.update(latest);
        deltaSeriesRef.current.update(deltaBars[deltaBars.length - 1]);
      } else if (previousLastTime !== null && latest.time > previousLastTime) {
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

      lastLogicalTimeRef.current = latest.time;

      if (!isUserInteractingRef.current) {
        mainChartRef.current.timeScale().scrollToRealTime();
        deltaChartRef.current.timeScale().scrollToRealTime();
      } else if (visibleRangeRef.current) {
        mainChartRef.current.timeScale().setVisibleLogicalRange(visibleRangeRef.current);
        deltaChartRef.current.timeScale().setVisibleLogicalRange(visibleRangeRef.current);
      }
      return;
    }

    if (!deltaChartRef.current || !deltaSeriesRef.current) {
      const timeFormatter = (logical) => {
        const item = dataRef.current?.[logical];
        if (!item?.ts) return '';
        return formatLocalTickTime(Math.floor(new Date(item.ts).getTime() / 1000));
      };

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
          tickMarkFormatter: timeFormatter,
        },
      });

      const deltaSeries = deltaChart.addHistogramSeries({
        priceFormat: {
          type: 'volume',
        },
        base: 0,
      });

      deltaChartRef.current = deltaChart;
      deltaSeriesRef.current = deltaSeries;
    }

    const deltaBars = toDeltaBars(data);
    deltaSeriesRef.current.setData(deltaBars);
    deltaChartRef.current.timeScale().fitContent();
  }, [data, chartType]);

  return (
    <div className={`chart-stack ${chartType === 'footprint' ? 'footprint-mode' : 'candles-mode'}`}>
      <div className="primary-chart-area">
        {chartType === 'candles' ? (
          <div ref={mainContainerRef} className="main-chart-canvas" />
        ) : (
          <FootprintChart data={data} />
        )}
      </div>
      <div ref={deltaContainerRef} className="delta-chart-canvas" />
    </div>
  );
}
