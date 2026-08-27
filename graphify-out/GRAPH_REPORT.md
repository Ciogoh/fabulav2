# Graph Report - fabula  (2026-08-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 592 nodes · 1640 edges · 30 communities (26 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `957c3a97`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- pageTitle
- availability.server.ts
- account.tsx
- Fabula CLAUDE.md — project guide
- scripts
- root.tsx
- request-detail.tsx
- admin.scan.tsx
- dependencies
- compilerOptions
- dictionaries.ts
- photo-picker.tsx
- useT
- admin.assets.tsx
- signin.tsx
- buttonClass
- calendar.tsx
- site-header.tsx
- seed.ts
- SignIn
- use-t.tsx
- docker-entrypoint.sh
- setup.sh

## God Nodes (most connected - your core abstractions)
1. `useT()` - 99 edges
2. `pageTitle()` - 47 edges
3. `buttonClass()` - 40 edges
4. `requireAdmin()` - 38 edges
5. `db` - 31 edges
6. `todayUtc()` - 25 edges
7. `PageShell()` - 24 edges
8. `formatDay()` - 23 edges
9. `Fabula CLAUDE.md — project guide` - 21 edges
10. `useFormatDay()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Fabula lending platform` --semantically_similar_to--> `Framework Mode`  [INFERRED] [semantically similar]
  CLAUDE.md → .agents/skills/react-router/references/framework-mode.md
- `prisma-migration skill` --conceptually_related_to--> `Trap: prisma migrate status hides schema drift`  [INFERRED]
  .claude/skills/prisma-migration/SKILL.md → CLAUDE.md
- `Plan: pressable profile photo` --references--> `Rule 7: one button, one shell`  [EXTRACTED]
  docs/piani/2026-08-24-foto-profilo-premibile.md → CLAUDE.md
- `Fabula 0.5.1 — pressable profile photo` --references--> `Plan: pressable profile photo`  [INFERRED]
  CHANGELOG.md → docs/piani/2026-08-24-foto-profilo-premibile.md
- `Plan: automatic reminders, notifications, brainstorm` --references--> `Rule 2: pickup/return live on the item, not the request`  [EXTRACTED]
  docs/piani/2026-08-22-promemoria-e-brainstorm.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Fabula's seven non-negotiable architectural rules** — claude_rule1_states_not_saved, claude_rule2_pickup_on_items, claude_rule3_kits_excluded_from_availability, claude_rule4_no_quantities, claude_rule5_typed_translations, claude_rule6_person_naming, claude_rule7_one_button_one_shell [EXTRACTED 1.00]
- **React Router mode-identification flow** — agents_skills_react_router_skill, agents_skills_react_router_references_framework_mode_frameworkmode, agents_skills_react_router_references_data_mode_datamode, agents_skills_react_router_references_declarative_mode_declarativemode, agents_skills_react_router_references_rsc_rsc [EXTRACTED 1.00]
- **Version / changelog / plans — three pieces of one story** — claude_versioning_scheme, changelog, docs_piani_readme, app_lib_version [EXTRACTED 1.00]

## Communities (30 total, 4 thin omitted)

### Community 0 - "pageTitle"
Cohesion: 0.07
Nodes (58): ButtonLink(), AssetPicker(), groupsOf(), KitAssetOption, KitDefaults, KitFields(), PageShell(), PageTitle() (+50 more)

### Community 1 - "availability.server.ts"
Cohesion: 0.06
Nodes (44): Button(), ButtonLinkProps, ButtonProps, ButtonSize, ButtonVariant, SIZES, VARIANTS, CartBar() (+36 more)

### Community 2 - "account.tsx"
Cohesion: 0.08
Nodes (41): Avatar(), PersonName(), PersonPicker(), PickablePerson, SIZES, auth, AuthUser, nameFrom() (+33 more)

### Community 3 - "Fabula CLAUDE.md — project guide"
Cohesion: 0.08
Nodes (40): Data Mode, Declarative Mode, Framework Mode, React Server Components (RSC), RSC Data Mode, RSC Framework Mode, React Router Skill, assetQrDataUrl() (+32 more)

### Community 4 - "scripts"
Cohesion: 0.05
Nodes (43): devDependencies, @react-router/dev, tailwindcss, @tailwindcss/vite, tsx, @types/node, @types/qrcode, @types/react (+35 more)

### Community 5 - "root.tsx"
Cohesion: 0.09
Nodes (29): SiteHeader(), LangProvider(), getCurrentAvailability(), getOccupancy(), todayUtc(), addDays(), buildCalendar(), CalendarEntry (+21 more)

### Community 6 - "request-detail.tsx"
Cohesion: 0.14
Nodes (29): formatDay(), getBusyAssetIds(), parseDay(), adminEmails(), SendArgs, sendEmail(), notifyAdminsNewRequest(), notifyDirectHandover() (+21 more)

### Community 7 - "admin.scan.tsx"
Cohesion: 0.10
Nodes (26): AssetDefaults, AssetFields(), CategoryField(), Select(), cleanCategoryName(), MAX_CATEGORY_NAME, NEW_CATEGORY, CategoryChoice (+18 more)

### Community 8 - "dependencies"
Cohesion: 0.07
Nodes (29): better-auth, dotenv, isbot, dependencies, better-auth, dotenv, isbot, prisma (+21 more)

### Community 9 - "compilerOptions"
Cohesion: 0.08
Nodes (26): **/*, **/.client/**/*, DOM, DOM.Iterable, ES2022, node, .react-router/types/**/*, **/.server/**/* (+18 more)

### Community 10 - "dictionaries.ts"
Cohesion: 0.15
Nodes (21): de, dictionaries, Dictionary, en, isLang(), it, Lang, LANGUAGES (+13 more)

### Community 11 - "photo-picker.tsx"
Cohesion: 0.16
Nodes (16): check(), ExistingPhoto, ExistingTile(), keyOf(), PhotoGallery(), PhotoPicker(), add(), apply() (+8 more)

### Community 12 - "useT"
Cohesion: 0.22
Nodes (14): AdminBadge(), useFormatDay(), useLang(), useT(), AssetHistory(), AssetQr(), AdminKits(), AdminLog() (+6 more)

### Community 13 - "admin.assets.tsx"
Cohesion: 0.15
Nodes (10): AdminTabs(), action(), AdminAssets(), AssetItem(), AssetRow, AssignBar(), CategoryChips(), groupsOf() (+2 more)

### Community 14 - "signin.tsx"
Cohesion: 0.15
Nodes (8): authClient, googleConfigured, microsoftConfigured, meta(), ResetPassword(), meta(), Step, Submit()

### Community 15 - "buttonClass"
Cohesion: 0.19
Nodes (12): buttonClass(), EditAsset(), ExitZone(), AdminCategories(), CategoryItem(), CategoryRow, loader(), MoveButton() (+4 more)

### Community 16 - "calendar.tsx"
Cohesion: 0.23
Nodes (10): Bar(), BAR_LABELS, BAR_STYLES, daysBetween(), Legend(), loader(), MonthJump(), shiftDays() (+2 more)

### Community 17 - "site-header.tsx"
Cohesion: 0.32
Nodes (5): HeaderUser, LanguageMenu(), ProfileMenu(), useDisclosure(), LANGUAGE_NAMES

### Community 18 - "seed.ts"
Cohesion: 0.40
Nodes (5): ASSETS, CATEGORIES, day(), db, main()

## Knowledge Gaps
- **128 isolated node(s):** `KitDefaults`, `CurrentUser`, `AdminActionKind`, `CartItemInput`, `AssetState` (+123 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useT()` connect `useT` to `pageTitle`, `availability.server.ts`, `account.tsx`, `root.tsx`, `request-detail.tsx`, `admin.scan.tsx`, `dictionaries.ts`, `photo-picker.tsx`, `admin.assets.tsx`, `signin.tsx`, `buttonClass`, `calendar.tsx`, `site-header.tsx`, `SignIn`, `use-t.tsx`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Why does `Fabula CLAUDE.md — project guide` connect `Fabula CLAUDE.md — project guide` to `availability.server.ts`, `dictionaries.ts`, `account.tsx`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `pageTitle()` connect `pageTitle` to `availability.server.ts`, `account.tsx`, `request-detail.tsx`, `admin.scan.tsx`, `dictionaries.ts`, `admin.assets.tsx`, `signin.tsx`, `buttonClass`, `calendar.tsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `KitDefaults`, `CurrentUser`, `AdminActionKind` to the rest of the system?**
  _128 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pageTitle` be split into smaller, more focused modules?**
  _Cohesion score 0.0694579681921454 - nodes in this community are weakly interconnected._
- **Should `availability.server.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06390977443609022 - nodes in this community are weakly interconnected._
- **Should `account.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08116883116883117 - nodes in this community are weakly interconnected._