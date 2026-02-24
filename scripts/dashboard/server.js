const express = require('express');
const multer = require('multer');
const fg = require('fast-glob');
const fs = require('fs-extra');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const PROJECT_ROOT = path.resolve(__dirname, '../../');
const SPRITES_ROOT = path.join(PROJECT_ROOT, 'core/assets-raw/sprites');
const CONTENT_ROOT = path.join(PROJECT_ROOT, 'core/src/mindustry/content');
const SOUNDS_ROOT = path.join(PROJECT_ROOT, 'core/assets/sounds');
const BUNDLE_PATH = path.join(PROJECT_ROOT, 'core/assets/bundles/bundle.properties');

const ASSET_TEMPLATES = {
    wall: (id, name, stats) => `
        ${id} = new Wall("${name}"){{
            requirements(Category.defense, with(Items.copper, ${stats.cost || 6}));
            health = ${stats.health || 400};
        }};`,
    itemTurret: (id, name, stats) => `
        ${id} = new ItemTurret("${name}"){{
            requirements(Category.turret, with(Items.copper, ${stats.cost || 50}));
            ammo(
                Items.copper, new BasicBulletType(2.5f, ${stats.damage || 10}){{
                    width = 7f;
                    height = 9f;
                    lifetime = 60f;
                }}
            );
            reload = ${stats.reload || 30}f;
            range = ${stats.range || 150}f;
            size = ${stats.size || 1};
            health = ${stats.health || 200};
        }};`,
    powerTurret: (id, name, stats) => `
        ${id} = new PowerTurret("${name}"){{
            requirements(Category.turret, with(Items.copper, ${stats.cost || 50}));
            shootType = new LightningBulletType(){{
                damage = ${stats.damage || 20};
                lightningLength = 20;
            }};
            reload = ${stats.reload || 40}f;
            range = ${stats.range || 100}f;
            size = ${stats.size || 1};
            consumePower(${stats.power || 3}f);
        }};`,
    generator: (id, name, stats) => `
        ${id} = new ConsumeGenerator("${name}"){{
            requirements(Category.power, with(Items.copper, ${stats.cost || 30}));
            powerProduction = ${stats.production || 1}f;
            itemDuration = 60f;
            size = ${stats.size || 1};
            consumeItem(Items.coal);
        }};`,
    unit: (id, name, stats) => `
        ${id} = new UnitType("${name}"){{
            speed = ${stats.speed || 0.5}f;
            hitSize = ${stats.hitSize || 8}f;
            health = ${stats.health || 150};
            weapons.add(new Weapon("large-weapon"){{
                reload = ${stats.reload || 15}f;
                bullet = new BasicBulletType(2.5f, ${stats.damage || 10});
            }});
        }};`
};

// Serve sounds and sprites statically
app.use('/sounds', express.static(SOUNDS_ROOT));
app.use('/sprites', express.static(SPRITES_ROOT));

// Storage for uploaded sprites
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { targetPath } = req.body;
        cb(null, path.dirname(path.join(SPRITES_ROOT, targetPath)));
    },
    filename: (req, file, cb) => {
        const { targetPath } = req.body;
        cb(null, path.basename(targetPath));
    }
});
const upload = multer({ storage });

let sizeOf = null;
try { sizeOf = require('image-size'); } catch (e) { console.warn('image-size not installed — sprite dimensions will be unavailable. Run: npm install image-size'); }

// Helper to convert camelCase to hyphenated-name
function camelToHyphen(str) {
    if (!str) return null;
    return str.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '');
}

// Helper to convert hyphenated-name to camelCase
function hyphenToCamel(str) {
    if (!str) return null;
    return str.replace(/-([a-z])/g, g => g[1].toUpperCase());
}

async function scanBundles() {
    const bundlePath = path.join(PROJECT_ROOT, 'core/assets/bundles/bundle.properties');
    if (!await fs.pathExists(bundlePath)) return {};

    const content = await fs.readFile(bundlePath, 'utf8');
    const mapping = {};
    const lines = content.split('\n');
    for (const line of lines) {
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) continue;
        const key = line.substring(0, eqIndex).trim();
        const val = line.substring(eqIndex + 1).trim();
        mapping[key] = val;
    }
    return mapping;
}

// Pre-build a sprite index: basename -> [{relPath, fullPath}]
async function buildSpriteIndex() {
    const allFiles = await fg('**/*.png', { cwd: SPRITES_ROOT });
    const index = new Map();
    for (const f of allFiles) {
        const relPath = f.replace(/\\/g, '/');
        const bn = path.basename(f, '.png');
        if (!index.has(bn)) index.set(bn, []);
        index.get(bn).push({ relPath, fullPath: path.join(SPRITES_ROOT, f) });
    }
    return index;
}

async function scanBundles(bundleFile = 'bundle') {
    const bundlePath = path.join(PROJECT_ROOT, `core/assets/bundles/${bundleFile}.properties`);
    if (!await fs.pathExists(bundlePath)) return {};

    const content = await fs.readFile(bundlePath, 'utf8');
    const mapping = {};
    const lines = content.split('\n');
    for (const line of lines) {
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) continue;
        const key = line.substring(0, eqIndex).trim();
        const val = line.substring(eqIndex + 1).trim();
        mapping[key] = val;
    }
    return mapping;
}

// Fast sprite lookup using pre-built index
function findSpriteInfo(asset, spriteIndex) {
    const { id, variableName, type: assetType } = asset;
    const candidates = new Set();
    const tried = [];

    const addVariants = (name) => {
        if (!name) return;
        const baseNames = [name, camelToHyphen(name), hyphenToCamel(name)];
        baseNames.forEach(bn => {
            if (!bn) return;
            candidates.add(bn);
            candidates.add(`${bn}-bottom`);
            candidates.add(`${bn}-base`);
            candidates.add(`${bn}-top`);
            candidates.add(`${bn}-mid`);
            candidates.add(`${bn}-heat`);

            if (!bn.startsWith('reinforced-')) {
                const r = `reinforced-${bn}`;
                candidates.add(r);
                candidates.add(`${r}-bottom`);
                candidates.add(`${r}-base`);
            }
        });
    };

    addVariants(id);
    addVariants(variableName);

    // Type-specific prefixes
    if (assetType === 'item') {
        if (id) candidates.add(`item-${id}`);
        if (variableName) candidates.add(`item-${camelToHyphen(variableName)}`);
    } else if (assetType === 'liquid') {
        if (id) candidates.add(`liquid-${id}`);
        if (variableName) candidates.add(`liquid-${camelToHyphen(variableName)}`);
    } else if (assetType === 'effect') {
        if (id) candidates.add(`status-${id}`);
    } else if (assetType === 'sector') {
        if (id) candidates.add(`sector-${id}`);
        if (variableName) candidates.add(`sector-${variableName}`);
        if (variableName) candidates.add(`sector-${camelToHyphen(variableName)}`);
    } else if (assetType === 'weather') {
        const pr = asset.properties?.particleRegion;
        const np = asset.properties?.noisePath;
        if (pr) candidates.add(pr);
        if (np) candidates.add(np);
        // Defaults for ParticleWeather
        candidates.add("particle");
        candidates.add("circle-shadow");
        candidates.add("noiseAlpha");
        candidates.add("circle-small");
    }

    // Exact match via index
    for (const searchId of candidates) {
        if (!searchId) continue;
        tried.push(searchId);
        const entries = spriteIndex.get(searchId);
        if (entries && entries.length > 0) {
            const { relPath, fullPath } = entries[0];
            const parts = relPath.split('/');
            let category = 'General';
            if (parts.length >= 2) {
                category = parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
            }

            let dimensions = { width: 0, height: 0 };
            let fileSize = 0;
            try {
                dimensions = sizeOf(fullPath);
                const stats = require('fs').statSync(fullPath);
                fileSize = stats.size;
            } catch (e) { /* ignore */ }

            // Look for secondary layers
            const layers = [];
            const suffixes = ['-team', '-outline', '-heat', '-top', '-bottom', '-mid'];
            suffixes.forEach(suffix => {
                const layerId = searchId + suffix;
                const layerEntries = spriteIndex.get(layerId);
                if (layerEntries && layerEntries.length > 0) {
                    layers.push({
                        type: suffix.replace('-', ''),
                        path: layerEntries[0].relPath
                    });
                }
            });

            return {
                path: relPath, category, matchedName: searchId,
                dimensions, fileSize, fullPath, tried, layers
            };
        }
    }

    // Fallback: prefix match via index scan
    for (const searchId of candidates) {
        if (!searchId) continue;
        const matches = [];
        for (const [bn, entries] of spriteIndex) {
            if (bn.startsWith(searchId)) {
                matches.push(entries[0]);
            }
        }
        if (matches.length > 0) {
            matches.sort((a, b) => a.relPath.length - b.relPath.length);
            const { relPath } = matches[0];
            const parts = relPath.split('/');
            let category = 'General';
            if (parts.length >= 2) {
                category = parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
            }
            return { path: relPath, category, matchedName: path.basename(relPath, '.png'), tried };
        }
    }

    return { path: null, category: 'Unknown', matchedName: null, tried };
}

// Extract key properties from the {{ ... }} stats block
function extractProperties(statsRaw) {
    if (!statsRaw || statsRaw === ';') return {};
    const props = {};
    // Match simple assignments: propertyName = value;
    const assignRegex = /(\w+)\s*=\s*([^;{]+);/g;
    let m;
    while ((m = assignRegex.exec(statsRaw)) !== null) {
        const key = m[1].trim();
        let val = m[2].trim();
        val = val.replace(/f$/, '').replace(/^"|"$/g, '').trim();
        if (val.includes('=>') || val.includes('->') || val.length > 80) continue;
        props[key] = val;
    }
    // Extract requirements as structured array [{item, count}]
    const reqMatch = statsRaw.match(/requirements\(Category\.(\w+),\s*with\(([^)]+)\)\)/);
    if (reqMatch) {
        props._category = reqMatch[1];
        const pairs = [];
        const reqStr = reqMatch[2];
        const reqItemRegex = /Items\.(\w+),\s*(\d+)/g;
        let rm;
        while ((rm = reqItemRegex.exec(reqStr)) !== null) {
            pairs.push({ item: rm[1], count: parseInt(rm[2]) });
        }
        props._requirements = pairs;
    }
    // Extract structured ammo cases: [{source, bulletType, props: {key: val}}]
    const ammoBlockMatch = statsRaw.match(/ammo\(([\s\S]*?)\);/);
    if (ammoBlockMatch) {
        const ammoStr = ammoBlockMatch[1];
        const ammo = [];
        // Match each ammo entry: Items.xxx or Liquids.xxx, new BulletType(args){{ body }}
        const entryRegex = /(?:Items|Liquids)\.(\w+),\s*new\s+(\w+)\(([^)]*)\)\s*\{\{([\s\S]*?)\}\}/g;
        let em;
        while ((em = entryRegex.exec(ammoStr)) !== null) {
            const source = em[1];
            const bulletType = em[2];
            const ctorArgs = em[3].trim();
            const body = em[4];
            const bulletProps = {};
            // Parse constructor args — first arg is typically speed, second is damage
            const argParts = ctorArgs.split(',').map(s => s.trim().replace(/f$/, ''));
            if (argParts.length >= 1 && !isNaN(parseFloat(argParts[0]))) bulletProps.speed = argParts[0];
            if (argParts.length >= 2 && !isNaN(parseFloat(argParts[1]))) bulletProps.damage = argParts[1];
            // Parse body assignments
            const bodyRegex = /(\w+)\s*=\s*([^;{]+);/g;
            let bm;
            while ((bm = bodyRegex.exec(body)) !== null) {
                const bk = bm[1].trim();
                let bv = bm[2].trim().replace(/f$/, '');
                if (bv.includes('=>') || bv.includes('->') || bv.length > 60) continue;
                bulletProps[bk] = bv;
            }
            ammo.push({ source, bulletType, props: bulletProps });
        }
        if (ammo.length > 0) props._ammo = ammo;
    }
    return props;
}

// Helper to extract variable names from Java content files
// Returns [{name, subCategory}] where subCategory comes from //comment sections
async function extractVariables(fileName, typeName) {
    const filePath = path.join(CONTENT_ROOT, fileName);
    if (!await fs.pathExists(filePath)) return [];

    const content = await fs.readFile(filePath, 'utf8');
    const typeHeader = `public static ${typeName}`;
    let variables = [];

    let lastPos = 0;
    while (true) {
        const startIdx = content.indexOf(typeHeader, lastPos);
        if (startIdx === -1) break;

        const endIdx = content.indexOf(';', startIdx);
        if (endIdx === -1) break;

        const block = content.substring(startIdx + typeHeader.length, endIdx);
        const lines = block.split('\n');
        let currentSubCat = '';
        for (const line of lines) {
            const trimmed = line.trim();
            const commentMatch = trimmed.match(/^\/\/\s*(.+)/);
            if (commentMatch) {
                currentSubCat = commentMatch[1].trim();
                currentSubCat = currentSubCat.charAt(0).toUpperCase() + currentSubCat.slice(1);
                continue;
            }
            const clean = trimmed.replace(/\/\/.*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
            const names = clean.split(',').map(n => n.trim()).filter(n => n && /^[a-zA-Z0-9_]+$/.test(n));
            for (const n of names) {
                variables.push({ name: n, subCategory: currentSubCat });
            }
        }
        lastPos = endIdx;
    }

    const seen = new Set();
    return variables.filter(v => { if (seen.has(v.name)) return false; seen.add(v.name); return true; });
}

// Helper to extract balanced braces block
function getBalancedBraces(content, startIndex) {
    let depth = 0;
    let i = startIndex;
    let foundStart = false;
    let startPos = -1;

    for (; i < content.length; i++) {
        if (content[i] === '{') {
            if (!foundStart) {
                foundStart = true;
                startPos = i;
            }
            depth++;
        } else if (content[i] === '}') {
            depth--;
            if (foundStart && depth === 0) {
                return content.substring(startPos, i + 1);
            }
        } else if (content[i] === ';' && !foundStart) {
            // Reached end of statement without finding {{
            return ";";
        }
    }
    return null;
}

// Scan all Java files for sprite references:
// - Core.atlas.find("...")
// - Draw.rect("...", ...)
// - Drawf.spinSprite(Core.atlas.find("..."), ...)
async function scanAtlasFinds() {
    const javaRoot = path.join(PROJECT_ROOT, 'core/src/mindustry');
    const files = await fg('**/*.java', { cwd: javaRoot });
    const patterns = [
        /Core\.atlas\.find\("([^"]+)"\)/g,
        /Draw\.rect\("([^"]+)",/g,
    ];
    const names = new Set();
    for (const f of files) {
        const content = await fs.readFile(path.join(javaRoot, f), 'utf8');
        for (const regex of patterns) {
            let m;
            while ((m = regex.exec(content)) !== null) {
                names.add(m[1]);
            }
            regex.lastIndex = 0;
        }
    }
    return names;
}

// Scans core/assets/icons/icons.properties for UI icon mapping
async function scanIcons() {
    const iconPath = path.join(PROJECT_ROOT, 'core/assets/icons/icons.properties');
    if (!await fs.pathExists(iconPath)) return new Set();

    const content = await fs.readFile(iconPath, 'utf8');
    const names = new Set();
    const lines = content.split('\n');
    for (const line of lines) {
        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) continue;
        const parts = line.substring(eqIndex + 1).split('|');
        if (parts.length >= 2) {
            names.add(parts[1].trim()); // The second part (texture name)
        }
    }
    return names;
}

// Parse UnitTypes.java for weapon sprite names: new Weapon("sprite-name")
// Returns Map<weaponSpriteName, unitName> for ownership tracking
async function parseWeapons() {
    const filePath = path.join(CONTENT_ROOT, 'UnitTypes.java');
    if (!await fs.pathExists(filePath)) return new Map();

    const content = await fs.readFile(filePath, 'utf8');
    const weaponMap = new Map(); // weaponSpriteName -> unitName

    // Find all unit definitions and their weapons
    const unitRegex = /(?:new\s+UnitType\("([^"]+)"\))|(new\s+Weapon\("([^"]+)"\))/g;
    let currentUnit = null;
    let m;
    while ((m = unitRegex.exec(content)) !== null) {
        if (m[1]) {
            currentUnit = m[1];
        } else if (m[3] && currentUnit) {
            weaponMap.set(m[3], currentUnit);
        }
    }
    return weaponMap;
}

// Known generated sprite patterns from Generators.java
// These are created at build time and don't map to content variables
const GENERATED_PATTERNS = [
    /^cliffmask\d+$/,           // cliff masks
    /^block-.*-full$/,           // block composite icons 
    /^unit-.*-full$/,            // unit composite icons
    /^.*-ui$/,                   // UI icons
    /^.*-outline$/,              // outlined versions
    /^.*-team-\w+$/,             // team-colored versions
    /^.*-segment-outline\d*$/,   // crawl unit segment outlines
    /^.*-treads\d+-\d+$/,        // tank tread animation frames
    /^splash-\d+$/,              // splash animation frames
    /^bubble-\d+$/,              // bubble animation frames
    /^fluid-(liquid|gas)-\d+$/,  // liquid/gas animation frames
    /^rubble-\d+-\d+$/,           // rubble decals when blocks are destroyed
];

// Factory shared sprites pattern from PayloadBlock.java
const FACTORY_PATTERN = /^factory-(in|out|top)-\d+(-dark)?$/;

// Robust Java Parsing
async function parseContent(bundleFile, onProgress = () => { }) {
    const assetsMap = new Map(); // variableName -> asset
    let statsSummary = { total: 0, withSprites: 0 };

    const scanFile = async (fileName, typeName, javaType, defaultCategory, regex) => {
        const filePath = path.join(CONTENT_ROOT, fileName);
        if (!await fs.pathExists(filePath)) return;

        // 1. Seed from variable declarations
        const vars = await extractVariables(fileName, javaType);
        vars.forEach(({ name: v, subCategory }) => {
            if (!assetsMap.has(v)) {
                assetsMap.set(v, {
                    variableName: v,
                    id: null,
                    type: typeName,
                    category: defaultCategory,
                    subCategory: subCategory || '',
                    sourceFile: fileName,
                    spritePath: null,
                    matchedName: null,
                    statsRaw: null,
                    isVariableOnly: true
                });
            }
        });

        const content = await fs.readFile(filePath, 'utf8');
        let match;
        while ((match = regex.exec(content)) !== null) {
            let variableName, id;
            if (match.length === 4) { // block style: assign, type, id
                [, variableName, , id] = match;
            } else { // simple style: assign, id
                [, variableName, id] = match;
            }

            const searchStart = match.index + match[0].length;
            const statsBlock = getBalancedBraces(content, searchStart) || "";

            const targetVar = variableName || (id ? hyphenToCamel(id) : null);
            let asset = assetsMap.get(targetVar);

            if (!asset) {
                asset = {
                    variableName: targetVar || id,
                    id: id,
                    type: typeName,
                    category: defaultCategory,
                    sourceFile: fileName,
                    isVariableOnly: false
                };
                if (targetVar) assetsMap.set(targetVar, asset);
                else assetsMap.set(`anon_${Math.random().toString(36).substr(2, 5)}`, asset);
            }

            asset.id = id;
            asset.statsRaw = statsBlock;
            asset.health = statsBlock.match(/health\s*=\s*([\d.f]+)/)?.[1]?.replace('f', '');
            asset.isVariableOnly = false;
        }
    };

    // Parallel scan — content files + global atlas.find/Draw.rect references
    onProgress('Parsing Java content files...');
    const contentFiles = [
        ['Blocks.java', 'block', 'Block', 'Block', /(?:(\w+)\s*=\s*)?new\s+(\w+)\s*\(\s*"([^"]+)"\s*\)/g],
        ['UnitTypes.java', 'unit', 'UnitType', 'Units', /(?:(\w+)\s*=\s*)?new\s+UnitType\("([^"]+)"\)/g],
        ['Items.java', 'item', 'Item', 'Items', /(?:(\w+)\s*=\s*)?new\s+Item\("([^"]+)"[^)]*\)/g],
        ['Liquids.java', 'liquid', 'Liquid', 'Liquids', /(?:(\w+)\s*=\s*)?new\s+Liquid\("([^"]+)"[^)]*\)/g],
        ['StatusEffects.java', 'effect', 'StatusEffect', 'Effects', /(?:(\w+)\s*=\s*)?new\s+StatusEffect\("([^"]+)"[^)]*\)/g],
        ['Weathers.java', 'weather', 'Weather', 'Weather', /(?:(\w+)\s*=\s*)?new\s+\w*Weather\("([^"]+)"[^)]*\)/g],
        ['Planets.java', 'planet', 'Planet', 'Planets', /(?:(\w+)\s*=\s*)?new\s+Planet\("([^"]+)"[^)]*\)/g],
        ['SectorPresets.java', 'sector', 'SectorPreset', 'Sectors', /(?:(\w+)\s*=\s*)?new\s+SectorPreset\("([^"]+)"[^)]*\)/g],
    ];
    for (let i = 0; i < contentFiles.length; i++) {
        const [fn, ...args] = contentFiles[i];
        onProgress(`Scanning ${fn} (${i + 1}/${contentFiles.length})...`);
        await scanFile(fn, ...args);
    }

    onProgress('Scanning Java source tree for atlas references...');
    const atlasNames = await scanAtlasFinds();
    onProgress(`Found ${atlasNames.size} atlas references across all Java files.`);

    onProgress('Scanning icons.properties for UI icons...');
    const iconNames = await scanIcons();
    onProgress(`Found ${iconNames.size} UI icon mappings.`);
    for (const name of iconNames) atlasNames.add(name);

    onProgress('Loading localization bundles...');
    const bundle = await scanBundles(bundleFile);

    const assets = Array.from(assetsMap.values());
    const matchedSpritePaths = new Set();

    onProgress('Building sprite index...');
    const spriteIndex = await buildSpriteIndex();
    onProgress(`Indexed ${spriteIndex.size} unique sprite names. Matching ${assets.length} assets...`);

    for (let i = 0; i < assets.length; i++) {
        if (i % 100 === 0) onProgress(`Matching sprites... ${i}/${assets.length}`);
        const asset = assets[i];

        // Extract properties first so they can be used for sprite matching (e.g. weather particles)
        asset.properties = extractProperties(asset.statsRaw);
        delete asset.statsRaw; // don't send raw block to frontend

        const spriteInfo = findSpriteInfo(asset, spriteIndex);
        asset.spritePath = spriteInfo.path;
        asset.category = spriteInfo.category !== 'Unknown' ? spriteInfo.category : asset.category;
        asset.matchedName = spriteInfo.matchedName;
        asset.dimensions = spriteInfo.dimensions;
        asset.fileSize = spriteInfo.fileSize;
        asset.tried = spriteInfo.tried;
        asset.spriteInfo = spriteInfo; // Includes layers for multi-layer rendering

        // Apply localization
        const hyphenId = camelToHyphen(asset.id || asset.variableName);
        const prefix = asset.type === 'unit' ? 'unit' : (asset.type === 'item' ? 'item' : (asset.type === 'liquid' ? 'liquid' : 'block'));
        asset.name = bundle[`${prefix}.${hyphenId}.name`] || bundle[`${prefix}.${asset.id}.name`] || asset.variableName;
        asset.description = bundle[`${prefix}.${hyphenId}.description`] || bundle[`${prefix}.${asset.id}.description`] || "";

        if (asset.spritePath) {
            statsSummary.withSprites++;
            matchedSpritePaths.add(asset.spritePath);
        }
        statsSummary.total++;
    }

    onProgress('Parsing weapon sprites from UnitTypes.java...');
    const weaponMap = await parseWeapons();
    onProgress(`Found ${weaponMap.size} weapon sprites. Computing orphans...`);

    // Reuse sprite index for orphan detection
    const normalizedAll = [];
    for (const [bn, entries] of spriteIndex) {
        for (const e of entries) normalizedAll.push(e.relPath);
    }
    onProgress(`${normalizedAll.length} sprite files total. Filtering...`);

    // Build a lookup of sprite basenames -> paths for atlas.find matching
    const baseNameToPaths = new Map();
    for (const s of normalizedAll) {
        const bn = path.basename(s, '.png');
        if (!baseNameToPaths.has(bn)) baseNameToPaths.set(bn, []);
        baseNameToPaths.get(bn).push(s);
    }

    // Mark sprites referenced by atlas.find as matched
    for (const name of atlasNames) {
        const spritePaths = baseNameToPaths.get(name);
        if (spritePaths) {
            for (const sp of spritePaths) matchedSpritePaths.add(sp);
        }
    }

    // Strategy 1: Mark weapon sprites as matched (owned by their parent unit)
    for (const [weaponName, unitName] of weaponMap) {
        const spritePaths = baseNameToPaths.get(weaponName);
        if (spritePaths) {
            for (const sp of spritePaths) matchedSpritePaths.add(sp);
        }
        // Also match weapon variant sprites: weaponName-heat, weaponName-cell, etc.
        for (const [bn, paths] of baseNameToPaths) {
            if (bn.startsWith(weaponName + '-') || bn.startsWith(weaponName + '-')) {
                for (const sp of paths) matchedSpritePaths.add(sp);
            }
        }
    }

    // Strategy 2: Mark factory shared sprites (PayloadBlock fallback pattern)
    for (const [bn, paths] of baseNameToPaths) {
        if (FACTORY_PATTERN.test(bn)) {
            for (const sp of paths) matchedSpritePaths.add(sp);
        }
    }

    // Strategy 3: Mark generated sprites from Generators.java patterns
    for (const [bn, paths] of baseNameToPaths) {
        if (GENERATED_PATTERNS.some(p => p.test(bn))) {
            for (const sp of paths) matchedSpritePaths.add(sp);
        }
    }

    // Prefix-based ownership: sprites like "router-top", "duo1", "conveyor-0-0"
    // belong to their parent asset (router, duo, conveyor)
    const knownNames = new Set();
    for (const asset of assets) {
        if (asset.id) {
            knownNames.add(asset.id);
            const hyp = camelToHyphen(asset.id);
            if (hyp) knownNames.add(hyp);
        }
        if (asset.variableName) {
            knownNames.add(asset.variableName);
            const hyp = camelToHyphen(asset.variableName);
            if (hyp) knownNames.add(hyp);
        }
    }
    for (const name of atlasNames) knownNames.add(name);
    // Also add weapon names to known names for suffix matching
    for (const [weaponName] of weaponMap) knownNames.add(weaponName);

    for (const s of normalizedAll) {
        if (matchedSpritePaths.has(s)) continue;
        const bn = path.basename(s, '.png');
        for (const known of knownNames) {
            if (bn.startsWith(known) && bn.length > known.length) {
                const nextChar = bn[known.length];
                if (nextChar === '-' || (nextChar >= '0' && nextChar <= '9')) {
                    matchedSpritePaths.add(s);
                    break;
                }
            }
        }
    }

    const orphans = normalizedAll
        .filter(s => !matchedSpritePaths.has(s))
        .map(s => ({
            path: s,
            name: path.basename(s, '.png')
        }));

    onProgress(`Done! ${assets.length} assets, ${statsSummary.withSprites} with sprites, ${orphans.length} orphans.`);
    return { assets, summary: statsSummary, orphans, atlasRefs: atlasNames.size };
}

async function parseTechTree(planetName) {
    const fileName = planetName === 'serpulo' ? 'SerpuloTechTree.java' : 'ErekirTechTree.java';
    const filePath = path.join(PROJECT_ROOT, `core/src/mindustry/content/${fileName}`);
    if (!await fs.pathExists(filePath)) return null;

    const content = await fs.readFile(filePath, 'utf8');
    const nodes = [];

    function processBlock(text, parentId = null) {
        // Matches node, nodeRoot, nodeProduce
        const localRegex = /(node|nodeRoot|nodeProduce)\s*\(\s*([^,()]+)([^()]*)\)\s*(?:,\s*\(\)\s*->\s*)?(\{)?/g;
        let m;
        while ((m = localRegex.exec(text)) !== null) {
            const [full, type, firstArg, restArgs, hasBody] = m;

            let nodeId = firstArg.trim();
            // Handle nodeRoot(name, content, ...)
            if (type === 'nodeRoot') {
                const parts = restArgs.split(',').map(p => p.trim()).filter(p => p);
                if (parts.length > 0) nodeId = parts[0];
            }

            const cleanId = (id) => id.includes('.') ? id.split('.').pop() : id;
            const finalId = cleanId(nodeId).replace(/"/g, '').trim();

            const objectives = [];
            const objRegex = /new\s+(Research|SectorComplete|OnSector|OnPlanet)\s*\(\s*([^,()]+)\)/g;
            let om;
            const allArgs = firstArg + restArgs;
            while ((om = objRegex.exec(allArgs)) !== null) {
                objectives.push({ type: om[1], target: cleanId(om[2].trim()) });
            }

            const node = { id: finalId, parent: parentId, type, objectives };
            nodes.push(node);

            if (hasBody) {
                const body = getBalancedBraces(text, m.index + full.length - 1);
                if (body && body.startsWith('{')) {
                    const inner = body.substring(1, body.length - 1);
                    processBlock(inner, finalId);
                    localRegex.lastIndex = m.index + full.length - 1 + body.length;
                }
            }
        }
    }

    processBlock(content);
    return nodes;
}

app.get('/api/techtree', async (req, res) => {
    try {
        const planet = req.query.planet || 'serpulo';
        const data = await parseTechTree(planet);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Advanced: Patching Java files for Tech Tree editing
app.post('/api/techtree/update', async (req, res) => {
    const { planet, action, node, parentId } = req.body;
    const fileName = planet === 'serpulo' ? 'SerpuloTechTree.java' : 'ErekirTechTree.java';
    const filePath = path.join(PROJECT_ROOT, `core/src/mindustry/content/${fileName}`);

    try {
        let content = await fs.readFile(filePath, 'utf8');

        if (action === 'delete') {
            // Find: node(variable, ...) { ... } or node(variable, ...);
            const regex = new RegExp(`node\\(\\s*${node}\\s*[^()]*\\)\\s*(?:,\\s*\\(\\)\\s*->\\s*)?(\\{|;)`, 'g');
            let m;
            while ((m = regex.exec(content)) !== null) {
                if (m[1] === '{') {
                    const block = getBalancedBraces(content, m.index + m[0].length - 1);
                    content = content.replace(m[0] + block, '');
                } else {
                    content = content.replace(m[0], '');
                }
            }
        } else if (action === 'add') {
            // Add as child of parentId
            const parentRegex = new RegExp(`(node(?:Root)?\\(\\s*(?:[^,()]+,\\s*)?${parentId}\\s*[^()]*\\)\\s*(?:,\\s*\\(\\)\\s*->\\s*)?)(\\{)?`, 'g');
            content = content.replace(parentRegex, (full, head, hasBrace) => {
                if (hasBrace) {
                    return full + `\n            node(${node});`;
                } else {
                    return head + `() -> {{\n            node(${node});\n        }}`;
                }
            });
        }

        await fs.writeFile(filePath, content);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/locales', async (req, res) => {
    try {
        const bundlesDir = path.join(PROJECT_ROOT, 'core/assets/bundles');
        const files = await fs.readdir(bundlesDir);
        const locales = files
            .filter(f => f.startsWith('bundle') && f.endsWith('.properties'))
            .map(f => {
                if (f === 'bundle.properties') return 'en';
                const m = f.match(/bundle_(.+)\.properties/);
                return m ? m[1] : null;
            }).filter(Boolean);
        res.json(locales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Media Inspector Endpoints
app.get('/api/media/sounds', async (req, res) => {
    try {
        const soundsJava = path.join(PROJECT_ROOT, 'core/build/generated/source/kapt/main/mindustry/gen/Sounds.java');
        if (!await fs.pathExists(soundsJava)) return res.json([]);

        const content = await fs.readFile(soundsJava, 'utf8');
        const sounds = [];
        // Match Core.assets.load("sounds/...", ...).loaded = a -> { name = ... }
        const regex = /Core\.assets\.load\("([^"]+)"[^{]+{[^=]+=\s*([^;]+);/g;
        let m;
        while ((m = regex.exec(content)) !== null) {
            const path = m[1].replace('sounds/', '');
            const variable = m[2].split('=').pop().trim().replace('(arc.audio.Sound)a', '').trim();
            // Simpler approach: find the variable name in the assignment
            const varMatch = m[0].match(/loaded\s*=\s*a\s*->\s*{\s*([^=\s]+)\s*=/);
            if (varMatch) {
                sounds.push({ name: varMatch[1], path });
            }
        }
        res.json(sounds);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/media/fx', async (req, res) => {
    try {
        const fxJava = path.join(PROJECT_ROOT, 'core/src/mindustry/content/Fx.java');
        if (!await fs.pathExists(fxJava)) return res.json([]);

        const content = await fs.readFile(fxJava, 'utf8');
        const effects = [];
        // Match name = new Effect(lifetime, e -> { body })
        const regex = /(\w+)\s*=\s*new\s+Effect\(\s*([^,]+),\s*e\s*->\s*(\{)/g;
        let m;
        while ((m = regex.exec(content)) !== null) {
            const name = m[1];
            const lifetime = m[2].replace('f', '').trim();
            const body = getBalancedBraces(content, m.index + m[0].length - 1);
            effects.push({ name, lifetime, code: body });
        }
        res.json(effects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/assets', async (req, res) => {
    try {
        const locale = req.query.locale || 'en';
        const bundleFile = locale === 'en' ? 'bundle' : `bundle_${locale}`;
        const data = await parseContent(bundleFile);
        res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// SSE endpoint for streaming progress
app.get('/api/assets-stream', async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const locale = req.query.locale || 'en';
    const bundleFile = locale === 'en' ? 'bundle' : `bundle_${locale}`;

    try {
        const data = await parseContent(bundleFile, (msg) => {
            res.write(`data: ${JSON.stringify({ type: 'progress', message: msg })}\n\n`);
        });
        res.write(`data: ${JSON.stringify({ type: 'done', ...data })}\n\n`);
    } catch (err) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    }
    res.end();
});

app.use('/sprites', express.static(SPRITES_ROOT));

app.post('/api/replace-sprite', upload.single('sprite'), (req, res) => {
    res.json({ success: true });
});

app.post('/api/assets/bulk-update', async (req, res) => {
    const { updates } = req.body; // updates: [{ id, sourceFile, stats }, ...]
    if (!updates || !Array.isArray(updates)) return res.status(400).json({ error: 'Invalid updates' });

    // Group updates by file to minimize I/O
    const fileGroups = {};
    updates.forEach(u => {
        if (!fileGroups[u.sourceFile]) fileGroups[u.sourceFile] = [];
        fileGroups[u.sourceFile].push(u);
    });

    const results = { modified: 0, files: Object.keys(fileGroups).length };

    try {
        for (const [sourceFile, assets] of Object.entries(fileGroups)) {
            const filePath = path.join(CONTENT_ROOT, sourceFile);
            if (!await fs.pathExists(filePath)) continue;

            // Simple backup before mass edit
            await fs.copyFile(filePath, `${filePath}.bak`);

            let content = await fs.readFile(filePath, 'utf8');

            for (const asset of assets) {
                const escapedId = asset.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const entryRegex = new RegExp(`(\\w+\\s*=\\s*new\\s+\\w+\\("${escapedId}"\\))(\\{\\{([\\s\\S]*?)\\}\\}|;)`, 'g');

                content = content.replace(entryRegex, (match, head, bodyFull, bodyInner) => {
                    let isSimplified = bodyFull === ';';
                    let currentBody = isSimplified ? "" : bodyInner;

                    for (const [key, value] of Object.entries(asset.stats)) {
                        if (value === null || value === '') continue;
                        const statRegex = new RegExp(`(${key}\\s*=\\s*)([\\d.f]+)`, 'g');
                        if (statRegex.test(currentBody)) {
                            currentBody = currentBody.replace(statRegex, `$1${value}f`);
                        } else {
                            currentBody = currentBody.trimEnd() + `\n            ${key} = ${value}f;\n        `;
                        }
                    }

                    if (isSimplified && currentBody !== "") {
                        return head + "{{\n        " + currentBody.trim() + "\n    }}";
                    } else if (!isSimplified) {
                        return head + "{{" + currentBody + "}}";
                    }
                    return match;
                });
                results.modified++;
            }

            await fs.writeFile(filePath, content);
        }
        res.json({ success: true, ...results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/assets/generate', async (req, res) => {
    const { type, id, name, stats } = req.body;
    if (!type || !id || !name || !ASSET_TEMPLATES[type]) {
        return res.status(400).json({ error: 'Missing or invalid parameters' });
    }

    const isUnit = type === 'unit';
    const targetFile = isUnit ? 'UnitTypes.java' : 'Blocks.java';
    const filePath = path.join(CONTENT_ROOT, targetFile);

    try {
        // 1. Update Java Class
        let content = await fs.readFile(filePath, 'utf8');

        // Find the public static Type field declaration to add the new ID
        const fieldType = isUnit ? 'UnitType' : 'Block';
        const fieldRegex = new RegExp(`public static (?:@EntityDef\\([^)]*\\) )?${fieldType}\\s+([^;]+);`);

        content = content.replace(fieldRegex, (match, fields) => {
            if (fields.includes(id)) return match; // Already exists
            // Clean up whitespace and add the new field
            const cleanedFields = fields.trim().replace(/\s+/g, ' ');
            return `public static ${isUnit ? '@EntityDef({Unitc.class}) UnitType' : 'Block'} ${cleanedFields}, ${id};`;
        });

        // Find the end of the load() method (before //endregion)
        const loadEndIdx = content.lastIndexOf('//endregion');
        if (loadEndIdx === -1) throw new Error('Could not find //endregion in ' + targetFile);

        const generatedCode = ASSET_TEMPLATES[type](id, name, stats);
        content = content.slice(0, loadEndIdx) + generatedCode + '\n\n        ' + content.slice(loadEndIdx);

        await fs.writeFile(filePath, content);

        // 2. Update Localization (bundle.properties)
        let bundleContent = await fs.readFile(BUNDLE_PATH, 'utf8');
        const localeKey = `${isUnit ? 'unit' : 'block'}.${name}.name`;
        if (!bundleContent.includes(`${localeKey}=`)) {
            const readableName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            bundleContent += `\n${localeKey} = ${readableName}`;
            bundleContent += `\n${isUnit ? 'unit' : 'block'}.${name}.description = A newly generated ${type}.`;
            await fs.writeFile(BUNDLE_PATH, bundleContent);
        }

        res.json({ success: true, message: `Asset ${id} generated successfully in ${targetFile}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/update-stats', async (req, res) => {
    const { id, sourceFile, stats } = req.body;
    const filePath = path.join(CONTENT_ROOT, sourceFile);

    try {
        let content = await fs.readFile(filePath, 'utf8');
        const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Improved patcher that handles entries with and without {{ }}
        const entryRegex = new RegExp(`(\\w+\\s*=\\s*new\\s+\\w+\\("${escapedId}"\\))(\\{\\{([\\s\\S]*?)\\}\\}|;)`, 'g');

        content = content.replace(entryRegex, (match, head, bodyFull, bodyInner) => {
            let isSimplified = bodyFull === ';';
            let currentBody = isSimplified ? "" : bodyInner;

            for (const [key, value] of Object.entries(stats)) {
                if (value === null || value === '') continue;
                const statRegex = new RegExp(`(${key}\\s*=\\s*)([\\d.f]+)`, 'g');
                if (statRegex.test(currentBody)) {
                    currentBody = currentBody.replace(statRegex, `$1${value}f`);
                } else {
                    currentBody = currentBody.trimEnd() + `\n            ${key} = ${value}f;\n        `;
                }
            }

            if (isSimplified && currentBody !== "") {
                return head + "{{\n        " + currentBody.trim() + "\n    }}";
            } else if (!isSimplified) {
                return head + "{{" + currentBody + "}}";
            }
            return match;
        });

        await fs.writeFile(filePath, content);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/open-folder', (req, res) => {
    const { spritePath } = req.body;
    if (!spritePath) return res.status(400).json({ error: 'No path' });
    const absPath = path.resolve(SPRITES_ROOT, spritePath);
    // Open folder and select file (Windows)
    exec(`explorer /select,"${absPath}"`, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/repack', (req, res) => {
    exec('gradlew.bat tools:pack', { cwd: PROJECT_ROOT }, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ error: stderr });
        res.json({ success: true, log: stdout });
    });
});

app.listen(port, () => {
    console.log(`Backend listening at http://localhost:${port}`);
});
