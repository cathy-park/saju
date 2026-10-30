import json,swisseph as swe,pathlib
swe.set_ephe_path('/tmp/saju-swiss-data')
reference=json.loads(pathlib.Path('/tmp/saju-independent-swiss-oracles.json').read_text())
rows=[]
for x in reference['eot']:
 for hour in [0,6,12,18,23+59/60]:
  jd=swe.julday(x['year'],x['month'],x['day'],hour-9)
  rows.append({'year':x['year'],'month':x['month'],'day':x['day'],'kstHour':hour,'referenceMinutes':swe.time_equ(jd)*1440})
pathlib.Path('/tmp/saju-independent-eot-intraday.json').write_text(json.dumps(rows))
print('Generated',len(rows),'actual-instant EOT references')
