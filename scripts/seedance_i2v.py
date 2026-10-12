import base64,json,sys,time,urllib.request,pathlib
K=[l.split("=",1)[1].strip().strip('"') for l in open("/Volumes/AKARA SSD/projects/AKARA MANTRA APP/Scripts/byteplus/secrets.env") if l.startswith("ARK_API_KEY=")][0]
B="https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks"
img,out,prompt=sys.argv[1],sys.argv[2]," ".join(sys.argv[3:])
b64=base64.b64encode(open(img,"rb").read()).decode()
body={"model":"seedance-1-5-pro-251215","content":[{"type":"text","text":prompt+" --resolution 1080p --duration 5 --camerafixed true --watermark false"},{"type":"image_url","image_url":{"url":"data:image/png;base64,"+b64}}]}
req=urllib.request.Request(B,data=json.dumps(body).encode(),headers={"Authorization":"Bearer "+K,"Content-Type":"application/json"})
try: d=json.load(urllib.request.urlopen(req,timeout=120))
except urllib.error.HTTPError as e: print("HTTP",e.code,e.read()[:500]); sys.exit(1)
tid=d["id"]; print("task",tid,flush=True)
while True:
    time.sleep(15)
    s=json.load(urllib.request.urlopen(urllib.request.Request(B+"/"+tid,headers={"Authorization":"Bearer "+K})))
    print(s.get("status"),flush=True)
    if s.get("status")=="succeeded":
        url=s["content"]["video_url"]; pathlib.Path(out).write_bytes(urllib.request.urlopen(url).read()); print("saved",out,s.get("usage")); break
    if s.get("status") in ("failed","cancelled","expired"): print(json.dumps(s)[:800]); sys.exit(1)
