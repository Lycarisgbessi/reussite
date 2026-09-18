'use client';

// ═══════════════════════════════════════════════════════════════
// CHARTS — helpers recharts (couleurs thème ambre, tooltips FR)
// ═══════════════════════════════════════════════════════════════
import * as React from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { formatNumber } from './helpers';

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

const axisStyle: React.SVGProps<SVGTextElement> = { fontSize: 11, fill: 'oklch(0.5 0.015 60)' };

function shortDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

interface TrendChartProps {
  data: { date: string; [k: string]: string | number }[];
  series: SeriesDef[];
  height?: number;
  mode?: 'area' | 'line';
}

/** Graphique temporel (visites, vues…) — aires ou lignes. */
export function TrendChart({ data, series, height = 280, mode = 'area' }: TrendChartProps) {
  const Chart = mode === 'area' ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => formatNumber(v)} />
        <Tooltip
          formatter={(value: number | string, name: string) => [formatNumber(Number(value)), name]}
          labelFormatter={(label: string) => (label ? new Date(label).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : label)}
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--popover-foreground)',
          }}
        />
        {series.map((s) =>
          mode === 'area' ? (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#grad-${s.key})`} />
          ) : (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

interface BarsChartProps {
  data: Record<string, string | number>[];
  xKey: string;
  bars: SeriesDef[];
  height?: number;
  layout?: 'horizontal' | 'vertical';
}

/** Graphique à barres (sources de trafic, campagnes…). */
export function BarsChart({ data, xKey, bars, height = 280, layout = 'horizontal' }: BarsChartProps) {
  const vertical = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 12, left: vertical ? 24 : -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatNumber(v)} />
            <YAxis type="category" dataKey={xKey} tick={{ ...axisStyle, fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={axisStyle} tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis tick={axisStyle} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => formatNumber(v)} />
          </>
        )}
        <Tooltip
          formatter={(value: number | string, name: string) => [formatNumber(Number(value)), name]}
          cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--popover-foreground)',
          }}
        />
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={38} fillOpacity={0.9 - i * 0.15} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
