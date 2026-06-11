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

export function printComanda(r: Reservation, bizName: string, plan?: FloorPlan): void {
  const paras = (r.notes ?? '').trim().split(/\n+/).map(s => s.trim()).filter(Boolean);

  const sections = paras.map(p => {
    const lab = splitLabel(p);
    if (lab) {
      return `<div class="sec"><div class="sec-h">${esc(lab[0]).toUpperCase()}</div><div class="sec-b">${esc(lab[1])}</div></div>`;
    }
    return `<div class="sec"><div class="sec-b">${esc(p)}</div></div>`;
  }).join('');

  const printedAt = new Date().toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });

  const html = `
    <div class="biz">${esc(bizName.toUpperCase())}</div>
    <div class="date">${esc(fmtDateCa(r.date))}</div>
    <div class="rule"></div>
    <div class="hero">
      <span class="time">${esc(r.time)}</span>
      <span class="pax">${r.pax} PAX</span>
    </div>
    <div class="name">${esc(r.name)}</div>
    <div class="meta">Taules: ${esc(tableNames(r, plan))}</div>
    ${r.status === 'pending' ? '<div class="flag">PENDENT DE CONFIRMAR</div>' : ''}
    ${r.allergens && r.allergens.length > 0
      ? `<div class="allergy">⚠ AL·LÈRGIES: ${esc(r.allergens.join(', ').toUpperCase())}</div>` : ''}
    ${sections ? `<div class="rule"></div>${sections}` : ''}
    <div class="rule"></div>
    <div class="foot">NCR Reserves · imprès ${printedAt}</div>
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
    .sec   { margin: 0 0 7px; }
    .sec-h { font-size: 13px; font-weight: 700; text-decoration: underline; }
    .sec-b { font-size: 12.5px; line-height: 1.45; }
    .foot  { text-align: center; font-size: 9.5px; }
  `);
}
