# Darśana preview proxy: local /akara/darshan/* assets from disk, everything else from live akara.studio.
import http.server, urllib.request, os, sys, time
LOCAL = "/Volumes/AKARA SSD/projects/akara-aws-deploy/akara/frontend/public"
LIVE = "https://www.akara.studio"
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        path = self.path.split("?")[0]
        local = os.path.join(LOCAL, path.lstrip("/"))
        if path.startswith("/akara/darshan/") and not path.endswith(".json") and os.path.isfile(local):

            data = open(local, "rb").read()
            self.send_response(200); self.send_header("Content-Type", {".js":"text/javascript",".css":"text/css",".webp":"image/webp",".mp4":"video/mp4"}.get(os.path.splitext(path)[1],"application/octet-stream")); self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data); return
        try:
            req = urllib.request.Request(LIVE + self.path, headers={"User-Agent": "akara-preview"})
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read(); ct = r.headers.get("Content-Type", "application/octet-stream")
                self.send_response(200); self.send_header("Content-Type", ct); self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
        except urllib.error.HTTPError as e:
            data = e.read(); self.send_response(e.code); self.send_header("Content-Type", e.headers.get("Content-Type", "text/plain"))
            self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
