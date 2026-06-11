/**
 * caEs — Catalan → Spanish translation for kitchen tickets.
 *
 * The cooks read Spanish; the bookings are taken in Catalan. A full MT
 * engine needs a server — but a kitchen comanda is quantities + dish
 * nouns, and a curated gastronomy dictionary covers the real vocabulary
 * of a bar menu. Unknown words pass through untouched (half the menu is
 * identical in both languages anyway: pizza, barbacoa, fingers…).
 *
 * Longest-match-first so "galta de porc" wins over "galta"+"porc", with
 * word boundaries (no matches inside words) and case preservation
 * (ADULTS → ADULTOS, Amanida → Ensalada).
 */

const DICT: [string, string][] = [
  // ── Multi-word first (longest match wins) ──
  ['galta de porc', 'carrillera de cerdo'],
  ['pa amb tomàquet', 'pan con tomate'],
  ['fruits secs', 'frutos secos'],
  ['salsa a part', 'salsa aparte'],
  ['per defecte', 'por defecto'],
  ['a part', 'aparte'],
  ['per compartir', 'para compartir'],
  // ── Dishes & ingredients ──
  ['amanides', 'ensaladas'], ['amanida', 'ensalada'],
  ['tomàquet', 'tomate'], ['tomàquets', 'tomates'],
  ['formatges', 'quesos'], ['formatge', 'queso'],
  ['pernil', 'jamón'],
  ['entranyes', 'entrañas'],
  ['croquetes', 'croquetas'], ['croqueta', 'croqueta'],
  ['braves', 'bravas'],
  ['patates', 'patatas'],
  ['pollastre', 'pollo'],
  ['vedella', 'ternera'],
  ['xai', 'cordero'],
  ['porc', 'cerdo'],
  ['peix', 'pescado'],
  ['marisc', 'marisco'],
  ['gambes', 'gambas'],
  ['calamars', 'calamares'],
  ['sípia', 'sepia'],
  ['musclos', 'mejillones'],
  ['cloïsses', 'almejas'],
  ['bacallà', 'bacalao'],
  ['ous', 'huevos'], ['ou', 'huevo'],
  ['ceba', 'cebolla'],
  ['olives', 'aceitunas'],
  ['embotits', 'embutidos'],
  ['butifarra', 'butifarra'], ['buti', 'buti'],
  ['gelat', 'helado'],
  ['pastís', 'pastel'],
  ['llet', 'leche'],
  ['bolonyesa', 'boloñesa'],
  ['rostit', 'asado'], ['rostits', 'asados'],
  ['filetejada', 'fileteada'], ['filetejat', 'fileteado'],
  ['aïllada', 'aislada'], ['aillada', 'aislada'], ['aïllat', 'aislado'],
  // ── Menu structure ──
  ['tapes', 'tapas'],
  ['primers', 'primeros'],
  ['segons', 'segundos'],
  ['postres', 'postres'],
  ['entrants', 'entrantes'],
  ['pizzes', 'pizzas'],
  ['racions', 'raciones'], ['ració', 'ración'],
  ['plats', 'platos'], ['plat', 'plato'],
  ['combinat', 'combinado'],
  ['variat', 'variado'],
  ['beguda', 'bebida'], ['begudes', 'bebidas'],
  ['cervesa', 'cerveza'],
  ['vi', 'vino'],
  ['aigua', 'agua'],
  ['cafè', 'café'],
  // ── People & service ──
  ['adults', 'adultos'], ['adult', 'adulto'],
  ['nens', 'niños'], ['nen', 'niño'], ['nenes', 'niñas'], ['nena', 'niña'],
  ['soparan', 'cenarán'], ['sopar', 'cena'],
  ['dinaran', 'comerán'], ['dinar', 'comida'],
  ['esmorzar', 'desayuno'],
  ['taula', 'mesa'], ['taules', 'mesas'],
  ['trona', 'trona'],
  ['compartida', 'compartida'],
  // ── Allergy / diet ──
  ['al·lèrgies', 'alergias'], ['al·lèrgia', 'alergia'],
  ['alergics', 'alérgicos'], ['alergic', 'alérgico'],
  ['celíacs', 'celíacos'], ['celíac', 'celíaco'],
  ['celiacs', 'celiacos'], ['celiac', 'celiaco'], ['celiaca', 'celiaca'],
  ['proteïna', 'proteína'], ['proteina', 'proteína'],
  ['lactosa', 'lactosa'],
  ['vegà', 'vegano'], ['vegana', 'vegana'], ['vega', 'vegana'],
  // ── Connectors & frequent words ──
  ['important', 'importante'],
  ['sense', 'sin'],
  ['amb', 'con'],
  ['abans', 'antes'],
  ['després', 'después'],
  ['faltarà', 'faltará'],
  ['també', 'también'],
  ['només', 'solo'],
  ['mare', 'madre'],
  ['pare', 'padre'],
  ['que els', 'que los'],
  ['els', 'los'],
  ['les', 'las'],
  ['una', 'una'],
  ['i', 'y'],
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Preserve the casing shape of the matched text on the replacement. */
function matchCase(es: string, matched: string): string {
  if (matched === matched.toUpperCase() && /[A-ZÀ-Ý]/.test(matched)) return es.toUpperCase();
  if (/^[A-ZÀ-Ý]/.test(matched)) return es.charAt(0).toUpperCase() + es.slice(1);
  return es;
}

const RULES: [RegExp, string][] = DICT.map(([ca, es]) => [
  new RegExp(`(?<![\\wÀ-ÿ·])${escapeRe(ca)}(?![\\wÀ-ÿ·])`, 'gi'),
  es,
]);

export function translateCaEs(text: string): string {
  let out = text;
  for (const [re, es] of RULES) {
    out = out.replace(re, m => matchCase(es, m));
  }
  return out;
}

// ── Spanish date for the ticket header ───────────────────────────────────────

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function fmtDateEs(isoDate: string): string {
  const d = new Date(isoDate + 'T00:00:00');
  if (isNaN(d.getTime())) return isoDate;
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
}
