"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { TimelinePoint } from "@/lib/estoca/selectors"
import type { Product } from "@/lib/estoca/types"
import { OpShape } from "./op-shape"
import { MOVEMENT_META } from "@/lib/estoca/rules"
import { formatDateTime, formatDayMonth, formatInt } from "@/lib/estoca/format"

const SURFACE = "#fbfcfb"
const INK = "#23272b"
const DAY = 86_400_000

export default function BalanceTimeline({
  points,
  productsById,
}: {
  points: TimelinePoint[]
  productsById: Map<string, Product>
}) {
  const start = points[0]?.t ?? 0
  const end = points[points.length - 1]?.t ?? 0
  const ticks = React.useMemo(() => {
    const out: number[] = []
    const first = new Date(start)
    first.setHours(0, 0, 0, 0)
    for (let t = first.getTime(); t <= end; t += 2 * DAY) out.push(t)
    return out
  }, [start, end])

  return (
    <div className="h-[240px] w-full sm:h-[300px] lg:h-auto lg:min-h-[300px] lg:flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid vertical={false} stroke="#e3e8e6" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[start, end]}
            ticks={ticks}
            tickFormatter={(t) => formatDayMonth(t)}
            tick={{ fill: "#545d62", fontSize: 12 }}
            axisLine={{ stroke: "#c9d1ce" }}
            tickLine={false}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(v) => formatInt(v)}
            tick={{ fill: "#545d62", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={52}
            domain={[(min: number) => Math.max(0, Math.floor((min * 0.94) / 50) * 50), (max: number) => Math.ceil((max * 1.03) / 50) * 50]}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: INK, strokeWidth: 1 }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as TimelinePoint | undefined
              if (!active || !point) return null
              const m = point.movement
              const product = m ? productsById.get(m.productId) : undefined
              const when = m
                ? formatDateTime(m.createdAt)
                : point.t === start
                  ? "Início do histórico"
                  : point.count === 0
                    ? "Agora"
                    : `${formatDateTime(new Date(point.t).toISOString())}, ${point.count} movimentações`
              return (
                <div className="max-w-64 rounded-md border border-input bg-popover px-3 py-2.5 text-[13px] shadow-[0_12px_32px_-12px_rgb(27_31_34/0.35)]">
                  <p className="text-muted-foreground">{when}</p>
                  {m && product ? (
                    <p className="mt-1 flex items-center gap-1.5 font-semibold">
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                        <OpShape type={m.type} cx={7} cy={7} r={4} />
                      </svg>
                      {MOVEMENT_META[m.type].label}: {product.name}
                    </p>
                  ) : null}
                  <p className="mt-1">
                    Saldo total <strong className="font-bold tabular-nums">{formatInt(point.units)} un.</strong>
                    {m ? (
                      <span className="text-muted-foreground tabular-nums">
                        {" "}
                        ({m.delta >= 0 ? "+" : "−"}
                        {formatInt(Math.abs(m.delta))})
                      </span>
                    ) : null}
                  </p>
                </div>
              )
            }}
          />
          <Line
            type="stepAfter"
            dataKey="units"
            stroke={INK}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; payload?: TimelinePoint; index?: number }) => {
              const { cx, cy, payload, index } = props
              if (cx == null || cy == null || !payload?.movement) return <g key={`d-${index}`} />
              return <OpShape key={`d-${index}`} type={payload.movement.type} cx={cx} cy={cy} />
            }}
            activeDot={{ r: 5, fill: INK, stroke: SURFACE, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
