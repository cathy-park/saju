import {build} from 'esbuild';
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=process.cwd();
const app=path.resolve(root,'../artifacts/saju-app/src/lib');
const deps={ '@fullstackfamily/manseryeok':path.join(root,'node_modules/@fullstackfamily/manseryeok/dist/index.js'),'astronomy-engine':path.join(root,'node_modules/astronomy-engine/esm/astronomy.js')};
const packagePath=async(name)=>{const pkg=JSON.parse(await readFile(path.join(root,'node_modules',name,'package.json'),'utf8'));return path.join(root,'node_modules',name,pkg.module??pkg.main);};
for(const name of Object.keys(deps))deps[name]=await packagePath(name);
const result=await build({entryPoints:['src/calculation.ts'],bundle:true,write:false,metafile:true,platform:'browser',format:'esm',alias:{app,...deps,'@':path.dirname(app)},logLevel:'warning'});
const files=[];
for(const input of Object.keys(result.metafile.inputs)) {
  const abs=path.resolve(root,input);
  if(!abs.startsWith(app+path.sep))continue;
  const rel=path.relative(app,abs); const target=path.join(root,'engine-source',rel);
  await mkdir(path.dirname(target),{recursive:true});await copyFile(abs,target);
  const bytes=await readFile(abs);files.push({path:rel,sha256:createHash('sha256').update(bytes).digest('hex')});
}
files.sort((a,b)=>a.path.localeCompare(b.path));
await writeFile('engine-source/provenance.json',JSON.stringify({source:'saju/artifacts/saju-app/src/lib',snapshotAt:new Date().toISOString(),files},null,2)+'\n');
await writeFile('THIRD_PARTY_NOTICES.md',(await readFile('../artifacts/saju-app/THIRD_PARTY_NOTICES.md','utf8'))+'\n## @fullstackfamily/manseryeok 1.0.8\n\n'+await readFile('node_modules/@fullstackfamily/manseryeok/LICENSE','utf8'));
console.log(`Snapshotted ${files.length} existing calculation modules; original app unchanged`);
