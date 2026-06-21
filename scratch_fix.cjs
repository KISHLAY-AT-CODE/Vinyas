const fs = require('fs');
let data = fs.readFileSync('Vinyas_Extension/tracker_ui.js', 'utf8');
data = data.replace(/\\\`/g, '\`');
data = data.replace(/\\\$/g, '$');
fs.writeFileSync('Vinyas_Extension/tracker_ui.js', data);
console.log('Fixed syntax!');
