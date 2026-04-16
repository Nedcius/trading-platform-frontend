import { useEffect, useMemo, useRef } from 'react';
import { ColorType, createChart } from 'lightweight-charts';

const CHART_BG = '#111827';
const GRID = '#1f2937';
const TEXT = '#e5e7eb';
const DELTA_BG = '#0f172a';
const BUY = '#22c55e';
const SELL = '#ef4444';
const POC = '#f59e0b';

function formatPrice(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatLocalTickTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(timestamp * 1000));
}

function toLogicalCandles(data) {
  return data.map((candle, index) => ({
    time: index,
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
    ts: candle.time ?? candle.ts,
    raw: candle,
  }));
}

function toDeltaBars(data) {
  return data.map((candle, index) => {
    const buyVolume = Number(candle.buy_volume ?? candle.buyVolume ?? 0);
    const sellVolume = Number(candle.sell_volume ?? candle.sellVolume ?? 0);
    const delta = buyVolume - sellVolume;

    return {
      time: index,
      value: delta,
      color: delta >= 0 ? BUY : SELL,
    };
  });
}

function normalizeFootprintData(data) {
  return data.map((bar, index) => {
    const levels = Array.isArray(bar.levels)
      ? bar.levels.map((level) => ({
          price: Number(level.price),
          buyVolume: Number(level.buyVolume ?? 0),
          sellVolume: Number(level.sellVolume ?? 0),
        }))
      : [];

    let pocPrice = null;
    let pocVolume = -1;
    for (const level of levels) {
      const total = level.buyVolume + level.sellVolume;
      if (total > pocVolume) {
        pocVolume = total;
        pocPrice = level.price;
      }
    }

    return {
      logicalTime: index,
      time: Number(bar.time ?? index),
      open: Number(bar.open),
      high: Number(bar.high),
      low: Number(bar.low),
      close: Number(bar.close),
      volume: Number(bar.volume ?? 0),
      levels,
      pocPrice,
    };
  });
}

function maybeBuildSyntheticLevels(data) {
  return data.map((bar) => {
    if (Array.isArray(bar.levels) && bar.levels.length > 0) {
      return bar;
    }

    const buyVolume = Number(bar.buy_volume ?? bar.buyVolume ?? 0);
    const sellVolume = Number(bar.sell_volume ?? bar.sellVolume ?? 0);
    const high = Number(bar.high);
    const low = Number(bar.low);
    const close = Number(bar.close);
    const open = Number(bar.open);
    const mid = (high + low) / 2;

    return {
      ...bar,
      time: Math.floor(new Date(bar.ts ?? bar.time * 1000).getTime() / 1000),
      levels: [
        { price: high, buyVolume: buyVolume * 0.2, sellVolume: sellVolume * 0.2 },
        { price: mid, buyVolume: buyVolume * 0.45, sellVolume: sellVolume * 0.45 },
        { price: low, buyVolume: buyVolume * 0.35, sellVolume: sellVolume * 0.35 },
        { price: close, buyVolume: buyVolume * 0.55, sellVolume: sellVolume * 0.25 },
        { price: open, buyVolume: buyVolume * 0.15, sellVolume: sellVolume * 0.55 },
      ],
    };
  });
}

function drawFootprintOverlay({ canvas, chart, bars }) {
  if (!canvas || !chart) return;

  const parent = canvas.parentElement;
  if (!parent) return;

  const dpr = window.devicePixelRatio || 1;
  const width = parent.clientWidth;
  const height = parent.clientHeight;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.font = '11px Inter, Arial, sans-serif';
  ctx.textBaseline = 'middle';

  const timeScale = chart.timeScale();

  for (const bar of bars) {
    const x = timeScale.logicalToCoordinate(bar.logicalTime);
    if (x == null) continue;

    const candleSpacing = timeScale.options().barSpacing ?? 10;
    const columnWidth = Math.max(42, candleSpacing * 3.2);
    const left = x - columnWidth / 2;
    const right = x + columnWidth / 2;

    const visibleLevels = bar.levels
      .map((level) => ({
        ...level,
        y: chart.priceScale('right').priceToCoordinate(level.price),
      }))
      .filter((level) => level.y != null)
      .sort((a, b) => a.price - b.price);

    if (!visibleLevels.length) continue;

    const step = visibleLevels.length > 1
      ? Math.max(16, Math.abs(visibleLevels[1].y - visibleLevels[0].y))
      : 18;

    for (const level of visibleLevels) {
      const total = level.buyVolume + level.sellVolume;
      const isPoc = bar.pocPrice === level.price;
      const top = level.y - step / 2;
      const cellHeight = step - 2;
      const middle = left + columnWidth / 2;

      if (isPoc) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
        ctx.fillRect(left, top, columnWidth, cellHeight);
        ctx.strokeStyle = POC;
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 0.5, top + 0.5, columnWidth - 1, cellHeight - 1);
      }

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(middle, top);
      ctx.lineTo(middle, top + cellHeight);
      ctx.stroke();

      ctx.fillStyle = isPoc ? '#fef3c7' : SELL;
      ctx.textAlign = 'right';
      ctx.fillText(String(Math.round(level.sellVolume)), middle - 4, level.y);

      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(formatPrice(level.price), middle, level.y);

      ctx.fillStyle = isPoc ? '#fef3c7' : BUY;
      ctx.textAlign = 'left';
      ctx.fillText(String(Math.round(level.buyVolume)), middle + 4, level.y);

      if (total > 0) {
        const intensity = Math.min(total / Math.max(bar.volume || 1, 1), 1);
        ctx.fillStyle = isPoc ? 'rgba(245, 158, 11, 0.28)' : 'rgba(59, 130, 246, 0.08)';
        ctx.fillRect(left, top, columnWidth * intensity, cellHeight);
      }
    }
  }
}

export default function CandlesChart({ data, chartType = 'candles' }) {
  const mainContainerRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const deltaContainerRef = useRef(null);
  const mainChartRef = useRef(null);
  const deltaChartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const deltaSeriesRef = useRef(null);
  const initializedRef = useRef(false);
  const lastLogicalTimeRef = useRef(null);
  const visibleRangeRef = useRef(null);
  const isUserInteractingRef = useRef(false);
  const dataRef = useRef(data);

  const footprintBars = useMemo(() => normalizeFootprintData(maybeBuildSyntheticLevels(data)), [data]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!mainContainerRef.current || !deltaContainerRef.current) return;

    const timeFormatter = (logical) => {
      const item = dataRef.current?.[logical];
      const ts = item?.time ?? item?.ts;
      if (!ts) return '';
      return formatLocalTickTime(typeof ts === 'number' ? ts : Math.floor(new Date(ts).getTime() / 1000));
    };

    const mainChart = createChart(mainContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: TEXT,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      width: mainContainerRef.current.clientWidth,
      height: mainContainerRef.current.clientHeight || 420,
      crosshair: {
        vertLine: { color: '#334155' },
        horzLine: { color: '#334155' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: timeFormatter,
      },
      localization: {
        priceFormatter: formatPrice,
      },
      rightPriceScale: {
        borderColor: GRID,
      },
    });

    const deltaChart = createChart(deltaContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: DELTA_BG },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      width: deltaContainerRef.current.clientWidth,
      height: deltaContainerRef.current.clientHeight || 140,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: timeFormatter,
      },
      rightPriceScale: {
        borderColor: GRID,
      },
    });

    const mainSeries = mainChart.addSeries('CandlestickSeries', {
      upColor: BUY,
      downColor: SELL,
      borderVisible: false,
      wickUpColor: BUY,
      wickDownColor: SELL,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.1,
      },
    });

    const deltaSeries = deltaChart.addSeries('HistogramSeries', {
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
      if (chartType === 'footprint') {
        drawFootprintOverlay({ canvas: overlayCanvasRef.current, chart: mainChart, bars: footprintBars });
      }
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
      if (chartType === 'footprint') {
        drawFootprintOverlay({ canvas: overlayCanvasRef.current, chart: mainChart, bars: footprintBars });
      }
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
  }, [chartType, footprintBars]);

  useEffect(() => {
    if (!data.length || !mainChartRef.current || !mainSeriesRef.current || !deltaChartRef.current || !deltaSeriesRef.current) {
      return;
    }

    const candleData = toLogicalCandles(data);
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
    } else if (previousLastTime === latest.time) {
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

    if (chartType === 'footprint') {
      drawFootprintOverlay({
        canvas: overlayCanvasRef.current,
        chart: mainChartRef.current,
        bars: footprintBars,
      });
    } else if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
      }
    }
  }, [data, chartType, footprintBars]);

  return (
    <div className={`chart-stack ${chartType === 'footprint' ? 'footprint-mode' : 'candles-mode'}`}>
      <div className="primary-chart-area">
        <div ref={mainContainerRef} className="main-chart-canvas" />
        <canvas
          ref={overlayCanvasRef}
          className="footprint-overlay-canvas"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: chartType === 'footprint' ? 1 : 0,
          }}
        />
      </div>
      <div ref={deltaContainerRef} className="delta-chart-canvas" />
    </div>
  );
}
