# Graph Report - fabula  (2026-08-28)

## Corpus Check
- 65 files · ~124,794 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 867 nodes · 1874 edges · 88 communities (55 shown, 33 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.86)
- Token cost: 200,000 input · 10,000 output

## Community Hubs (Navigation)
- Button Component System
- Email Notifications Engine
- Project Dependencies
- Availability & Live Events
- Person Display Components
- Admin Centro Dashboard
- Asset Form Fields
- Auth & Runtime Dependencies
- Live-Update Client Hook
- TypeScript Compiler Config
- Database & Admin Audit
- Admin Tabs & Badge
- Page Shell & Meta
- Select Component & QR Codes
- Personal Calendar Feature
- Kit Asset Picker
- Site Header & Logo
- Auth Client & Sign-in
- Push Notification Client
- Photo Picker Component
- Upload Limits & Install Prompt
- i18n Dictionaries
- PWA Install Flow
- Root App & Language Context
- iCalendar Generation
- PWA Shell Security Rules
- Push Notification Server
- Coolify Migration Traps
- Design System Rules
- Avatar Upload Storage
- Version Stamping
- Notification Channel Design
- QR Handover Flow
- Plan Index Documents
- React Router Modes
- Language Detection Server
- i18n Meta & Translation
- Icon Generation Script
- Push Device Labeling
- Deploy-on-Push Pipeline
- Seed Data Script
- Cloudflare Tunnel Port Trap
- Versioning Ritual
- Avatar Picker Interaction
- Personal Calendar Rationale
- Availability Engine Rules
- Short Handover Redirect
- Server Migration Backup
- Profile Photo Change UX
- Docker Build Speed Trap
- 404 vs 403 Admin Rule
- Microsoft Auth & Person Naming
- Plan Archive Convention
- Public Uploads & Guides Backlog
- Dockerfile Package Manager Trap
- Service Worker Entry Script
- Service Worker Precache
- Setup Script
- Admin Assets Panel
- Asset Loan History
- Admin Action Log
- Setup Command Entry
- Google Avatar Source
- Members Admin Page
- Dual-Audience Request Detail
- Pickup on RequestItem Rule
- Single Source of Person Naming
- No Names in Public Surfaces
- Role Field Input Lockdown
- APP_URL Port Trap
- Docker Desktop Startup Trap
- Dockerignore Secrets Barrier
- process.env Reload Trap
- Hover Menu Close Trap
- Nested Form Trap
- Prisma Generate Restart Trap
- Prisma Migrate Status Blind Spot
- sortOrder Unwritten Field Trap
- Working Directory Reset Trap
- Calendar Grid Backlog Item

## God Nodes (most connected - your core abstractions)
1. `useT()` - 69 edges
2. `pageTitle()` - 36 edges
3. `db` - 35 edges
4. `requireAdmin()` - 34 edges
5. `buttonClass()` - 31 edges
6. `PageShell()` - 23 edges
7. `TranslationKey` - 18 edges
8. `scripts` - 17 edges
9. `compilerOptions` - 16 edges
10. `displayNameOf()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `QR per oggetto, scanner e consegna diretta (0.5.0)` --semantically_similar_to--> `Il QR e la consegna diretta`  [INFERRED] [semantically similar]
  CHANGELOG.md → CLAUDE.md
- `Cache del service worker come regola di sicurezza` --semantically_similar_to--> `Il service worker non mette mai in cache pagine o loader`  [INFERRED] [semantically similar]
  CHANGELOG.md → CLAUDE.md
- `La pagina offline deve bastare a se stessa` --semantically_similar_to--> `Cache del service worker come regola di sicurezza`  [INFERRED] [semantically similar]
  public/offline.html → CHANGELOG.md
- `Migrazioni automatiche all'avvio (docker-entrypoint.sh)` --semantically_similar_to--> `Trappola: le migrazioni le applica l'avvio del container`  [INFERRED] [semantically similar]
  CHANGELOG.md → CLAUDE.md
- `/healthz con SELECT 1` --semantically_similar_to--> `Trappola 3: il controllo di salute ha bisogno di curl e 127.0.0.1`  [INFERRED] [semantically similar]
  CHANGELOG.md → docs/coolify.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Il canale dal vivo: eventi, aggancio e superfici che aggiorna** — claude_events_server, claude_use_live, claude_api_stream_route, claude_centro, claude_live_pages, docs_piani_centro_chat_fase5_sse [INFERRED 0.85]
- **Il sistema dei quattro promemoria automatici** — claude_reminders_server, claude_notifications_server, claude_four_reminders_system, claude_reminder_log_guardian, docs_piani_centro_chat_fase6_reminders, changelog_four_reminders [INFERRED 0.85]
- **Il flusso QR e consegna diretta** — claude_qr_server, claude_admin_scan_route, claude_h_code_route, claude_admin_handover_route, claude_qr_scanner_handover_system [INFERRED 0.90]
- **React Router mode-identification flow** — agents_skills_react_router_skill, agents_skills_react_router_references_framework_mode_frameworkmode, agents_skills_react_router_references_data_mode_datamode, agents_skills_react_router_references_declarative_mode_declarativemode, agents_skills_react_router_references_rsc_rsc [EXTRACTED 1.00]

## Communities (88 total, 33 thin omitted)

### Community 0 - "Button Component System"
Cohesion: 0.05
Nodes (44): Button(), ButtonLinkProps, ButtonProps, ButtonSize, ButtonVariant, SIZES, VARIANTS, CartBar() (+36 more)

### Community 1 - "Email Notifications Engine"
Cohesion: 0.11
Nodes (45): formatDay(), extraAdminEmails(), SendArgs, sendEmail(), adminRecipients(), channelOf(), deliver(), notifyAdminsNewRequest() (+37 more)

### Community 2 - "Project Dependencies"
Cohesion: 0.04
Nodes (48): devDependencies, @react-router/dev, tailwindcss, @tailwindcss/vite, tsx, @types/node, @types/qrcode, @types/react (+40 more)

### Community 3 - "Availability & Live Events"
Cohesion: 0.08
Nodes (29): getBusyAssetIds(), parseDay(), ADMIN_CHANNEL, bus(), Connection, MAX_STREAMS_PER_USER, publishAdminChange(), publishRequestChange() (+21 more)

### Community 4 - "Person Display Components"
Cohesion: 0.11
Nodes (30): Avatar(), PersonName(), PersonPicker(), PickablePerson, SIZES, logAdminAction(), auth, AuthUser (+22 more)

### Community 5 - "Admin Centro Dashboard"
Cohesion: 0.06
Nodes (37): Il Centro (dashboard unificata admin, 0.7.0), In sviluppo non si tiene una chiave Resend viva, I quattro promemoria + ReminderLog (0.7.0), Chat che si aggiorna da sola (SSE, 0.7.0), routes/api.stream.tsx (il canale SSE), Il Centro (/admin), lib/events.server.ts (campanella del canale dal vivo), Quattro promemoria automatici (+29 more)

### Community 6 - "Asset Form Fields"
Cohesion: 0.12
Nodes (26): AssetDefaults, AssetFields(), CategoryField(), PhotoFields(), TranslationKey, LangContext, Translator, useFormatDay() (+18 more)

### Community 7 - "Auth & Runtime Dependencies"
Cohesion: 0.06
Nodes (31): better-auth, dotenv, isbot, dependencies, better-auth, dotenv, isbot, prisma (+23 more)

### Community 8 - "Live-Update Client Hook"
Cohesion: 0.09
Nodes (18): PersonInline(), unreadForAdminIds(), useLive(), closeChannel(), onVisibility(), open(), refresh(), startPolling() (+10 more)

### Community 9 - "TypeScript Compiler Config"
Cohesion: 0.08
Nodes (26): **/*, **/.client/**/*, DOM, DOM.Iterable, ES2022, node, .react-router/types/**/*, **/.server/**/* (+18 more)

### Community 10 - "Database & Admin Audit"
Cohesion: 0.12
Nodes (10): AdminActionKind, db, CurrentUser, requireAdmin(), action(), AdminAssets(), AssetRow, CategoryChips() (+2 more)

### Community 11 - "Admin Tabs & Badge"
Cohesion: 0.16
Nodes (20): AdminBadge(), AdminTabs(), buttonClass(), useT(), AssetItem(), AssignBar(), EditAsset(), ExitZone() (+12 more)

### Community 12 - "Page Shell & Meta"
Cohesion: 0.12
Nodes (19): PageShell(), pageTitle(), useLang(), versionLabel(), meta(), meta(), meta(), meta() (+11 more)

### Community 13 - "Select Component & QR Codes"
Cohesion: 0.13
Nodes (18): Select(), assetQrDataUrl(), shortHandoverUrl(), CameraCapabilities, CameraChoice, diagnoseCameraFailure(), DocumentWithFeaturePolicy, handoverPathFrom() (+10 more)

### Community 14 - "Personal Calendar Feature"
Cohesion: 0.14
Nodes (11): generateToken(), getOrCreateCalendarToken(), regenerateCalendarToken(), action(), BAR_LABELS, BAR_STYLES, daysBetween(), loader() (+3 more)

### Community 15 - "Kit Asset Picker"
Cohesion: 0.22
Nodes (15): ButtonLink(), AssetPicker(), groupsOf(), KitAssetOption, KitDefaults, KitFields(), PageTitle(), assetIdsFrom() (+7 more)

### Community 16 - "Site Header & Logo"
Cohesion: 0.16
Nodes (9): Logo(), HeaderUser, LanguageMenu(), ProfileMenu(), SiteHeader(), useDisclosure(), LANGUAGES, Plan: mobile header tap targets (+1 more)

### Community 17 - "Auth Client & Sign-in"
Cohesion: 0.14
Nodes (5): authClient, googleConfigured, microsoftConfigured, SignIn(), Step

### Community 18 - "Push Notification Client"
Cohesion: 0.32
Nodes (13): currentEndpoint(), decodeKey(), disablePush(), enablePush(), EnableResult, post(), PushPermission, ready() (+5 more)

### Community 19 - "Photo Picker Component"
Cohesion: 0.21
Nodes (11): check(), ExistingPhoto, ExistingTile(), keyOf(), PhotoGallery(), PhotoPicker(), add(), apply() (+3 more)

### Community 20 - "Upload Limits & Install Prompt"
Cohesion: 0.22
Nodes (6): promptInstall(), ACCEPTED_IMAGE_ACCEPT, ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, InstallInvitation(), Plan: pressable profile photo

### Community 21 - "i18n Dictionaries"
Cohesion: 0.18
Nodes (10): de, dictionaries, Dictionary, en, it, LANGUAGE_NAMES, security-reviewer agent (Fabula), Regola 4: niente quantità (+2 more)

### Community 22 - "PWA Install Flow"
Cohesion: 0.25
Nodes (10): announce(), InstallPromptEvent, InstallState, PwaRuntime(), capture(), installed(), readEnvironment(), subscribe() (+2 more)

### Community 23 - "Root App & Language Context"
Cohesion: 0.22
Nodes (5): LangProvider(), adminCounts(), unreadForUserIds(), loader(), loader()

### Community 24 - "iCalendar Generation"
Cohesion: 0.33
Nodes (9): addDays(), buildCalendar(), CalendarEntry, escapeText(), foldLine(), toDateValue(), toUtcStamp(), loader() (+1 more)

### Community 25 - "PWA Shell Security Rules"
Cohesion: 0.20
Nodes (10): Il guscio PWA (manifest, sw, offline.html, icone F), Cache del service worker come regola di sicurezza, Fabula, Niente dati riservati nei loader pubblici, Il service worker non mette mai in cache pagine o loader, Fork di Shelf abbandonato, Snipe-IT valutato e scartato, Ricarica automatica sull'evento 'online' (+2 more)

### Community 26 - "Push Notification Server"
Cohesion: 0.33
Nodes (8): forget(), PushMessage, ready(), sendPush(), vapidPublicKey(), action(), IncomingSubscription, readSubscription()

### Community 27 - "Coolify Migration Traps"
Cohesion: 0.20
Nodes (9): Migrazione da MacBook a server Linux con Coolify (0.6.0), /healthz con SELECT 1, dotenv in produzione + prisma.config.ts nell'immagine, versionStamp e SOURCE_COMMIT, Trappola: Prisma 7 sposta l'URL in prisma.config.ts, Trappola: il seed gira con tsx, non con node, Trappola 3: il controllo di salute ha bisogno di curl e 127.0.0.1, Voce B: backup automatici su R2 (+1 more)

### Community 28 - "Design System Rules"
Cohesion: 0.20
Nodes (10): --on-accent mai white, sopra un fondo pieno di accento, Token colore: stati propri, mai --accent, components/button.tsx (Button, ButtonLink, buttonClass), components/page.tsx (wide/narrow/form), components/person.tsx (PersonInline, PersonName, Avatar), Regola 7: un pulsante solo, un guscio solo, components/select.tsx (Select), components/state-badge.tsx (StateBadge) (+2 more)

### Community 29 - "Avatar Upload Storage"
Cohesion: 0.31
Nodes (6): isUploadedAvatar(), deleteAvatarFile(), looksLikeImage(), saveAvatar(), UPLOAD_ROOT, UploadResult

### Community 30 - "Version Stamping"
Cohesion: 0.29
Nodes (6): APP_VERSION, BUILD_DATE, BUILD_NUMBER, app service (profile: full), db service (postgres:17-alpine), Plan: version number + plan archive

### Community 31 - "Notification Channel Design"
Cohesion: 0.25
Nodes (6): Destinatari admin dal database, non da ADMIN_EMAILS, Scelta del canale di notifica per persona, Confine: accesso e reset password restano email, Tre difese contro i fallimenti silenziosi delle notifiche, Le chiavi VAPID sono un segreto con memoria, Voce H: documentazione, segreti, chiavi, pulizia

### Community 32 - "QR Handover Flow"
Cohesion: 0.25
Nodes (8): QR per oggetto, scanner e consegna diretta (0.5.0), routes/admin.handover.$assetId.tsx (consegna diretta), routes/admin.scan.tsx (scanner, pickRearCamera), routes/h.$code.tsx (smistamento indirizzo corto), Il QR e la consegna diretta, lib/qr.server.ts (genera il QR e l'indirizzo corto), Ogni redirect verso un percorso dall'utente va filtrato, Il testo letto dalla fotocamera è dato, non un indirizzo

### Community 33 - "Plan Index Documents"
Cohesion: 0.29
Nodes (5): Piano: il badge del catalogo risponde a 'adesso' (2026-08-22), Piano: la foto del profilo si cambia premendo la foto (2026-08-24), Piano: intestazione mobile (2026-08-24), Piano: promemoria automatico, notifiche e brainstorm (2026-08-22), Piano: registro admin, storico oggetto, QR e consegna diretta (2026-08-24)

### Community 34 - "React Router Modes"
Cohesion: 0.62
Nodes (7): Data Mode, Declarative Mode, Framework Mode, React Server Components (RSC), RSC Data Mode, RSC Framework Mode, React Router Skill

### Community 35 - "Language Detection Server"
Cohesion: 0.48
Nodes (6): isLang(), fromAcceptLanguage(), getLang(), langCookie(), readCookie(), action()

### Community 36 - "i18n Meta & Translation"
Cohesion: 0.48
Nodes (6): Lang, translate(), langOf(), MetaMatchLike, pageTitleRaw(), tagline()

### Community 37 - "Icon Generation Script"
Cohesion: 0.38
Nodes (6): GLYPH, ICONS_DIR, main(), png(), PUBLIC_DIR, square()

### Community 38 - "Push Device Labeling"
Cohesion: 0.53
Nodes (4): browserOf(), deviceLabel(), systemOf(), loader()

### Community 39 - "Deploy-on-Push Pipeline"
Cohesion: 0.33
Nodes (6): Migrazioni automatiche all'avvio (docker-entrypoint.sh), Trappola: le migrazioni le applica l'avvio del container, Risorsa applicazione fabula, GitHub App come sorgente, non chiave di deploy, Cosa succede a ogni git push, Perché Coolify

### Community 40 - "Seed Data Script"
Cohesion: 0.40
Nodes (5): ASSETS, CATEGORIES, day(), db, main()

### Community 41 - "Cloudflare Tunnel Port Trap"
Cohesion: 0.50
Nodes (5): La trappola dell'APP_PORT sparisce in produzione, Trappola: APP_PORT deve combaciare col Service del tunnel (solo dev), Servizio cloudflared, Firewall: solo la porta 22, Perché il tunnel punta al proxy e non al container

### Community 42 - "Versioning Ritual"
Cohesion: 0.40
Nodes (5): Rito di versione (piano→changelog→versione), Cosa significano i numeri qui (semver non da libreria), lib/version.ts (versionLabel()), Versione, build, data: tre mestieri diversi, Piano: numero di versione e archivio dei piani (2026-08-24)

### Community 43 - "Avatar Picker Interaction"
Cohesion: 0.67
Nodes (4): AvatarPicker(), choose(), showPreview(), checkPhoto()

### Community 44 - "Personal Calendar Rationale"
Cohesion: 0.50
Nodes (4): Calendario personale /cal/<token>.ics (0.8.0), User.calendarToken come credenziale, Il feed iCal non ha una versione globale, apposta, Voce D: calendario personale con luogo di riconsegna (fatta)

### Community 45 - "Availability Engine Rules"
Cohesion: 0.50
Nodes (4): lib/availability.server.ts (motore di disponibilità), lib/availability.shared.ts (tetti di durata), Regola 1: gli stati non si salvano mai, Regola 3: i kit non entrano nella disponibilità

### Community 47 - "Server Migration Backup"
Cohesion: 0.67
Nodes (3): Migrazione dei dati dal Mac, Risorsa Postgres su Coolify, Cosa resta da salvare: foto e configurazione Coolify

## Knowledge Gaps
- **177 isolated node(s):** `KitDefaults`, `AdminActionKind`, `CurrentUser`, `ButtonLinkProps`, `ButtonProps` (+172 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **33 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Plan: pressable profile photo` connect `Upload Limits & Install Prompt` to `Button Component System`, `Photo Picker Component`, `Design System Rules`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `Regola 7: un pulsante solo, un guscio solo` connect `Design System Rules` to `Upload Limits & Install Prompt`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **What connects `KitDefaults`, `AdminActionKind`, `CurrentUser` to the rest of the system?**
  _177 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Button Component System` be split into smaller, more focused modules?**
  _Cohesion score 0.05336538461538461 - nodes in this community are weakly interconnected._
- **Should `Email Notifications Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.10799319727891156 - nodes in this community are weakly interconnected._
- **Should `Project Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `Availability & Live Events` be split into smaller, more focused modules?**
  _Cohesion score 0.07822410147991543 - nodes in this community are weakly interconnected._