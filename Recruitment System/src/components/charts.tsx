// Small single-series charts in plain HTML: one hue (--series-1), value at the bar end,
// hover tooltip via title, and a screen-reader table with the same numbers.

export type BarRow = { label: string; value: number; display?: string; note?: string };

export function BarList({ rows, unit, labelWidth = "9.5rem" }: { rows: BarRow[]; unit?: string; labelWidth?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      <ul className="space-y-3" aria-hidden>
        {rows.map((r) => (
          <li
            key={r.label}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: `${labelWidth} 1fr` }}
            title={`${r.label} : ${r.display ?? r.value}${unit ? ` ${unit}` : ""}${r.note ? ` (${r.note})` : ""}`}
          >
            <span className="truncate text-sm text-slate-600">{r.label}</span>
            <div className="flex items-center gap-2 border-l border-slate-300">
              {r.value > 0 && (
                <div
                  className="h-5 rounded-r-[4px] transition-opacity hover:opacity-80"
                  style={{ width: `calc((100% - 6rem) * ${r.value / max})`, background: "var(--series-1)" }}
                />
              )}
              <span className="whitespace-nowrap text-sm font-medium tabular-nums text-slate-900">
                {r.display ?? r.value}
                {r.note && <span className="ml-1.5 text-xs font-normal text-slate-500">{r.note}</span>}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{r.display ?? r.value}</td>
              {r.note && <td>{r.note}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ColumnChart({ columns, unit }: { columns: { label: string; value: number }[]; unit: string }) {
  const max = Math.max(1, ...columns.map((c) => c.value));
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5 border-b border-slate-300" aria-hidden>
        {columns.map((c) => (
          <div key={c.label} className="group flex h-full flex-1 flex-col justify-end" title={`${c.label} : ${c.value} ${unit}`}>
            <span className="mb-1 text-center text-[11px] font-medium tabular-nums text-slate-700">{c.value > 0 ? c.value : ""}</span>
            {c.value > 0 && (
              <div
                className="mx-auto w-full max-w-6 rounded-t-[4px] transition-opacity group-hover:opacity-80"
                style={{ height: `${(c.value / max) * 85}%`, background: "var(--series-1)" }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5" aria-hidden>
        {columns.map((c, i) => (
          <span key={c.label} className="flex-1 text-center text-[10px] text-slate-500">
            {i % 2 === 0 || columns.length <= 6 ? c.label : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>
          {columns.map((c) => (
            <tr key={c.label}>
              <th scope="row">{c.label}</th>
              <td>{c.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
