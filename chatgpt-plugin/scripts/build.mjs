import {build} from 'esbuild';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=process.cwd();
const provenance=JSON.parse(await readFile('engine-source/provenance.json','utf8'));
for(const file of provenance.files) {const bytes=await readFile(path.join('engine-source',file.path));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error(`Engine changed: ${file.path}`);}
const aliases={app:path.join(root,'engine-source'),'@/lib':path.join(root,'engine-source')};
for(const name of ['@fullstackfamily/manseryeok','astronomy-engine']) {const pkg=JSON.parse(await readFile(path.join('node_modules',name,'package.json'),'utf8'));aliases[name]=path.join(root,'node_modules',name,pkg.module??pkg.main);}
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await build({entryPoints:['src/worker.ts'],outfile:'dist/server/index.js',bundle:true,platform:'browser',format:'esm',target:'es2022',alias:aliases,drop:['console','debugger'],legalComments:'inline',minify:true,define:{'import.meta.env.DEV':'false','process.env.NODE_ENV':'"production"'},metafile:false});
try { await copyFile('.openai/hosting.json','dist/.openai/hosting.json'); } catch(error) { if(error.code!=='ENOENT')throw error; }
await copyFile('THIRD_PARTY_NOTICES.md','dist/THIRD_PARTY_NOTICES.md');
console.log(`Built worker using ${provenance.files.length} verified original modules`);
