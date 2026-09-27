import type { Phase } from "@/lib/pipeline";

// Single-series horizontal bar chart: one hue, value at the bar tip, hover tooltip via title.
export function PhaseBars({ rows, unit }: { rows: { phase: Phase; label: string; count: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const pct = (r.count / max) * 100;
          return (
            <li key={r.phase} className="grid grid-cols-[9.5rem_1fr] items-center gap-3" title={`${r.label} : ${r.count} ${unit}`}>
              <span className="truncate text-sm text-slate-600">{r.label}</span>
              <div className="flex items-center gap-2 border-l border-slate-300">
                {r.count > 0 && (
                  <div
                    className="h-5 rounded-r-[4px] transition-opacity hover:opacity-80"
                    style={{ width: `calc((100% - 2.5rem) * ${pct / 100})`, background: "var(--series-1)" }}
                  />
                )}
                <span className="text-sm font-medium tabular-nums text-slate-900">{r.count}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {/* Accessible table view of the same data */}
      <table className="sr-only">
        <tbody>
          {rows.map((r) => (
            <tr key={r.phase}>
              <th scope="row">{r.label}</th>
              <td>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
