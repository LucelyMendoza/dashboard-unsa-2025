'use client';

import React from 'react';
import { Bar } from 'react-chartjs-2';
import '@/lib/chart-setup';
import { rate } from '@/lib/data-utils';
import { INDICATOR_CHART_COLORS } from '@/lib/chart-colors';
import { getChartAnimationDuration } from '@/lib/chart-motion';
import type { GroupedTotals } from '@/lib/data-utils';

export default function GroupedBarChart({
  groups,
}: {
  groups: GroupedTotals[];
}) {
  const labels = groups.map((g) => g.k);
  const COLORS = INDICATOR_CHART_COLORS;

  return (
    <div className="h-64 sm:h-80">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: 'Aprobados',
              data: groups.map((g) => rate(g.a, g.m)),
              backgroundColor: COLORS.apr,
              borderRadius: 5,
            },
            {
              label: 'Desaprobados',
              data: groups.map((g) => rate(g.d, g.m)),
              backgroundColor: COLORS.des,
              borderRadius: 5,
            },
            {
              label: 'Retiro',
              data: groups.map((g) => rate(g.r, g.m)),
              backgroundColor: COLORS.ret,
              borderRadius: 5,
            },
            {
              label: 'Abandono',
              data: groups.map((g) => rate(g.b, g.m)),
              backgroundColor: COLORS.abn,
              borderRadius: 5,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: getChartAnimationDuration(), easing: 'easeOutQuart' },

          scales: {
            x: {
              stacked: false,
              grid: {
                display: false,
              },
            },
            y: {
              stacked: false,
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: (value) => `${value}%`,
              },
            },
          },

          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: {
                  size: 11,
                },
              },
            },

            tooltip: {
              backgroundColor: '#292722',
              titleColor: '#ffffff',
              bodyColor: '#f5f3ef',
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: (context) =>
                  `${context.dataset.label}: ${Number(context.parsed.y).toFixed(2)}%`,
              },
            },
          },
        }}
      />
    </div>
  );
}