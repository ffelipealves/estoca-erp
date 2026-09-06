"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { StockBalancePoint } from "@/lib/api";

const SERIES_COLOR = "#0f8a5f";
const SURFACE_COLOR = "#fffdf8";
const PLOT_HEIGHT = 180;
const AXIS_BAND = 26;
const PADDING = { bottom: 10, left: 44, right: 16, top: 16 };

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

interface BalanceTimelineChartProps {
  points: StockBalancePoint[];
}

/** Escalas em passos limpos, para os rótulos do eixo não virarem 337 ou 1.013. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
}

export function BalanceTimelineChart({ points }: BalanceTimelineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Medimos a largura real em vez de fixar um viewBox: escalar encolheria também
  // os rótulos, ilegíveis no celular. A medição vem por três caminhos porque
  // ResizeObserver sozinho não é garantia — em aba throttled ele pode não
  // entregar nem o disparo inicial, e o gráfico ficaria com a largura errada.
  const measure = useCallback(() => {
    const measured = containerRef.current?.getBoundingClientRect().width;
    if (measured) setWidth(Math.max(240, Math.round(measured)));
  }, []);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const element = containerRef.current;
    window.addEventListener("resize", measure);

    let observer: ResizeObserver | undefined;
    if (element && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      observer.observe(element);
    }

    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [measure]);

  const geometry = useMemo(() => {
    const height = PLOT_HEIGHT + AXIS_BAND;
    const innerWidth = Math.max(width - PADDING.left - PADDING.right, 10);
    const innerHeight = PLOT_HEIGHT - PADDING.top - PADDING.bottom;

    const times = points.map((point) => new Date(point.at).getTime());
    const first = times[0];
    const last = times[times.length - 1];
    const span = Math.max(last - first, 1);
    const peak = Math.max(...points.map((point) => point.total_quantity), 1);
    const ceiling = niceCeiling(peak);

    const xOf = (time: number) =>
      PADDING.left + ((time - first) / span) * innerWidth;
    const yOf = (quantity: number) =>
      PADDING.top + innerHeight - (quantity / ceiling) * innerHeight;

    const coordinates = points.map((point, index) => ({
      x: xOf(times[index]),
      y: yOf(point.total_quantity),
    }));

    // Degrau, não diagonal: o saldo muda no evento e se mantém até o próximo.
    // Uma linha inclinada afirmaria uma variação contínua que não aconteceu.
    let line = `M ${coordinates[0].x} ${coordinates[0].y}`;
    for (let index = 1; index < coordinates.length; index += 1) {
      line += ` L ${coordinates[index].x} ${coordinates[index - 1].y}`;
      line += ` L ${coordinates[index].x} ${coordinates[index].y}`;
    }

    const baseline = PADDING.top + innerHeight;
    const area = `${line} L ${coordinates[coordinates.length - 1].x} ${baseline} L ${coordinates[0].x} ${baseline} Z`;

    return {
      area,
      baseline,
      ceiling,
      coordinates,
      first,
      height,
      last,
      line,
      ticks: [0, ceiling / 2, ceiling].map((value) => ({
        label: numberFormatter.format(Math.round(value)),
        value,
        y: yOf(value),
      })),
    };
  }, [points, width]);

  const active = hoveredIndex === null ? null : points[hoveredIndex];
  const activePoint = hoveredIndex === null ? null : geometry.coordinates[hoveredIndex];
  const last = points[points.length - 1];
  const peak = points.reduce(
    (highest, point) =>
      point.total_quantity > highest.total_quantity ? point : highest,
    points[0],
  );

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    // O viewBox pode estar escalado enquanto a medição não chega; converter
    // impede o crosshair de cair num ponto diferente do que o cursor aponta.
    const scale = bounds.width === 0 ? 1 : width / bounds.width;
    const x = (event.clientX - bounds.left) * scale;
    let nearest = 0;
    let smallest = Infinity;

    geometry.coordinates.forEach((coordinate, index) => {
      const distance = Math.abs(coordinate.x - x);
      if (distance < smallest) {
        smallest = distance;
        nearest = index;
      }
    });

    setHoveredIndex(nearest);
  }

  return (
    <div ref={containerRef}>
      <svg
        aria-label={`Saldo total do estoque de ${dateFormatter.format(new Date(geometry.first))} a ${dateFormatter.format(new Date(geometry.last))}, terminando em ${last.total_quantity} unidades`}
        className="block h-auto w-full touch-none"
        onPointerLeave={() => setHoveredIndex(null)}
        onPointerMove={handlePointerMove}
        role="img"
        viewBox={`0 0 ${width} ${geometry.height}`}
      >
        {geometry.ticks.map((tick) => (
          <g key={tick.value}>
            <line
              stroke="#e7e5e4"
              strokeWidth="1"
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={tick.y}
              y2={tick.y}
            />
            <text
              className="fill-stone-400 font-mono"
              dominantBaseline="middle"
              fontSize="10"
              textAnchor="end"
              x={PADDING.left - 8}
              y={tick.y}
            >
              {tick.label}
            </text>
          </g>
        ))}

        <path d={geometry.area} fill={SERIES_COLOR} opacity="0.1" />
        <path
          d={geometry.line}
          fill="none"
          stroke={SERIES_COLOR}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />

        <circle
          cx={geometry.coordinates[geometry.coordinates.length - 1].x}
          cy={geometry.coordinates[geometry.coordinates.length - 1].y}
          fill={SERIES_COLOR}
          r="4"
          stroke={SURFACE_COLOR}
          strokeWidth="2"
        />

        {activePoint ? (
          <g>
            <line
              stroke="#a8a29e"
              strokeWidth="1"
              x1={activePoint.x}
              x2={activePoint.x}
              y1={PADDING.top}
              y2={geometry.baseline}
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              fill={SERIES_COLOR}
              r="4.5"
              stroke={SURFACE_COLOR}
              strokeWidth="2"
            />
          </g>
        ) : null}

        <text
          className="fill-stone-400 font-mono"
          fontSize="10"
          x={PADDING.left}
          y={geometry.height - 8}
        >
          {dateFormatter.format(new Date(geometry.first))}
        </text>
        <text
          className="fill-stone-400 font-mono"
          fontSize="10"
          textAnchor="end"
          x={width - PADDING.right}
          y={geometry.height - 8}
        >
          {dateFormatter.format(new Date(geometry.last))}
        </text>
      </svg>

      <p className="mt-1 min-h-5 text-xs text-stone-600" aria-live="polite">
        {active ? (
          <>
            <span className="font-semibold text-stone-800">
              {numberFormatter.format(active.total_quantity)} un.
            </span>{" "}
            em {dateTimeFormatter.format(new Date(active.at))}
          </>
        ) : (
          <>
            Pico de {numberFormatter.format(peak.total_quantity)} un. em{" "}
            {dateFormatter.format(new Date(peak.at))} · saldo atual de{" "}
            {numberFormatter.format(last.total_quantity)} un.
          </>
        )}
      </p>
    </div>
  );
}
