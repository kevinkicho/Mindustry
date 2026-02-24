const fs = require('fs-extra');
const path = require('path');

const CONTENT_ROOT = 'c:/Users/kevin/Downloads/Mindustry/core/src/mindustry/content';

async function extractVariables(fileName, typeName) {
    const filePath = path.join(CONTENT_ROOT, fileName);
    if (!await fs.pathExists(filePath)) {
        console.log(`File missing: ${filePath}`);
        return [];
    }

    console.log(`Reading ${fileName}...`);
    const content = await fs.readFile(filePath, 'utf8');
    const regex = new RegExp(`public\\s+static\\s+${typeName}\\s+([\\s\\S]+?);`, 'g');
    let variables = [];
    let match;
    console.log(`Searching for variables of type ${typeName}...`);
    while ((match = regex.exec(content)) !== null) {
        const block = match[1];
        let clean = block.replace(/\/\/.*/g, '');
        clean = clean.replace(/\/\*[\s\S]*?\*\//g, '');
        const names = clean.split(',').map(n => n.trim()).filter(n => n && /^[a-zA-Z0-9_]+$/.test(n));
        variables.push(...names);
        console.log(`Found ${names.length} variables in a block.`);
    }
    return [...new Set(variables)];
}

(async () => {
    try {
        const vars = await extractVariables('Blocks.java', 'Block');
        console.log(`Total variables found: ${vars.length}`);
        console.log(`First 10: ${vars.slice(0, 10).join(', ')}`);

        const items = await extractVariables('Items.java', 'Item');
        console.log(`Total items found: ${items.length}`);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
