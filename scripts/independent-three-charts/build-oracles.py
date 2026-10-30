#!/usr/bin/env python3
"""Offline synthetic reference generation. Never used by production engines."""
import json,math,datetime,pathlib,sys,os
import swisseph as swe
from korean_lunar_calendar import KoreanLunarCalendar
OUT=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/saju-independent-oracles.json')
YEARS=[1900,1925,1950,1975,2000,2025,2050]
BODIES={'sun':swe.SUN,'moon':swe.MOON,'mercury':swe.MERCURY,'venus':swe.VENUS,'mars':swe.MARS,'jupiter':swe.JUPITER,'saturn':swe.SATURN,'uranus':swe.URANUS,'neptune':swe.NEPTUNE,'pluto':swe.PLUTO}
EPHE=os.environ.get('SWISS_EPHE_PATH')
if EPHE:swe.set_ephe_path(EPHE)
FLAGS=(swe.FLG_SWIEPH if EPHE else swe.FLG_MOSEPH)|swe.FLG_SPEED
UTC=datetime.timezone.utc
iso=lambda jd:datetime.datetime.fromtimestamp((jd-2440587.5)*86400,UTC).isoformat().replace('+00:00','Z')
def calc(jd,body):
 p,flags=swe.calc_ut(jd,body,FLAGS)
 if EPHE and not (flags&swe.FLG_SWIEPH):raise RuntimeError('Swiss data files unavailable; refusing silent fallback')
 return {'longitude':p[0],'latitude':p[1],'speedLongitude':p[3],'returnedFlags':flags}
def root(func,a,b):
 va=func(a)
 for _ in range(45):
  m=(a+b)/2; vm=func(m)
  if va*vm<=0:b=m
  else:a=m;va=vm
 return (a+b)/2
out={'reference':{'pyswisseph':swe.__version__,'sweVersion':swe.version,'ephemeris':('Swiss data files, flags checked' if EPHE else 'explicit Moshier (not JPL/Swiss data files)'),'flags':FLAGS,'frame':'geocentric apparent tropical ecliptic/equinox of date','houses':'Placidus P, UT treated as UTC; UT1-UTC not separately supplied','koreanLunar':'0.3.1 independent table implementation; possible shared official data ancestry'},'astronomy':[],'houses':[],'solarTerms':[],'eot':[],'lunar':[],'stations':[]}
for y in YEARS:
 for month in [1,4,7,10]:
  jd=swe.julday(y,month,15,12+34/60)
  out['astronomy'].append({'iso':iso(jd),'jd':jd,'points':{k:calc(jd,b) for k,b in BODIES.items()}})
  for lat in [-60,-35,0,37.5,60,65,67,75]:
   for lon in [0,127,-74]:
    r={'iso':iso(jd),'latitude':lat,'longitude':lon}
    try:
     cusps,ascmc=swe.houses_ex(jd,lat,lon,b'P');r.update(ok=True,cusps=list(cusps),ascendant=ascmc[0],midheaven=ascmc[1])
    except swe.Error:r.update(ok=False)
    out['houses'].append(r)
 for target in range(0,360,15):
  start=swe.julday(y,1,1);last=start;v=(calc(start,swe.SUN)['longitude']-target+180)%360-180
  for d in range(1,367):
   now=start+d;nv=(calc(now,swe.SUN)['longitude']-target+180)%360-180
   if v<=0<nv and nv-v<180:
    jd=root(lambda t:(calc(t,swe.SUN)['longitude']-target+180)%360-180,last,now)
    out['solarTerms'].append({'year':y,'longitude':target,'jd':jd,'iso':iso(jd)});break
   last=now;v=nv
 date=datetime.date(y,1,1)
 while date.year==y:
  jd=swe.julday(date.year,date.month,date.day,3) # KST noon
  out['eot'].append({'year':y,'month':date.month,'day':date.day,'referenceMinutes':swe.time_equ(jd)*1440})
  date+=datetime.timedelta(days=1)
reuse=os.environ.get('REUSE_LUNAR_JSON')
cal=KoreanLunarCalendar()
# Every day in the supported interval. Output only independent lunar facts.
date=datetime.date(1900,1,1)
while not reuse and date<=datetime.date(2050,12,31):
 if cal.setSolarDate(date.year,date.month,date.day):
  out['lunar'].append({'solar':[date.year,date.month,date.day],'lunar':[cal.lunarYear,cal.lunarMonth,cal.lunarDay,cal.isIntercalation],'gapja':cal.getChineseGapJaString()})
 date+=datetime.timedelta(days=1)
if reuse:out['lunar']=json.loads(pathlib.Path(reuse).read_text())['lunar']
# Exact station roots and 10/60 minute neighborhoods; never call an exact-zero
# classification an error because rounding can choose either sign.
for name,body in list(BODIES.items())[2:]:
 start=swe.julday(2024,1,1);last=start;v=calc(start,body)['speedLongitude']
 for d in range(1,367):
  now=start+d;nv=calc(now,body)['speedLongitude']
  if v*nv<0:
   jd=root(lambda t:calc(t,body)['speedLongitude'],last,now)
   for minutes in [-60,-10,10,60]:
    t=jd+minutes/1440
    out['stations'].append({'body':name,'station':iso(jd),'offsetMinutes':minutes,'iso':iso(t),'reference':calc(t,body)})
  last=now;v=nv
OUT.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')))
print(json.dumps({k:len(v) for k,v in out.items() if isinstance(v,list)}));print(OUT)
