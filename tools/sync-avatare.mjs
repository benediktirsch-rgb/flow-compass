import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),website=process.argv[2];
if(!website)throw Error('Website repository path required');
if(!fs.existsSync(path.join(website,'f','vf.js')))throw Error('Not the website repository');
for(const f of ['avatar-core.js','avatar-ui.js','avatar-guides.json'])fs.copyFileSync(path.join(root,f),path.join(website,'f',f));
fs.copyFileSync(path.join(root,'avatar-guides.json'),path.join(root,'produkt','server','avatar-guides.json'));
console.log('Shared avatar distribution synchronized');
