// Synthetic compatibility fixtures retained from the existing Sites server tests.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import path from 'node:path';
const root=process.cwd();
const appSource=process.env.SAJU_APP_SOURCE??path.resolve('../artifacts/saju-app/src');
const alias={app:path.join(appSource,'lib'),'@':appSource};
for(const name of ['@fullstackfamily/manseryeok','astronomy-engine']) {const p=JSON.parse(await readFile(`node_modules/${name}/package.json`));alias[name]=path.join(root,'node_modules',name,p.module??p.main);}
const reference=await build({entryPoints:['tests/parity-entry.ts'],bundle:true,write:false,format:'esm',platform:'browser',alias,drop:['console'],define:{'process.env.NODE_ENV':'"production"'}});
const originalRef=await import('data:text/javascript;base64,'+Buffer.from(reference.outputFiles[0].text).toString('base64'));
const ref=new Proxy(originalRef,{get(target,key){const v=target[key];return typeof v==='function'?(...args)=>JSON.parse(JSON.stringify(v(...args))):v;}});
const source=await readFile('dist/server/index.js','utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const base={birthDate:'1992-06-15',birthTime:'14:30',birthplace:'서울',calendar:'solar',gender:'여'};
async function rpc(method,params={},auth=true){const h={'content-type':'application/json'};if(auth)h['oai-authenticated-user-id']='local-qa';const res=await worker.fetch(new Request('https://test.invalid/mcp',{method:'POST',headers:h,body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));return {status:res.status,body:await res.json()};}
const calculate=async input=>(await rpc('tools/call',{name:'calculate_three_charts',arguments:input})).body.result;
for(const fixture of [base,{...base,birthDate:'2000-02-29',birthTime:'23:30',birthplace:'부산 해운대구',gender:'남'},{...base,calendar:'lunar',birthDate:'1991-03-12',birthplace:'제주'}]) {
 test(`original engine parity ${fixture.calendar} ${fixture.birthDate} ${fixture.birthTime}`,async()=>{
   const actual=await calculate(fixture);assert.equal(actual.isError,false,JSON.stringify(actual));const result=actual.structuredContent;assert.equal(result.status,'calculated');
   const {birthInput,location,dstFold}=ref.normalizeInput(fixture);const profile=ref.calculateProfileFromBirth(birthInput);assert.deepEqual(result.saju.pillars,profile.computedPillars);assert.deepEqual(result.saju.fiveElements,profile.fiveElementDistribution);assert.deepEqual(result.solarDate,profile.solarDate);
   const person={id:'private-person',birthInput,profile,westernLocation:location,createdAt:'',updatedAt:''};const existing=ref.buildExistingPersonalReports(person);assert.deepEqual(result.ziwei.chart,existing.ziweiChart);assert.deepEqual(result.ziwei.report,existing.ziwei);assert.deepEqual(result.saju.sections,existing.saju);
   const natal=ref.calculateNatalChart(result.western.chart.originalBirth);assert.equal(natal.ok,true);assert.deepEqual(result.western.chart,natal.chart);
   const synthesis=ref.resolveWesternPersonalSynthesisForBirth(person.id,{...birthInput,...profile.solarDate,calendarType:'solar',latitude:location.latitude,longitude:location.longitude,timezone:location.timezone,...(dstFold?{dstFold}:{})});assert.equal(synthesis.ok,true);assert.deepEqual(result.western.synthesis,synthesis.report);
   const sources=[...ref.adaptSajuPersonal(existing.saju,person.id),...ref.adaptZiweiPersonal(existing.ziwei,person.id),...ref.adaptWesternPersonal(synthesis.report)];assert.deepEqual(result.integrated,ref.buildIntegratedPersonalReport({personId:person.id,sources}));assert.equal(result.integrated.availableSystems.length,3);
 });
}
test('owner authentication is required',async()=>assert.equal((await rpc('tools/list',{},false)).status,401));
test('discovery and tool schemas',async()=>{const d=await rpc('server/discover');assert.deepEqual(d.body.result.supportedVersions,['2026-07-28']);const l=(await rpc('tools/list')).body.result.tools;assert.equal(l.length,3);assert.ok(l.every(x=>x.annotations.readOnlyHint&&!x.annotations.destructiveHint));});
test('missing birth time is never inferred',async()=>{const r=await calculate({...base,birthTime:undefined});assert.equal(r.isError,true);assert.equal(r.structuredContent.error.code,'TIME_REQUIRED');});
test('calendar and gender are never inferred',async()=>{for(const field of ['calendar','gender'])assert.equal((await calculate({...base,[field]:undefined})).isError,true);});
test('invalid real dates are rejected',async()=>{for(const date of ['2023-02-29','2000-04-31','1899-01-01','2051-01-01'])assert.equal((await calculate({...base,birthDate:date})).isError,true);});
test('ambiguous Korean districts require clarification',async()=>{const r=await calculate({...base,birthplace:'중구'});assert.equal(r.isError,true);assert.ok(r.structuredContent.error.details.candidates.length>1);});
test('lunar leap month cannot silently become normal month',async()=>{assert.equal((await calculate({...base,calendar:'lunar',leapMonth:true})).structuredContent.error.code,'LEAP_MONTH_UNSUPPORTED');});
test('partial or invalid overseas location is rejected',async()=>{assert.equal((await calculate({...base,latitude:37})).isError,true);assert.equal((await calculate({...base,latitude:40,longitude:-74,timezone:'invalid'})).isError,true);});
test('DST repeated time is explicit; unsupported three-system timezone is rejected',async()=>{const input={...base,birthDate:'2000-10-29',birthTime:'01:30',birthplace:'synthetic overseas',latitude:40,longitude:-74,timezone:'America/New_York'};const a=await calculate(input);assert.equal(a.isError,true);assert.equal(a.structuredContent.error.code,'AMBIGUOUS_LOCAL_TIME');const b=await calculate({...input,dstFold:'later'});assert.equal(b.isError,true);assert.equal(b.structuredContent.error.code,'SAJU_ZIWEI_TIMEZONE_UNSUPPORTED');});
test('young birth retains all charts when legacy ziwei narrative is unavailable',async()=>{const r=(await calculate({...base,birthDate:'2024-06-15'})).structuredContent;assert.equal(r.status,'partial');assert.equal(r.ziwei.chart.palaces.length,12);assert.equal(r.ziwei.report,null);assert.equal(r.western.status,'calculated');assert.ok(r.warnings.length);});
test('unsupported overseas latitude is not presented as normal three-system calculation',async()=>{const r=await calculate({...base,birthplace:'synthetic polar',latitude:89,longitude:0,timezone:'UTC'});assert.equal(r.isError,true);assert.equal(r.structuredContent.error.code,'SAJU_ZIWEI_TIMEZONE_UNSUPPORTED');});
test('calls do not persist between requests',async()=>{const a=await calculate(base);await calculate({...base,birthDate:'1980-12-01'});const b=await calculate(base);assert.deepEqual(a,b);});
test('invalid JSON and unknown method are protocol errors',async()=>{const res=await worker.fetch(new Request('https://test.invalid/mcp',{method:'POST',headers:{'oai-authenticated-user-id':'local-qa'},body:'{'}));assert.equal(res.status,400);assert.equal((await rpc('unsupported')).body.error.code,-32601);});
test('status contains no personal birth record',async()=>{const r=(await rpc('tools/call',{name:'three_charts_status'})).body.result;assert.equal(r.structuredContent.storage,'none');assert.ok(!JSON.stringify(r).includes(base.birthDate));});
