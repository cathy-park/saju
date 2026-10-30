#!/usr/bin/env python3
"""Fetch only public oracle data. No production requests or credentials."""
import pathlib,urllib.request,urllib.parse,hashlib,json
root=pathlib.Path('/tmp/saju-swiss-data');root.mkdir(exist_ok=True)
expected={'sepl_18.se1':'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66','semo_18.se1':'1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7'}
provenance=[]
for name,digest in expected.items():
 url='https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/'+name
 data=urllib.request.urlopen(url,timeout=45).read()
 if hashlib.sha256(data).hexdigest()!=digest:raise RuntimeError('Reference data changed; review rather than silently rebaseline: '+name)
 (root/name).write_bytes(data);provenance.append({'url':url,'file':name,'bytes':len(data),'sha256':digest})
(root/'provenance.json').write_text(json.dumps(provenance,indent=2))
results=[]
for body in ['10','301','199']:
 p={'format':'json','COMMAND':"'"+body+"'",'CENTER':"'500@399'",'EPHEM_TYPE':"'OBSERVER'",'TLIST':"'2451545.0,2460389.5'",'QUANTITIES':"'31'",'CSV_FORMAT':"'YES'",'OBJ_DATA':"'NO'",'CAL_FORMAT':"'JD'",'ANG_FORMAT':"'DEG'",'EXTRA_PREC':"'YES'"}
 url='https://ssd.jpl.nasa.gov/api/horizons.api?'+urllib.parse.urlencode(p)
 data=json.load(urllib.request.urlopen(url,timeout=45))
 if 'error' in data:raise RuntimeError(data['error'])
 results.append({'body':body,'url':url,'data':data})
pathlib.Path('/tmp/saju-horizons-reference.json').write_text(json.dumps(results))
print('Fetched and hash-checked Swiss data; fetched 6 NASA synthetic ephemeris rows')
