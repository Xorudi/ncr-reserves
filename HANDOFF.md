# NCR Reserves — Handoff

**Última actualización:** 2026-06-01
**Branch:** `main` (limpio, todo pusheado)
**Último commit:** `1ae305a` — fix stacking del TableSelectorModal desde accions del briefing

---

## Qué es

App de reserves per a restaurant català (NCR Reserves). Stack: **React + TypeScript + Vite + Tailwind**, estat global amb **Zustand** (`useAppStore`). Pensada per a tauleta (touch) i mòbil. L'objectiu de les últimes fases ha estat convertir-la d'una llista de reserves a un **assistent operatiu premium ("Restaurant OS")**.

## Restriccions intocables (CRÍTIC)

No tocar mai, sota cap concepte:
- Lògica del PIN (`verifyPin`, hashing, resolució de scope)
- Auth flow / Supabase / RLS
- Lògica de negoci
- Animacions d'obertura del "llibre"
- Shader `PremiumRestaurantAmbient` (pantalla de bloqueig)

---

## Arquitectura del sistema d'IA contextual (4 fases completades)

### 1. Motor d'insights — `src/utils/insights.ts`
- Cada insight té `priority` (0-100), `category`, i elegibilitat com a `headline`.
- `pickHeadlineInsight(insights)` → millor insight ≥50 per al hero.
- `pickSecondaryInsights(insights, headlineId?, max, quiet)` → strip secundari, filtra el hero, ≥25, cap a 2 en dies tranquils.
- Còpia humanitzada en català ("Ritme més tranquil que un dissabte habitual").

### 2. UI d'insights
- **`InsightOfMoment.tsx`** — hero card. Sempre tocable: corre l'acció o dispara `app:open-briefing`. Glow respirant.
- **`SmartInsightsStrip.tsx`** — chips secundaris, to calmat, sense soroll visual.
- Regla **"smart silence"**: l'IA ha de saber callar. Dies amb ≤3 reserves → mode quiet.

### 3. Capa ambiental — `src/hooks/useAmbientState.ts`
- Deriva `level` (calm/normal/busy/peak), `intensity` (0..1), `flags`, `microcopy`, `hourSignals`.
- **`DashboardAmbient.tsx`** modula `--ambient-amp` (0.85..1.15) sobre els blobs de fons.
- Respecta `prefers-reduced-motion` arreu.

### 4. Briefing del servei (assistent operatiu)
- **`src/utils/briefing.ts`** — `generateBriefing()` → `{ summary, risks, actions, level }`. Accions són **discriminated union** tipades (`assign-table`, `confirm-reservations`, `review-layout`, `review-weather`, `attend-queue`, `scroll-to-hour`).
- **`BriefingSheet.tsx`** — narrativa + risks + accions. Accions multi-reserva es deleguen al host via `onRunAction`; les single-shot es gestionen inline.
- **`BriefingActionSheet.tsx`** — resol accions sobre llistes de reserves. Flux confirmar (status→confirmed + toast) i assignar taula (obre TableSelectorModal inline).

---

## Z-index ladder (memoritzar)
```
AnimatedSheet ............. 99 / 100
BriefingActionSheet ...... 119 / 120
TableSelectorModal ....... 300 / 301  (portaled a document.body)
```
**Per què el portal:** AnimatedSheet usa animació `transform` → crea stacking context que atrapa `position:fixed`. `TableSelectorModal` s'escapa amb `createPortal(..., document.body)`.

---

## Integració al shell — `src/views/touch/TouchShell.tsx`
- Fetch de forecast a nivell shell (`shellForecast`, re-fetch en canviar de dia).
- `ambient = useAmbientState({...})`.
- Listener `app:open-briefing` → `setShowBriefing(true)`.
- `handleBriefingAction` routeja `assign-table`/`confirm-reservations` → `setBriefingAction`.
- `BriefingSheet` + `BriefingActionSheet` muntats en branques tablet I mòbil.
- TabletTopBar: date picker (`<label>`) i briefing (`<button>`) són **germans**, mai niuats (un label dispara onClick encara que el fill faci stopPropagation).

---

## Bugs resolts en aquesta tanda
1. Hero duplicat (muntat a TouchShell + TodayView) → TodayView només el munta si `isMobileDevice`.
2. Hero descentrat → wrapper extern fa el padding; card interna `margin: 0 auto`.
3. Date picker + briefing s'obrien alhora → separats com a germans.
4. "Obrir plànol" creava walk-ins → ara obre TableSelectorModal inline, sense navegar.
5. TableSelectorModal darrere del backdrop → portaled + z 300/301.

---

## Estat / Pendent
- **Sense tasques pendents** confirmades. L'últim bug (stacking) està resolt.
- **Següent pas natural:** validar visualment el flux end-to-end: Briefing → BriefingActionSheet → "Triar taula" → TableSelectorModal per sobre de tot → guardar → toast → fila desapareix.
- Hi havia una crida pendent (skill) per aplicar `high-end-visual-design` a `src/views/auth/PinLockView.tsx` — millorar la welcome/PIN screen a nivell "agency premium" mantenint tota la lògica del PIN. **No iniciada.**

## Comandes útils
```bash
npm run dev      # Vite dev server
npm run build    # build prod (verifica tsc)
```
