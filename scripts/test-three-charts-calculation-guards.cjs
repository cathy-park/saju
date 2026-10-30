const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
let ts; for (const p of [process.env.TYPESCRIPT_PATH, 'typescript'].filter(Boolean)) {try {ts=require(p);break;}catch{}}
if (!ts) throw Error('TypeScript compiler unavailable');
const root=process.cwd(), source=process.env.SOURCE_DIR || path.join(__dirname,'../artifacts/saju-app/src/lib');
// 업스트림 tenGods.ts의 getTenGod 계산부만 격리한다. UI/React 코드는 실행하지 않는다.
const STEM_ELEMENT={갑:'목',을:'목',병:'화',정:'화',무:'토',기:'토',경:'금',신:'금',임:'수',계:'수'};
const STEM_YANG=new Set(['갑','병','무','경','임']);
const BRANCH_MAIN_STEM={자:'계',축:'기',인:'갑',묘:'을',진:'무',사:'병',오:'정',미:'기',신:'경',유:'신',술:'무',해:'임'};
const GENERATING={목:'화',화:'토',토:'금',금:'수',수:'목'};
const CONTROLLING={목:'토',토:'수',수:'화',화:'금',금:'목'};
function getTenGod(dayStem,otherChar){
 const target=STEM_ELEMENT[otherChar]?otherChar:BRANCH_MAIN_STEM[otherChar]??otherChar;
 const dayEl=STEM_ELEMENT[dayStem],otherEl=STEM_ELEMENT[target];
 if(!dayEl||!otherEl)return null;
 const same=STEM_YANG.has(dayStem)===STEM_YANG.has(target);
 if(dayEl===otherEl)return same?'비견':'겁재';
 if(GENERATING[dayEl]===otherEl)return same?'식신':'상관';
 if(CONTROLLING[dayEl]===otherEl)return same?'편재':'정재';
 if(CONTROLLING[otherEl]===dayEl)return same?'편관':'정관';
 if(GENERATING[otherEl]===dayEl)return same?'편인':'정인';return null;
}
const calls=[];
const manseryeok={
 solarToLunar:(y,m,d)=>({lunar:{year:y,month:m,day:d,isLeapMonth:false}}),
 lunarToSolar:(y,m,d)=>({solar:{year:y,month:m,day:d}}),
 calculateSaju:(...args)=>{calls.push(args);return {yearPillar:'갑자',yearPillarHanja:'甲子',monthPillar:'병인',monthPillarHanja:'丙寅',dayPillar:'정미',dayPillarHanja:'丁未',hourPillar:'기유',hourPillarHanja:'己酉',isTimeCorrected:args[5].applyTimeCorrection,correctedTime:args[5].applyTimeCorrection?{hour:18,minute:58}:undefined};},
};
const cache={};
function load(name){
 if(cache[name])return cache[name];
 const src=fs.readFileSync(path.join(source,name+'.ts'),'utf8');
 const result=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,strict:true},reportDiagnostics:true});
 const errs=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errs.length,0,'Syntax diagnostics in '+name);
 const module={exports:{}};cache[name]=module.exports;
 const req=x=>x==='./tenGods'?{getTenGod}:x==='@fullstackfamily/manseryeok'?manseryeok:load(x.replace(/^\.\//,''));
 vm.runInNewContext('(function(require,module,exports){'+result.outputText+'\n})',{console,Date,Math,Number,RangeError})(req,module,module.exports);
 return cache[name]=module.exports;
}
const g=load('gukguk'),l=load('latentGukguk'),t=load('timeCalculationAudit'),s=load('sajuEngine');
const results=[];function test(name,f){try{f();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:e.message});}}
const eq=(actual,expected)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected));
test('丁寅: 겁재 투출을 양인격으로 오분류하지 않음',()=>assert.equal(g.determineGukguk('정','인',['기','병','정','기']),null));
test('丁寅: 정인은 strict 판정이 아닌 월령 후보로만 반환',()=>{const r=l.determineLatentGukguk('정','인',['기','병','정','기']);assert.equal(r.name,'정인격');assert.match(r.description,/확정은 아님/);});
for(const [day,branch,target]of[['갑','묘','을'],['병','오','정'],['무','오','정'],['경','유','신'],['임','자','계']]){
 // 戊午의 丁은 정인: 월지 조건을 확인하는 순수 resolver를 테스트한다.
 test(day+' '+branch+' 양인 월지 허용',()=>assert.equal(g.resolveGukgukName(day,branch,'겁재'),'양인격'));
}
for(const day of ['을','정','기','신','계'])test(day+' 음간: 임의 양인격 차단',()=>assert.notEqual(g.resolveGukgukName(day,'인','겁재'),'양인격'));
test('일반 격국: 정관 투출 결과 유지',()=>assert.equal(g.determineGukguk('갑','유',['신','병','갑','무']).name,'정관격'));
test('투출 없음: null 유지',()=>assert.equal(g.determineGukguk('갑','술',['갑','을','갑','계']),null));
test('정인 실제 투출: 정인격 인정',()=>assert.equal(g.determineGukguk('정','인',['갑','병','정','기']).name,'정인격'));
test('규칙 버전 기록',()=>assert.equal(g.determineGukguk('갑','유',['신','병','갑','무']).ruleVersion,g.GUKGUK_RULE_VERSION));
test('구조 분석 내보내기 보존',()=>assert.equal(typeof g.detectStructurePatterns,'function'));
for(const [name,input,want]of[
 ['전일 이월',[2000,2,16,0,5,-14],{year:2000,month:2,day:15,hour:23,minute:51}],
 ['익일 이월',[2000,11,3,23,55,16],{year:2000,month:11,day:4,hour:0,minute:11}],
 ['연도 이월',[2000,12,31,23,59,2],{year:2001,month:1,day:1,hour:0,minute:1}],
 ['윤년 이월',[2000,3,1,0,5,-10],{year:2000,month:2,day:29,hour:23,minute:55}],
 ['평년 이월',[2001,3,1,0,5,-10],{year:2001,month:2,day:28,hour:23,minute:55}],
 ['무보정 동일',[2000,1,1,19,29,0],{year:2000,month:1,day:1,hour:19,minute:29}],
]) test(name,()=>eq(t.shiftSolarDateTime(...input),want));
test('존재하지 않는 날짜 거부',()=>assert.throws(()=>t.shiftSolarDateTime(2001,2,29,0,0,0)));
test('유효하지 않은 시각 거부',()=>assert.throws(()=>t.shiftSolarDateTime(2000,1,1,24,0,0)));
test('무한 보정 거부',()=>assert.throws(()=>t.shiftSolarDateTime(2000,1,1,0,0,Infinity)));
for(const [h,m,d]of[[18,58,2],[19,0,0],[19,3,3],[0,0,60],[23,59,59]]) test(`시진 경계 ${h}:${m}`,()=>assert.equal(t.hourBoundaryDistance(h,m),d));
const birth={name:'회귀시험',gender:'여',calendarType:'solar',year:2000,month:2,day:16,hour:0,minute:5,timeUnknown:false,longitude:127};
test('엔진 래퍼: 균시차 적용 후 전일 날짜 전달',()=>{calls.length=0;s.calculateProfileFromBirth(birth,{localMeridianOn:false,trueSolarTimeOn:true});assert.equal(calls[0][2],15);assert.equal(calls[0][3],23);});
test('엔진 래퍼: 원본 출생정보 불변',()=>{const before=JSON.stringify(birth);const r=s.calculateProfileFromBirth(birth,{trueSolarTimeOn:true});assert.equal(JSON.stringify(birth),before);eq(r.solarDate,{year:2000,month:2,day:16});assert.equal(r.timeAudit.originalTime.hour,0);});
test('기본 시간 기준 보존 및 경계 경고',()=>{const r=s.calculateProfileFromBirth({...birth,hour:19,minute:29});assert.equal(r.timeAudit.basis,'local-mean');assert.ok(r.timeAudit.warnings.includes('HOUR_BRANCH_BOUNDARY_WITHIN_5_MINUTES'));});
test('균시차만 적용한 값을 진태양시로 오표시하지 않음',()=>{const r=s.calculateProfileFromBirth(birth,{localMeridianOn:false,trueSolarTimeOn:true});assert.equal(r.timeAudit.basis,'equation-only');assert.ok(r.timeAudit.warnings.includes('EOT_WITHOUT_LONGITUDE_NOT_TRUE_SOLAR_TIME'));});
test('출생시각 미상: 임의 시진 판정 없음',()=>{const r=s.calculateProfileFromBirth({...birth,timeUnknown:true});assert.equal(r.timeAudit.basis,'unknown');assert.equal(r.timeAudit.effectiveTime,null);assert.equal(r.computedPillars.hour,null);});
test('기본 경도 사용 사실 노출',()=>{const b={...birth};delete b.longitude;const r=s.calculateProfileFromBirth(b);assert.equal(r.timeAudit.longitudeSource,'legacy-default');assert.ok(r.timeAudit.warnings.includes('DEFAULT_LONGITUDE_USED'));});
test('균시차 부호: 2월 음수·11월 양수',()=>{assert.ok(s.equationOfTimeMins(2000,2,16)<0);assert.ok(s.equationOfTimeMins(2000,11,3)>0);});
const summary={scope:'격국·날짜이월·시간감사 격리 단위시험; 만세력 외부 라이브러리는 호출 관찰용 모형, 전체 앱 통합시험/실서버/독립 천문력 검증 아님',passed:results.filter(x=>x.status==='passed').length,failed:results.filter(x=>x.status==='failed').length,results};
fs.writeFileSync(path.join(root,'unit-test-results.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));if(summary.failed)process.exit(1);
