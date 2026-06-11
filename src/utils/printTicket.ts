/**
 * printTicket — thermal-receipt printing through the system print dialog.
 *
 * Strategy: the most reliable way to reach a Bluetooth thermal printer
 * from a web app is NOT raw Bluetooth (Web Bluetooth is BLE-only, blocked
 * in Brave, impossible on iPad) — it's the OS print queue. When the
 * printer is installed at system level (Windows pairs the BT printer and
 * exposes it as a normal printer), window.print() with an 80mm @page
 * reaches it like any other app, and the OS queue shares it peacefully
 * with the bar's own POS program.
 *
 * The ticket window renders plain monospace at 72mm of content width —
 * the native format of an 80mm receipt roll. 58mm rolls also print fine
 * (driver scales or trims the margin).
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function printTicket(title: string, bodyText: string): void {
  // WhatsApp-style *bold* markers from the day sheet read as noise on a
  // receipt — strip them; thermal output is single-weight anyway.
  const clean = bodyText.replace(/\*([^*\n]+)\*/g, '$1');

  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  body {
    padding: 3mm 4mm 10mm;
    width: 72mm;
    font-family: "Courier New", ui-monospace, monospace;
    font-size: 12px; line-height: 1.4; color: #000;
  }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: inherit; }
</style></head><body><pre>${escapeHtml(clean)}</pre></body></html>`);
  w.document.close();
  w.focus();
  // Let the popup lay out before invoking the dialog; close after.
  setTimeout(() => {
    try { w.print(); } catch { /* ignore */ }
    setTimeout(() => { try { w.close(); } catch { /* ignore */ } }, 400);
  }, 250);
}
