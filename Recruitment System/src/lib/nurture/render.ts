// Turns a template (plain text with {{variables}}) into the email that is sent.

export type TemplateVars = {
  prenom: string;
  nom: string;
  produit: string;
  prix: string;
  poste: string;
  marque: string;
  lien_offre: string;
  lien_paiement: string;
  lien_avis: string;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function fill(template: string, vars: TemplateVars) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) =>
    key in vars ? vars[key as keyof TemplateVars] : match,
  );
}

export function renderEmail(
  t: { subject: string; body: string },
  vars: TemplateVars,
  links: { unsubscribe: string; openPixel?: string },
) {
  const subject = fill(t.subject, vars).replace(/\s+/g, " ").trim();
  const text = `${fill(t.body, vars)}\n\n—\nSe désinscrire : ${links.unsubscribe}`;

  // HTML: escape everything, then turn the links into buttons and keep line breaks
  const buttons: [string, string][] = [
    [vars.lien_offre, "Voir mon offre"],
    [vars.lien_paiement, "Finaliser mon inscription"],
    [vars.lien_avis, "Donner mon avis"],
  ];
  let bodyHtml = escapeHtml(fill(t.body, vars));
  for (const [url, label] of buttons) {
    if (!url) continue;
    const safe = escapeHtml(url);
    bodyHtml = bodyHtml
      .split(safe)
      .join(`<a href="${safe}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${label}</a>`);
  }
  bodyHtml = bodyHtml.replace(/\n/g, "<br>");
  const html = `<!doctype html><html><body style="margin:0;background:#f6f7f9;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;font-size:15px;line-height:1.6">${bodyHtml}</div>
<p style="max-width:560px;margin:12px auto 0;font-size:12px;color:#64748b;text-align:center"><a href="${escapeHtml(links.unsubscribe)}" style="color:#64748b">Se désinscrire</a></p>
${links.openPixel ? `<img src="${escapeHtml(links.openPixel)}" width="1" height="1" alt="" style="display:block">` : ""}
</body></html>`;
  return { subject, text, html };
}
