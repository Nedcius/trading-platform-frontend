import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

function toChartCandle(candle) {
  return {
    time: Math.floor(new Date(candle.ts).getTime() / 1000),
    open: Number(candle.open),
    high: Number(candle.high),
    low: Number(candle.low),
    close: Number(candle.close),
  };
}

export default function CandlesChart({ data }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const initializedRef = useRef(false);
  const lastTimeRef = useRef(null);
  const visibleRangeRef = useRef(null);
  const isUserInteractingRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111827' },
        textColor: '#e5e7eb',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const timeScale = chart.timeScale();
    timeScale.subscribeVisibleLogicalRangeChange((range) => {
      visibleRangeRef.current = range;
      if (!range) return;

      const latestIndex = Math.max(data.length - 1, 0);
      const distanceFromRight = latestIndex - range.to;
      isUserInteractingRef.current = distanceFromRight > 3;
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (!containerRef.current) return;
      chart.applyOptions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight || 500,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current || !data.length) return;

    const chartData = data.map(toChartCandle);
    const latest = chartData[chartData.length - 1];
    const previousLastTime = lastTimeRef.current;

    if (!initializedRef.current) {
      seriesRef.current.setData(chartData);
      chartRef.current.timeScale().fitContent();
      initializedRef.current = true;
      lastTimeRef.current = latest.time;
      return;
    }

    if (previousLastTime === latest.time) {
      seriesRef.current.update(latest);
    } else if (previousLastTime && latest.time > previousLastTime) {
      const previous = chartData[chartData.length - 2];
      if (previous) {
        seriesRef.current.update(previous);
      }
      seriesRef.current.update(latest);
    } else {
      seriesRef.current.setData(chartData);
    }

    lastTimeRef.current = latest.time;

    if (!isUserInteractingRef.current) {
      chartRef.current.timeScale().scrollToRealTime();
    } else if (visibleRangeRef.current) {
      chartRef.current.timeScale().setVisibleLogicalRange(visibleRangeRef.current);
    }
  }, [data]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
