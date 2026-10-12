#!/bin/bash
# Usage: layout_check.sh <url-without-query> [extra query]
# Runs the ?check=1 text-overlap/cut test at phone, tablet, desktop (+ phone drawer open).
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
URL="$1"; EXTRA="${2:-}"
OUT=/private/tmp/claude-501/-Volumes-AKARA-SSD-projects-akara-aws-deploy/39e8e02b-fd57-4669-aa8a-34393d4d1aa5/scratchpad
fail=0
for spec in "375,2400,phone," "768,2600,tablet," "1440,2600,desktop," "375,900,phone-drawer-open,&rail=1" "375,2400,phone-indigo,&theme=indigo"; do
  IFS=, read W H NAME Q <<< "$spec"
  # --virtual-time-budget lets the data load and the check run before the DOM is dumped.
  # Mobile-width runs need a mobile UA for matchMedia-independent bits; viewport width drives the CSS.
  PAGE="$URL?check=1$Q$EXTRA&r=$RANDOM"; SHOTPAGE="$URL?r=$RANDOM$Q$EXTRA"; WW=$W
  if [ "$W" -lt 500 ]; then
    ENC=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$PAGE")
    ENC2=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1],safe=''))" "$SHOTPAGE")
    HARN="https://www.akara.studio/akara/mock/harness.html"; PAGE="$HARN?w=$W&h=$H&src=$ENC"; SHOTPAGE="$HARN?w=$W&h=$H&src=$ENC2"; WW=500
  fi
  "$C" --headless=new --disable-gpu --hide-scrollbars --window-size=$WW,$H --virtual-time-budget=25000 \
    --dump-dom "$PAGE" 2>/dev/null > "$OUT/dom_$NAME.html"
  RES=$(python3 - "$OUT/dom_$NAME.html" <<'EOF'
import sys,re,json,html
s=open(sys.argv[1]).read()
m=re.search(r'<pre id="layout-check"[^>]*>(.*?)</pre>',s,re.S)
if not m: print("NO RESULT (page did not finish)"); sys.exit()
d=json.loads(html.unescape(m.group(1)))
p=d['problems']
print(f"{len(p)} problems / {d['textBoxes']} text boxes @ {d['width']}px")
for x in p[:12]: print("   ",json.dumps(x,ensure_ascii=False))
EOF
)
  echo "$NAME: $RES"
  echo "$RES" | grep -q "^0 problems" || fail=1
  "$C" --headless=new --disable-gpu --hide-scrollbars --window-size=$WW,$H --virtual-time-budget=20000 \
    --screenshot="$OUT/shot_$NAME.png" "$SHOTPAGE" 2>/dev/null
done
exit $fail
