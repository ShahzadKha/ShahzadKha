"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { analyzeCandidate, requestAnalysis } from "@/lib/engine/pipeline";
import { enrollCandidate, moveCandidate } from "@/lib/nurture/engine";
import { assignSdr } from "@/lib/closing/engine";
import { CandidateStatus } from "@/generated/prisma/enums";

export type BulkState = { ok: boolean; done: number; at: number } | undefined;

// Actions on the candidates ticked in the list
export async function bulkAction(_prev: BulkState, formData: FormData): Promise<BulkState> {
  const user = await requireUser(["ADMIN", "RECRUITER"]);
  const ids = formData.getAll("ids").map(String).slice(0, 200);
  const action = String(formData.get("action") ?? "");
  if (ids.length === 0 || !action) return { ok: false, done: 0, at: Date.now() };
  const actor = { actorId: user.id };
  let done = 0;

  if (action === "analyze") {
    const queued: string[] = [];
    for (const id of ids) if (await requestAnalysis(id)) queued.push(id);
    after(async () => {
      for (const id of queued) await analyzeCandidate(id, user.id);
    });
    done = queued.length;
  } else if (action === "sequence") {
    for (const id of ids) if ((await enrollCandidate(id, { ...actor, force: true })).ok) done++;
  } else if (action === "assign") {
    for (const id of ids) if (await assignSdr(id, actor)) done++;
  } else if (action.startsWith("status:")) {
    const status = action.slice(7) as CandidateStatus;
    if (!(status in CandidateStatus)) return { ok: false, done: 0, at: Date.now() };
    for (const id of ids) {
      await moveCandidate(id, status, actor);
      done++;
    }
  } else if (action === "delete") {
    if (user.role !== "ADMIN") return { ok: false, done: 0, at: Date.now() };
    done = (await db.candidate.deleteMany({ where: { id: { in: ids } } })).count;
  } else {
    return { ok: false, done: 0, at: Date.now() };
  }
  revalidatePath("/candidates");
  revalidatePath("/pipeline");
  return { ok: true, done, at: Date.now() };
}
