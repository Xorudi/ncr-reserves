# NCR Reserves — Handoff

**Última actualización:** 2026-06-12
**Branch:** `main` (limpio, todo pusheado)
**Último commit:** `6767008` — retrigger del deploy de Railway (el webhook se perdió `2675234` por la incidencia de AWS US West del 11/06)
**Producción:** https://ncr-reserves-production.up.railway.app/ — verificado el 12/06: el bundle activo (`index-D_rBNjv4.js`) incluye el Historial. **Nada pendiente de desplegar.**

> Esta sesión de recuperación: la conversación "NCR RESERVES 2" desapareció de recientes porque su archivo de metadatos se corrompió (NUL bytes). El transcript completo sigue en `~/.claude/projects/C--Users-Jordi/59884116-7a6b-47de-b29b-6c3188843dbd.jsonl` y los metadatos se han reconstruido. Si no reaparece tras reiniciar la app, se puede retomar desde terminal: `claude --resume 59884116-7a6b-47de-b29b-6c3188843dbd`.

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

## Fases completades 02/06 → 11/06 (sessió "NCR RESERVES 2")

### Rendiment i seguretat (06–07/06)
- Touch targets ≥44px, contradiccions de dades reconciliades.
- Lag arreglat en dispositius modestos: congelades les animacions contínues de blur ambient (`641cf29`, `8c71b5e`).
- `sec:` throttle d'intents de PIN + fixes de vulnerabilitats de dependències (`159e8f8`).

### Mode vespre (09–11/06)
- Tema de servei de tarda/nit ("espresso glass", cacao pass v3, palette v2) — molts commits `fix(vespre)`. Transició animada de tema al capvespre (`22f3a8a`).
- Empty states editorials unificats, business tiles dark-aware. Mòdul de fitxar personal **eliminat** (`99ab5d3`).

### Comunicacions WhatsApp (11/06)
- WhatsApp amb un toc a tot arreu on hi ha un telèfon (`ec2b63d`).
- Selector de plantilles sense emojis: "Demanar els plats", recordatori per a grups grans (`src/utils/whatsapp.ts`).

### Servei i cuina (11/06)
- **Full del dia**: full compartible per a cuina amb rangs setmana/mes (`src/utils/daySheet.ts`).
- **Tiquets tèrmics**: impressió de comandes amb tipografia de cuina, un plat per línia (`src/utils/printTicket.ts`).
- **Diccionari ca→es** per a tiquets en castellà, curat amb les cartes reals de La Pista (`src/utils/caEs.ts`).
- Avisos de doble reserva conscients de l'hora al selector de taules (`src/utils/tableConflict.ts`).
- Tancament del dia + configuració d'Horaris + campanes de servei (`336c891`). Notes estructurades amb suggeriments concrets de taula (`src/utils/tableSuggest.ts`).
- Loyalty: desfer un no-show ja no costa punts (`035c19f`).

### Seguretat de dades (11/06) — l'última tanda
- **Fix del bug de la "reserva fantasma"**: els restores de backup ara sobreviuen al sync amb el núvol (`6337f76`, `src/backup/useBackupStore.ts`).
- **Historial de reserves eliminades** (`2675234`): cada reserva esborrada es guarda 90 dies (màx 100 entrades, per dispositiu) i es pot restaurar amb un toc al seu dia exacte (mateix id, taules i comanda).
  - Implementació: `src/lib/resTrash.ts` (pushToTrash), `src/views/mobile/TrashScreen.tsx` (UI a `Més → Historial`), mètode de re-inserció exacta a `src/store/useAppStore.ts` (~línia 88) i `pushToTrash` al delete (~línia 492).

---

## Estat / Pendent
- **Sense tasques pendents.** Tot commitejat, pusheat i desplegat a Railway (verificat 12/06).
- **Següent pas suggerit per la sessió anterior:** prova real del Historial — esborrar una reserva de prova, `Més → Historial`, restaurar-la.
- Pendent antic (no iniciat): aplicar `high-end-visual-design` a `src/views/auth/PinLockView.tsx` mantenint tota la lògica del PIN.

## Comandes útils
```bash
npm run dev      # Vite dev server
npm run build    # build prod (verifica tsc)
```
