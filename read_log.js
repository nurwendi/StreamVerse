const fs = require('fs');
const content = fs.readFileSync('debug.log', 'utf8'); // or 'ucs2' if it really is utf16
console.log(content);
