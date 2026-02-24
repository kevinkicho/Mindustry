const fs = require('fs');
const path = require('path');

let log = '';
const logger = (msg) => { log += msg + '\n'; console.log(msg); };

try {
    const filePath = path.resolve('core/src/mindustry/content/TestBlocks.java');
    logger('Reading: ' + filePath);
    let content = fs.readFileSync(filePath, 'utf8');

    const id = 'blockA';
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const entryRegex = new RegExp(`(\\w+\\s*=\\s*new\\s+\\w+\\("${escapedId}"\\))(\\{\\{([\\s\\S]*?)\\}\\}|;)`, 'g');

    logger('Regex: ' + entryRegex.toString());

    const newContent = content.replace(entryRegex, (match, head, bodyFull, bodyInner) => {
        logger('Match found for ' + id);
        let currentBody = bodyFull === ';' ? '' : bodyInner;
        currentBody = currentBody.replace(/(health\s*=\s*)([\d.f]+)/g, '$1200f');
        return head + '{{' + currentBody + '}}';
    });

    if (newContent === content) {
        logger('No changes made (regex did not match as expected).');
    } else {
        fs.writeFileSync(filePath, newContent);
        logger('File updated successfully.');
    }
} catch (e) {
    logger('ERROR: ' + e.message);
}

fs.writeFileSync('verify_result.txt', log);
