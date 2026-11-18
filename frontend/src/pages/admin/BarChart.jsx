import { useEffect, useRef, useState } from 'react'

/*
 * Single-series bar charts (one brand colour, so no legend is needed: the title names the series).
 * Marks: thin bars with 4px rounded data-ends, 2px gaps, recessive grid, hover tooltip on every bar,
 * hit targets larger than the bar, and a data table for screen readers / exact values.
 */

const Tooltip = ({ tip }) =>
  tip && (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <strong>{tip.title}</strong>
      {tip.lines.map((l) => <span key={l}>{l}</span>)}
    </div>
  )

/** Vertical bars, values 0..max. data: [{ key, label, value, tip: { title, lines } }] */
export function ColumnChart({ data, max = 100, height = 200, format = (v) => v, ticks = [0, 50, 100], title }) {
  const [tip, setTip] = useState(null)
  // Draw at the real pixel width so text stays 11px instead of scaling with the card
  const [W, setW] = useState(640)
  const ref = useRef(null)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  const pad = { l: 36, r: 8, t: 10, b: 26 }
  const iw = W - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const slot = iw / data.length
  const bw = Math.max(4, Math.min(28, slot - 6))
  const y = (v) => pad.t + ih - (Math.min(v, max) / max) * ih

  return (
    <div className="chart" ref={ref} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={pad.l - 8} y={y(t)} className="chart-axis" textAnchor="end" dominantBaseline="middle">{format(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pad.l + slot * i + slot / 2
          const h = Math.max(0, pad.t + ih - y(d.value))
          const r = Math.min(4, h, bw / 2)
          const top = pad.t + ih - h
          const x0 = cx - bw / 2
          return (
            <g key={d.key}>
              {h > 0 && (
                <path
                  className={`chart-bar ${tip?.key === d.key ? 'is-hover' : ''}`}
                  d={`M${x0},${pad.t + ih} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${pad.t + ih} Z`}
                />
              )}
              {(slot >= 46 || i % 2 === 0) && (
                <text x={cx} y={height - 8} className="chart-axis" textAnchor="middle">{d.label}</text>
              )}
              {/* hit target: the whole column, not just the bar */}
              <rect
                x={cx - slot / 2} y={pad.t} width={slot} height={ih} fill="transparent"
                onMouseEnter={() => setTip({ key: d.key, x: `${(cx / W) * 100}%`, y: `${(Math.min(top, pad.t + ih - 4) / height) * 100}%`, ...d.tip })}
              />
            </g>
          )
        })}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} className="chart-baseline" />
      </svg>
      <Tooltip tip={tip} />
    </div>
  )
}

/** Horizontal bars with direct value labels. data: [{ key, label, value, valueLabel, tip }] */
export function BarList({ data, title }) {
  const [tip, setTip] = useState(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="barlist" role="img" aria-label={title} onMouseLeave={() => setTip(null)}>
      {data.map((d) => (
        <div
          key={d.key}
          className={`barlist-row ${tip?.key === d.key ? 'is-hover' : ''}`}
          onMouseEnter={(e) => {
            const box = e.currentTarget.parentElement.getBoundingClientRect()
            const row = e.currentTarget.getBoundingClientRect()
            setTip({ key: d.key, x: `${((row.left - box.left + 140 + (row.width - 140) * (d.value / max)) / box.width) * 100}%`, y: `${row.top - box.top}px`, ...d.tip })
          }}
        >
          <span className="barlist-label">{d.label}</span>
          <span className="barlist-track">
            <span className="barlist-bar" style={{ width: `${(d.value / max) * 100}%` }} />
          </span>
          <span className="barlist-value">{d.valueLabel}</span>
        </div>
      ))}
      <Tooltip tip={tip} />
    </div>
  )
}

/** Exact numbers behind a chart, collapsed by default. */
export function DataTable({ columns, rows }) {
  return (
    <details className="chart-table">
      <summary>View as table</summary>
      <table>
        <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
      </table>
    </details>
  )
}
