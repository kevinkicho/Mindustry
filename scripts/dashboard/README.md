# Mindustry Asset Dashboard

A visual development tool for inspecting, editing, and managing Mindustry's game assets — sprites, blocks, items, units, liquids, and more — through a web-based dashboard.

## Quick Start

```bash
# 1. Install backend dependencies
cd scripts/dashboard
npm install

# 2. Install frontend dependencies
cd client
npm install

# 3. Start the backend (from scripts/dashboard/)
cd ..
node server.js

# 4. Start the frontend (from scripts/dashboard/client/)
cd client
npm run dev
```

- **Backend** runs at `http://localhost:3001`
- **Frontend** runs at `http://localhost:5173`

---

## Features

| Feature | Description |
|---|---|
| **Asset Discovery** | Parses all Java content files (`Blocks.java`, `Items.java`, `UnitTypes.java`, etc.) to extract every game asset and its properties. |
| **Sprite Matching** | Matches each asset to its sprite file(s) using ID, camelCase-to-hyphen conversion, suffix detection, and type-aware prefixes (`item-`, `liquid-`, `status-`). |
| **Property Extraction** | Parses the `{{ ... }}` initialization blocks in Java to extract editable properties like `health`, `size`, `range`, `speed`, structured requirements, and per-ammo-type bullet stats. |
| **Live Editing** | Edit any property value directly on the card and save it back to the Java source file. |
| **Sprite Upload** | Upload a replacement PNG sprite for any asset. |
| **File Reveal** | Click 📂 to open the sprite's location in Windows Explorer; click any orphaned sprite card to reveal it. |
| **Orphan Audit** | Shows all sprites in the filesystem that are NOT matched to any Java variable, with full paths. |
| **Block Sub-Categories** | When viewing Blocks, the sidebar shows sub-categories extracted from `Blocks.java` comment sections (e.g., Turrets, Crafting, Transport, Defense). |
| **Loading Progress** | Real-time SSE-based progress messages during asset parsing. |
| **Repack** | One-click `gradlew tools:pack` to rebuild the sprite atlas. |

---

## Project Structure

```
scripts/dashboard/
├── server.js              # Express backend — asset parsing, API endpoints, sprite serving
├── package.json           # Backend dependencies (express, fast-glob, fs-extra, image-size, multer, cors)
├── test_vars.js           # Small test script for variable extraction
├── README.md              # This file
└── client/                # React + Vite frontend
    ├── vite.config.js     # Vite configuration
    ├── package.json       # Frontend dependencies (react, vite)
    ├── index.html         # HTML entry point
    └── src/
        ├── main.jsx       # React DOM mount point
        └── App.jsx        # Entire dashboard UI — sidebar, cards, audit view, and all interaction logic
```

---

## Backend — `server.js`

### Configuration Constants

| Constant | Description |
|---|---|
| `PROJECT_ROOT` | Root of the Mindustry repository (resolved from `../../`). |
| `SPRITES_ROOT` | Path to `core/assets-raw/sprites/` — all raw sprite PNGs. |
| `CONTENT_ROOT` | Path to `core/src/mindustry/content/` — Java content files. |

### Helper Functions

| Function | Description |
|---|---|
| `camelToHyphen(str)` | Converts a camelCase string to a hyphenated-name (e.g., `titaniumConveyor` → `titanium-conveyor`). |
| `hyphenToCamel(str)` | Converts a hyphenated-name to camelCase (e.g., `titanium-conveyor` → `titaniumConveyor`). |
| `buildSpriteIndex()` | Globs all PNG files in `SPRITES_ROOT` once and builds an in-memory `Map<basename, [{relPath, fullPath}]>` for O(1) lookups. |
| `findSpriteInfo(id, variableName, spriteIndex, assetType)` | Looks up the best-matching sprite for an asset by generating candidate names (ID, camelCase→hyphen, type prefixes like `item-`, `liquid-`, `status-`) and checking suffix ownership (e.g., `router-top` belongs to `router`). |
| `findSpriteInfo.addVariants(name)` | Inner helper that expands a base name into numbered/suffixed candidates (e.g., `duo1`, `duo2`, `duo-heat`, `duo-top`). |
| `extractProperties(statsRaw)` | Parses the `{{ ... }}` initialization block from Java source to extract key-value properties, structured requirements as `[{item, count}]`, and per-ammo-case bullet stats as `[{source, bulletType, props}]`. |
| `extractVariables(fileName, typeName)` | Reads a Java content file's `public static Type` declaration block, parsing variable names line-by-line while tracking `//comment` sections as sub-categories; returns `[{name, subCategory}]`. |
| `getBalancedBraces(content, startIndex)` | Extracts a balanced `{{ ... }}` block from a position in the Java source, handling nested braces correctly. |
| `scanAtlasFinds()` | Scans every `.java` file under `core/src/mindustry/` for `Core.atlas.find("...")` and `Draw.rect("...", ...)` calls to discover dynamically referenced sprite names. |
| `parseWeapons()` | Parses `UnitTypes.java` for `new Weapon("name")` patterns and returns a `Map<weaponSpriteName, unitName>` for ownership tracking. |

### Orphan Reduction

Three strategies are used to reduce false-positive orphaned sprites:

| Strategy | Constant/Function | Description |
|---|---|---|
| **Weapon Sprites** | `parseWeapons()` | Maps weapon sprite names (e.g., `large-weapon`, `artillery`) to their parent units from `UnitTypes.java`. Also matches weapon variants (`-heat`, `-cell`, `-preview`, etc.). |
| **Factory Shared Sprites** | `FACTORY_PATTERN` | Recognizes `factory-{in\|out\|top}-{size}` sprites from `PayloadBlock.java` — shared resources for all payload blocks. |
| **Generated Sprites** | `GENERATED_PATTERNS` | Recognizes 11 categories of build-time generated sprites from `Generators.java`: cliff masks, composite icons (`-full`), UI icons (`-ui`), outlines (`-outline`), team colors, tread animations, splashes, bubbles, etc. |

### Core Parsing

| Function | Description |
|---|---|
| `parseContent(onProgress)` | Main orchestrator — scans all content files in parallel, builds the sprite index, matches sprites to assets, extracts properties, detects orphaned sprites, and calls `onProgress` with SSE-compatible status messages. |
| `parseContent.scanFile(fileName, typeName, javaType, defaultCategory, regex)` | Processes a single Java content file — seeds assets from variable declarations (with sub-categories), then regex-matches `new Type("id")` constructor calls to extract IDs and `{{ }}` stats blocks. |

### Content Files Scanned

| File | Type | Assets |
|---|---|---|
| `Blocks.java` | block | Walls, turrets, conveyors, factories, etc. |
| `Items.java` | item | Copper, lead, titanium, thorium, etc. |
| `Liquids.java` | liquid | Water, slag, cryofluid, etc. |
| `UnitTypes.java` | unit | Dagger, flare, mono, poly, etc. |
| `StatusEffects.java` | effect | Burning, freezing, wet, etc. |
| `Weathers.java` | weather | Rain, snow, sandstorm, etc. |
| `Planets.java` | planet | Serpulo, Erekir, etc. |
| `SectorPresets.java` | sector | Frozen Forest, Ground Zero, etc. |

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/assets` | Returns all parsed assets, summary stats, and orphaned sprites as JSON (synchronous). |
| `GET` | `/api/assets-stream` | SSE endpoint that streams parsing progress messages, then emits a final `done` event with the full dataset. |
| `GET` | `/sprites/*` | Static file server for raw sprite PNGs from `SPRITES_ROOT`. |
| `POST` | `/api/replace-sprite` | Accepts a multipart file upload to replace a sprite PNG on disk. |
| `POST` | `/api/update-stats` | Patches a property value in the Java source file using regex-based find-and-replace. |
| `POST` | `/api/open-folder` | Opens Windows Explorer to the folder containing the given sprite, selecting the file. |
| `POST` | `/api/repack` | Runs `gradlew.bat tools:pack` to rebuild the Mindustry sprite atlas. |

---

## Frontend — `client/src/App.jsx`

### State Variables

| State | Type | Description |
|---|---|---|
| `assets` | `Array` | All parsed asset objects received from the backend. |
| `summary` | `Object` | `{total, withSprites}` — overview counts. |
| `loading` | `Boolean` | Whether asset data is currently being fetched. |
| `message` | `String` | Status/error message displayed to the user. |
| `progressMsg` | `String` | Real-time loading phase message from SSE stream. |
| `filter` | `String` | Currently selected asset type filter (e.g., `'block'`, `'item'`, `'All'`). |
| `search` | `String` | Free-text search query filtering by ID or variable name. |
| `editingStats` | `Object` | Tracks which assets have unsaved property edits. |
| `showAudit` | `Boolean` | Toggles between card view and audit/binding table view. |
| `orphans` | `Array` | List of orphaned sprites `[{name, path}]`. |
| `blockSubFilter` | `String` | Active block sub-category filter (e.g., `'Turrets'`, `'Crafting'`). |

### Functions

| Function | Description |
|---|---|
| `fetchAssets()` | Opens an SSE `EventSource` to `/api/assets-stream`, processes progress/done/error events, and populates component state. |
| `openFolder(spritePath)` | Sends a POST to `/api/open-folder` to reveal a sprite file in Windows Explorer. |
| `handleStatChange(id, key, value)` | Records a property edit in `editingStats` for the given asset, keyed by property name. |
| `saveStats(asset)` | POSTs the accumulated edits for an asset to `/api/update-stats` to patch the Java source file. |
| `handleFileChange(asset, file)` | Uploads a replacement sprite PNG via `/api/replace-sprite` using multipart form data. |
| `runRepack()` | POSTs to `/api/repack` to trigger a Gradle sprite atlas rebuild. |

### UI Layout

| Section | Description |
|---|---|
| **Sidebar** | Lists asset types (🧱 Block, 💎 Item, ⚔️ Unit, 💧 Liquid, ✨ Effect, etc.) with counts; shows block sub-categories (Turrets, Crafting, etc.) when Block is selected. |
| **Header Bar** | Search input, summary stats, and toggle buttons for Audit View and Repack. |
| **Asset Cards** | Each card shows: sprite preview, variable name, string ID, editable resolution, matched sprite path, category badge, structured requirements (editable item + count pairs), collapsible ammo cases (each with all bullet properties editable), general properties grid, Save button, Upload button, and 📂 Reveal button. |
| **Audit View** | Table of all Java variable bindings showing match status (BOUND/UNMATCHED) and matched sprite names, plus a grid of orphaned sprites with paths (clickable to reveal in Explorer). |
| **Loading Screen** | Animated spinner with real-time progress messages from the SSE stream. |

---

## Asset Object Schema

Each asset in the API response has the following shape:

```json
{
  "variableName": "duo",
  "id": "duo",
  "type": "block",
  "category": "Block",
  "subCategory": "Turrets",
  "sourceFile": "Blocks.java",
  "spritePath": "blocks/turrets/duo.png",
  "matchedName": "duo",
  "dimensions": { "width": 32, "height": 32 },
  "health": "125",
  "isVariableOnly": false,
  "ownedSprites": ["duo.png", "duo-heat.png"],
  "properties": {
    "reload": "20",
    "range": "110",
    "size": "1",
    "_category": "turret",
    "_requirements": [
      { "item": "copper", "count": 35 }
    ],
    "_ammo": [
      {
        "source": "copper",
        "bulletType": "BasicBulletType",
        "props": { "speed": "2.5", "damage": "9", "width": "7", "height": "9" }
      },
      {
        "source": "graphite",
        "bulletType": "BasicBulletType",
        "props": { "speed": "3.5", "damage": "18", "width": "9", "height": "12" }
      }
    ]
  }
}
```

---

## Dependencies

### Backend (`scripts/dashboard/package.json`)

| Package | Purpose |
|---|---|
| `express` | HTTP server and routing. |
| `cors` | Cross-origin resource sharing for frontend↔backend communication. |
| `fast-glob` | High-performance filesystem globbing for sprite discovery. |
| `fs-extra` | Extended filesystem operations (read, write, pathExists). |
| `image-size` | Reads PNG dimensions without loading the full image. |
| `multer` | Multipart form data parsing for sprite uploads. |

### Frontend (`scripts/dashboard/client/package.json`)

| Package | Purpose |
|---|---|
| `react` | UI component framework. |
| `react-dom` | React DOM renderer. |
| `vite` | Development server and bundler. |
