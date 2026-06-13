/**
 * printTicket — thermal-receipt printing through the system print dialog.
 *
 * Strategy: the most reliable way to reach a Bluetooth thermal printer
 * from a web app is NOT raw Bluetooth (Web Bluetooth is BLE-only, blocked
 * in Brave, impossible on iPad) — it's the OS print queue. When the
 * printer is installed at system level, window.print() with an 80mm
 * @page reaches it like any other app, and the queue shares it
 * peacefully with the bar's own POS program.
 *
 * Two flavours:
 *   • printTicket()  — preformatted text (day sheet). *asterisk* spans
 *     render as real bold.
 *   • printComanda() — structured kitchen ticket for one reservation:
 *     big time/PAX header, allergies in a solid black box (thermal
 *     prints it as a filled bar — unmissable), comanda sections with
 *     their labels as headers.
 *
 * Kitchen-typography rules: read at arm's length, mid-service. Time and
 * covers are the biggest thing on the paper; everything else steps down.
 */
import type { FloorPlan, Reservation } from '@/types';
import { fmtDateCa } from './whatsapp';
import { translateCaEs, fmtDateEs } from './caEs';

// ── Print language (persisted device setting) ────────────────────────────────

export type PrintLang = 'ca' | 'es';

export function getPrintLang(): PrintLang {
  try { return localStorage.getItem('ncr-print-lang') === 'es' ? 'es' : 'ca'; } catch { return 'ca'; }
}

export function setPrintLang(l: PrintLang): void {
  try { localStorage.setItem('ncr-print-lang', l); } catch { /* ignore */ }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PAGE_CSS = `
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    padding: 3mm 4mm 10mm;
    width: 72mm;
    font-family: "Courier New", ui-monospace, monospace;
    color: #000;
  }
`;

function openAndPrint(title: string, bodyHtml: string, extraCss = ''): void {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${esc(title)}</title>
<style>${PAGE_CSS}${extraCss}</style></head><body>${bodyHtml}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try { w.print(); } catch { /* ignore */ }
    setTimeout(() => { try { w.close(); } catch { /* ignore */ } }, 400);
  }, 250);
}

// ─── Preformatted text (day sheet) ────────────────────────────────────────────

export function printTicket(title: string, bodyText: string): void {
  // *asterisk* spans become real bold on paper.
  const html = esc(bodyText).replace(/\*([^*\n]+)\*/g, '<b>$1</b>');
  openAndPrint(title, `<pre>${html}</pre>`, `
    pre { margin: 0; white-space: pre-wrap; word-break: break-word;
          font: inherit; font-size: 11.5px; line-height: 1.45; }
    b { font-size: 12.5px; }
  `);
}

// ─── Structured comanda ticket ────────────────────────────────────────────────

function tableNames(r: Reservation, plan?: FloorPlan): string {
  if (!r.tableIds || r.tableIds.length === 0) return 'sense taula';
  return r.tableIds
    .map(id => plan?.tables.find(t => t.id === id)?.name ?? id)
    .join(' + ');
}

/** "Adults: 2 amanides…" → ["Adults", "2 amanides…"]; null when the
 *  paragraph has no leading label. */
function splitLabel(p: string): [string, string] | null {
  const m = /^([A-Za-zÀ-ÿ··'’ ]{2,24}):\s+(.+)$/s.exec(p);
  return m ? [m[1].trim(), m[2].trim()] : null;
}

/**
 * Comanda body → kitchen list. The cook reads quantities, not prose:
 * "2 amanides, 4 formatges, 5 entranyes" becomes one line per dish with
 * the quantity big and bold in its own column.
 *
 * Split points (conservative — when unsure, keep text together):
 *   • ", 4 …"            comma followed by a quantity
 *   • " i 1 Stromboli"   "i" + quantity + Capitalized dish (lowercase
 *                        after the digit stays glued: "—5 rostit i 5
 *                        pernil—" is a parenthetical, not an item)
 *   • ". Pizzes adults: …" an inline "Label:" after a period opens a
 *                        sub-section with its own underlined header
 */
function renderBody(text: string): string {
  const chunks = text.split(/\.\s+(?=[A-ZÀ-Ý][^.:\n]{1,28}:\s)/);
  let html = '';
  for (const raw of chunks) {
    const lab = splitLabel(raw);
    if (lab) {
      const labelUp = lab[0].toUpperCase();
      // IMPORTANT/alert sections get an inverse black bar — the one thing
      // a cook must never skim past (allergies, isolation, substitutions).
      const alert = /^IMPORTANT(E)?$|^ATENCIÓN?$|^ATENCIO$|^AL·?LERG|^ALERG/i.test(lab[0].trim());
      html += `<div class="sec-h${alert ? ' sec-h--alert' : ''}">${esc(labelUp)}</div>`;
    }
    const body = (lab ? lab[1] : raw).trim().replace(/\.+\s*$/, '');
    const items = body
      .split(/,\s+(?=\d)/)
      .flatMap(s => s.split(/\s+[iy]\s+(?=\d+\s+[A-ZÀ-Ý])/));
    if (items.length > 1 || /^\d/.test(body)) {
      html += '<div class="items">' + items.map(it => {
        const m = /^(\d+)\s*(.*)$/s.exec(it.trim());
        const qty  = m ? m[1] : '';
        const rest = (m ? m[2] : it).trim();
        return `<div class="item"><span class="qty">${esc(qty)}</span><span class="it">${esc(rest)}</span></div>`;
      }).join('') + '</div>';
    } else {
      html += `<div class="sec-b">${esc(body)}</div>`;
    }
  }
  return html;
}

/** True for section labels that must print as an inverse black bar. */
function isAlertLabel(label: string): boolean {
  return /^IMPORTANT(E)?$|^ATENCIÓN?$|^ATENCIO$|^AL·?LERG|^ALERG/i.test(label.trim());
}

/** Inline content after a "Label: …" — quantity list or prose. */
function renderInline(content: string): string {
  const body = content.trim().replace(/\.+\s*$/, '');
  if (!body) return '';
  if (/^\d/.test(body)) {
    const items = body
      .split(/,\s+(?=\d)/)
      .flatMap(s => s.split(/\s+[iy]\s+(?=\d+\s+[A-ZÀ-Ý])/));
    return '<div class="items">' + items.map(it => {
      const m = /^(\d+)\s*(.*)$/s.exec(it.trim());
      return `<div class="item"><span class="qty">${esc(m ? m[1] : '')}</span><span class="it">${esc((m ? m[2] : it).trim())}</span></div>`;
    }).join('') + '</div>';
  }
  return `<div class="sec-b">${esc(body)}</div>`;
}

/**
 * LINE-BASED comanda format — the recommended way to write comandes in
 * the reservation notes. One element per line:
 *
 *   TAPES:                     ← section header (alone on its line)
 *   PIZZES ADULTS: 3 Bacon     ← header + content on the same line
 *   13 Quatre Formatges        ← quantity item (qty in its own column)
 *   3x Barbacoa                ← "x" after the number also accepted
 *   - sense ceba               ← bullet → indented note line
 *   free text                  ← prose (secondary weight)
 *   IMPORTANT:                 ← alert section → inverse black bar
 *
 * Blank lines just separate. Used whenever the note has ≥1 line break;
 * single-paragraph prose falls back to the legacy heuristics above.
 */
function renderStructured(lines: string[]): string {
  let html = '';
  let itemsOpen = false;
  const closeItems = () => { if (itemsOpen) { html += '</div>'; itemsOpen = false; } };
  const openItems  = () => { if (!itemsOpen) { html += '<div class="items">'; itemsOpen = true; } };
  const pushItem = (qty: string, rest: string) => {
    openItems();
    html += `<div class="item"><span class="qty">${esc(qty)}</span><span class="it">${esc(rest)}</span></div>`;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeItems(); continue; }

    // Section header: "LABEL:" or "LABEL: content". A label must not start
    // with a digit ("20:00 arriba el grup" stays prose) NOR end with one —
    // otherwise a clock time on its own line ("Juvenil A — 21:00h",
    // "Dissabte, 20:10h") gets split at the colon into a fake header
    // ("JUVENIL A — 21") plus a bogus quantity ("00 h").
    const header = /^([^:\n]{2,28}):\s*(.*)$/.exec(line);
    if (header && !/^\d/.test(header[1]) && !/\d$/.test(header[1].trim())) {
      closeItems();
      const alert = isAlertLabel(header[1]);
      html += `<div class="sec-h${alert ? ' sec-h--alert' : ''}">${esc(header[1].trim().toUpperCase())}</div>`;
      if (header[2].trim()) html += renderInline(header[2]);
      continue;
    }

    // Quantity item: "13 Quatre Formatges" / "3x Barbacoa" / "3 x Barbacoa"
    const qtyItem = /^(\d{1,3})\s*(?:[x×]\s*)?\s*(.+)$/.exec(line);
    if (qtyItem) { pushItem(qtyItem[1], qtyItem[2].trim()); continue; }

    // Bullet: "- sense ceba" → item row without a quantity
    const bullet = /^[-•*]\s+(.+)$/.exec(line);
    if (bullet) { pushItem('', bullet[1].trim()); continue; }

    // Prose
    closeItems();
    html += `<div class="sec-b">${esc(line)}</div>`;
  }
  closeItems();
  return html;
}

export function printComanda(r: Reservation, bizName: string, plan?: FloorPlan): void {
  // Device-level print language: cooks read Spanish, the floor books in
  // Catalan. Chrome labels switch and the comanda body runs through the
  // gastronomy dictionary (utils/caEs.ts); unknown words pass through.
  const lang = getPrintLang();
  const L = lang === 'es'
    ? { taules: 'Mesas', pendent: 'PENDIENTE DE CONFIRMAR', allerg: 'ALERGIAS', impres: 'impreso' }
    : { taules: 'Taules', pendent: 'PENDENT DE CONFIRMAR', allerg: 'AL·LÈRGIES', impres: 'imprès' };
  const dateStr  = lang === 'es' ? fmtDateEs(r.date) : fmtDateCa(r.date);
  const notesSrc = lang === 'es' ? translateCaEs(r.notes ?? '') : (r.notes ?? '');
  const allergTx = lang === 'es'
    ? translateCaEs((r.allergens ?? []).join(', '))
    : (r.allergens ?? []).join(', ');

  // Multi-line notes use the line-based comanda format (reliable, one
  // element per line). Legacy single-paragraph prose keeps the original
  // sentence-splitting heuristics so old reservations still print well.
  const trimmed = notesSrc.trim();
  const sections = !trimmed
    ? ''
    : trimmed.includes('\n')
      ? `<div class="sec">${renderStructured(trimmed.split('\n'))}</div>`
      : `<div class="sec">${renderBody(trimmed)}</div>`;

  const printedAt = new Date().toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div class="biz">${esc(bizName.toUpperCase())}</div>
    <div class="date">${esc(dateStr)}</div>
    <div class="rule"></div>
    <div class="hero">
      <span class="time">${esc(r.time)}</span>
      <span class="pax">${r.pax} PAX</span>
    </div>
    <div class="name">${esc(r.name)}</div>
    <div class="meta">${L.taules}: ${esc(tableNames(r, plan))}</div>
    ${r.status === 'pending' ? `<div class="flag">${L.pendent}</div>` : ''}
    ${r.allergens && r.allergens.length > 0
      ? `<div class="allergy">⚠ ${L.allerg}: ${esc(allergTx.toUpperCase())}</div>` : ''}
    ${sections ? `<div class="rule"></div>${sections}` : ''}
    <div class="rule"></div>
    <div class="foot">NCR Reserves · ${L.impres} ${printedAt}</div>
  `;

  openAndPrint(`Comanda — ${r.name}`, html, `
    .biz   { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 1px; }
    .date  { text-align: center; font-size: 11px; margin-top: 1px; }
    .rule  { border-top: 1px dashed #000; margin: 7px 0; }
    .hero  { display: flex; justify-content: space-between; align-items: baseline; }
    /* ── Kitchen typographic hierarchy ───────────────────────────────
       Heavy sans (prints near-solid black on thermal) but with clear
       LEVELS so the eye scans instead of drowning in uniform bold:
         1. HERO  20:00 · 77 PAX        28px/800  — the glance
         2. QTY   13                    19px/800  — what to cook, how many
         3. DISH  Quatre Formatges      15.5px/700
         4. PROSE free text             13.5px/400 — context, secondary
         5. LABEL section headers       12px/800 small caps w/ thick rule
         ⚠  IMPORTANT sections          inverse black bar, unmissable  */
    .time  { font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: 800; }
    .pax   { font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: 800; }
    .name  { font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 700; margin-top: 3px; }
    .meta  { font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; font-weight: 600; margin-top: 2px; }
    .flag  { margin-top: 5px; font-size: 13px; font-weight: 800;
             font-family: Arial, Helvetica, sans-serif;
             border: 2px solid #000; padding: 3px 6px; text-align: center; }
    .allergy { margin-top: 5px; font-size: 14px; font-weight: 800;
               font-family: Arial, Helvetica, sans-serif;
               background: #000; color: #fff; padding: 4px 6px;
               -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sec   { margin: 0 0 10px; }
    .sec-h { font-family: Arial, Helvetica, sans-serif; font-size: 12px;
             font-weight: 800; letter-spacing: 1.5px;
             display: inline-block; border-bottom: 2px solid #000;
             padding-bottom: 1px; margin: 8px 0 4px; }
    .sec-h--alert {
      display: block; border-bottom: none;
      background: #000; color: #fff;
      padding: 3px 6px; margin: 9px 0 4px;
      font-size: 13px; letter-spacing: 2px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .sec-b { font-family: Arial, Helvetica, sans-serif; font-weight: 400;
             font-size: 13.5px; line-height: 1.4; margin: 2px 0; }
    /* Free text inside an IMPORTANT section reads at dish weight — it's
       operational (allergies, timing), not ambience. */
    .sec-h--alert + .items .it, .sec-h--alert + .sec-b {
      font-weight: 700; font-size: 14.5px; }
    .items { margin: 3px 0; }
    .item  { display: flex; gap: 7px; margin: 0 0 5px; align-items: baseline; }
    .qty   { min-width: 26px; font-family: Arial, Helvetica, sans-serif;
             font-size: 19px; font-weight: 800; text-align: right; flex-shrink: 0; }
    .it    { font-family: Arial, Helvetica, sans-serif; font-weight: 700;
             font-size: 15.5px; line-height: 1.3; }
    .foot  { text-align: center; font-size: 9.5px; }
  `);
}
