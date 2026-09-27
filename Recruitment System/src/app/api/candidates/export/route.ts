import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { candidateFilters } from "@/lib/candidate-filters";

const COLUMNS = [
  "Prénom", "Nom", "Email", "Téléphone", "Ville", "Source", "Partenaire / campagne", "Statut", "Poste actuel", "Expérience (ans)",
  "Score global", "Adéquation", "Besoin", "Intention", "Éligible", "Parcours", "Formation recommandée",
  "Prix", "SDR", "Consentement RGPD", "Désinscrit", "Créé le",
];

// Values starting with = + - @ are prefixed so spreadsheets never run them as formulas
function cell(v: unknown) {
  if (v == null) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// CSV export of the candidate list with the same filters as the page (Excel-friendly: ; and UTF-8 BOM)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role === "SDR") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { where, orderBy } = candidateFilters(Object.fromEntries(request.nextUrl.searchParams));
  const rows = await db.candidate.findMany({
    where,
    orderBy,
    include: { recommendedProduct: { select: { name: true, price: true } }, assignedSdr: { select: { name: true } } },
  });
  const lines = [
    COLUMNS.join(";"),
    ...rows.map((c) =>
      [
        c.firstName, c.lastName, c.email, c.phone, c.city, c.source, c.sourceDetail, c.status, c.currentTitle, c.yearsExperience,
        c.globalScore, c.fitScore, c.needScore, c.intentScore, c.eligible == null ? "" : c.eligible ? "oui" : "non",
        c.routingTrack, c.recommendedProduct?.name, c.recommendedProduct?.price, c.assignedSdr?.name,
        c.consentAt, c.unsubscribedAt, c.createdAt,
      ].map(cell).join(";"),
    ),
  ];
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="candidats-${date}.csv"`,
    },
  });
}
