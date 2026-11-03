"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import {
  BarChart,
  BoxplotChart,
  LineChart,
  ScatterChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsCoreOption } from "echarts/core";

echarts.use([
  BarChart,
  BoxplotChart,
  LineChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export interface EChartProps {
  option: EChartsCoreOption;
  height?: number;
  className?: string;
  notMerge?: boolean;
}

export default function EChart({
  option,
  height = 220,
  className,
  notMerge = true,
}: EChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const chart = echarts.init(container, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, { notMerge });
  }, [option, notMerge]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height }}
    />
  );
}
