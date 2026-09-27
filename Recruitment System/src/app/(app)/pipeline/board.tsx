"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import clsx from "clsx";
import { GripVertical } from "lucide-react";
import { moveOnBoard } from "@/app/actions/nurture";
import { ScorePill } from "@/components/ui";
import type { CandidateStatus } from "@/generated/prisma/enums";
import type { Phase } from "@/lib/pipeline";

export type BoardCard = {
  id: string;
  name: string;
  title: string | null;
  score: number | null;
  product: string | null;
  track: string | null;
  sdr: string | null;
};
export type BoardColumn = { status: CandidateStatus; label: string; phase: Phase; total: number; cards: BoardCard[] };

// Column header accent per phase, matching the status badges
const PHASE_DOT: Record<Phase, string> = {
  acquisition: "bg-green-500",
  analysis: "bg-sky-500",
  nurturing: "bg-amber-500",
  qualification: "bg-violet-500",
  closing: "bg-teal-500",
  won: "bg-emerald-600",
  lost: "bg-slate-400",
};

type Move = { id: string; from: CandidateStatus; to: CandidateStatus };

function applyMove(cols: BoardColumn[], m: Move) {
  const card = cols.find((c) => c.status === m.from)?.cards.find((x) => x.id === m.id);
  if (!card) return cols;
  return cols.map((c) =>
    c.status === m.from
      ? { ...c, total: c.total - 1, cards: c.cards.filter((x) => x.id !== m.id) }
      : c.status === m.to
        ? { ...c, total: c.total + 1, cards: [card, ...c.cards] }
        : c,
  );
}

export function Board({ columns: initial, t }: { columns: BoardColumn[]; t: { empty: string; more: string; moved: string } }) {
  // The card moves right away; the server data takes over once the move is saved
  const [columns, addMove] = useOptimistic(initial, applyMove);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<CandidateStatus | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  function drop(to: CandidateStatus) {
    const id = dragging;
    setDragging(null);
    setOver(null);
    if (!id) return;
    const from = columns.find((c) => c.cards.some((card) => card.id === id));
    if (!from || from.status === to) return;
    const card = from.cards.find((c) => c.id === id)!;

    const label = columns.find((c) => c.status === to)?.label;
    startTransition(async () => {
      addMove({ id, from: from.status, to });
      // The action revalidates /pipeline, so the fresh board comes back with its response
      await moveOnBoard(id, to);
      setToast(`${card.name} → ${label}`);
    });
  }

  return (
    <div className="relative">
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
        {columns.map((col) => (
          <section
            key={col.status}
            aria-label={col.label}
            data-status={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.status);
            }}
            onDragLeave={() => setOver((o) => (o === col.status ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              drop(col.status);
            }}
            className={clsx(
              "flex w-64 shrink-0 flex-col rounded-xl border bg-slate-100/70 transition-colors",
              over === col.status ? "border-indigo-400 bg-indigo-50" : "border-slate-200",
            )}
          >
            <header className="flex items-center gap-2 px-3 py-2.5">
              <span className={clsx("size-2 rounded-full", PHASE_DOT[col.phase])} />
              <h2 className="flex-1 truncate text-sm font-semibold text-slate-800">{col.label}</h2>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">{col.total}</span>
            </header>
            <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
              {col.cards.map((card) => (
                <li
                  key={card.id}
                  draggable
                  data-testid="board-card"
                  onDragStart={(e) => {
                    setDragging(card.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", card.id);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                  className={clsx(
                    "group cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing",
                    dragging === card.id && "opacity-40",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="mt-0.5 size-4 shrink-0 text-slate-300 group-hover:text-slate-400" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <Link href={`/candidates/${card.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-600">
                        {card.name}
                      </Link>
                      {card.title && <p className="truncate text-xs text-slate-500">{card.title}</p>}
                    </div>
                    <ScorePill score={card.score} />
                  </div>
                  {(card.product || card.track || card.sdr) && (
                    <div className="mt-2 space-y-1 pl-6 text-[11px] text-slate-500">
                      {card.product && <p className="truncate">{card.product}</p>}
                      <div className="flex flex-wrap gap-1">
                        {card.track && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{card.track}</span>}
                        {card.sdr && <span className="rounded bg-teal-50 px-1.5 py-0.5 text-teal-800">{card.sdr}</span>}
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {col.cards.length === 0 && <li className="px-2 py-6 text-center text-xs text-slate-400">{t.empty}</li>}
              {col.total > col.cards.length && (
                <li className="px-2 py-1 text-center text-xs text-slate-500">+{col.total - col.cards.length} {t.more}</li>
              )}
            </ul>
          </section>
        ))}
      </div>
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {t.moved} : {toast}
        </div>
      )}
    </div>
  );
}
