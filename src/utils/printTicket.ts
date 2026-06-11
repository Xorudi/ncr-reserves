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
    if (lab) html += `<div class="sec-h">${esc(lab[0]).toUpperCase()}</div>`;
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

  const paras = notesSrc.trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
  const sections = paras.map(p => `<div class="sec">${renderBody(p)}</div>`).join('');

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
    .time  { font-size: 26px; font-weight: 700; }
    .pax   { font-size: 26px; font-weight: 700; }
    .name  { font-size: 15px; font-weight: 700; margin-top: 3px; }
    .meta  { font-size: 12px; margin-top: 2px; }
    .flag  { margin-top: 5px; font-size: 12px; font-weight: 700;
             border: 2px solid #000; padding: 3px 6px; text-align: center; }
    .allergy { margin-top: 5px; font-size: 13px; font-weight: 700;
               background: #000; color: #fff; padding: 4px 6px;
               -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sec   { margin: 0 0 8px; }
    .sec-h { font-size: 14px; font-weight: 700; text-decoration: underline; margin: 6px 0 3px; }
    .sec-b { font-size: 13.5px; line-height: 1.4; margin: 2px 0; }
    .items { margin: 2px 0; }
    .item  { display: flex; gap: 6px; margin: 0 0 3px; align-items: baseline; }
    .qty   { min-width: 24px; font-size: 17px; font-weight: 700; text-align: right; flex-shrink: 0; }
    .it    { font-size: 13.5px; line-height: 1.35; }
    .foot  { text-align: center; font-size: 9.5px; }
  `);
}
