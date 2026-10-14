#!/bin/bash
# Deploy changed files of the live site, then prove they are live.
#
#   scripts/ship.sh frontend/public/akara/lib.jsx frontend/public/darshan.html
#   scripts/ship.sh --dry-run <files...>     show the plan, upload nothing
#   scripts/ship.sh --verify  <files...>     only compare live bytes to local
#
# A .jsx in the list is compiled first and its public/akara/js/*.js is shipped with it
# (browsers load the .js; the .jsx stays live for old pages still on Babel).
#
# Each file path must sit under frontend/public/; its S3 key is the path below that.
# Steps: check.sh -> back up the live object -> upload with the live object's own
# Content-Type/Cache-Control -> one CloudFront invalidation -> wait -> curl each URL
# and compare its sha256 to the local file. Exit 1 if any byte differs.
set -euo pipefail
cd "$(dirname "$0")/.."

BUCKET=akara-frontend-738983679688-us-east-1
DIST=EBWBTLYBASPTD
SITE=https://www.akara.studio
MODE=ship
case "${1:-}" in --dry-run) MODE=dry; shift ;; --verify) MODE=verify; shift ;; esac
[ $# -gt 0 ] || { sed -n '2,12p' "$0"; exit 2; }

[ "$MODE" = verify ] || node scripts/build-jsx.mjs 2>/dev/null
files=()
for f in "$@"; do
  files+=("$f")
  case "$f" in frontend/public/akara/*.jsx) b=${f##*/}; files+=("frontend/public/akara/js/${b%.jsx}.js") ;; esac
done
IFS=$'\n' read -r -d '' -a files < <(printf '%s\n' "${files[@]}" | awk '!seen[$0]++' && printf '\0')
keys=()
for f in "${files[@]}"; do
  [ -f "$f" ] || { echo "no such file: $f"; exit 2; }
  case "$f" in frontend/public/*) ;; *) echo "refused: $f is not under frontend/public/"; exit 2 ;; esac
  key=${f#frontend/public/}
  # The prerendered root index.html is a Next build output; patching it blanks the site.
  [ "$key" = index.html ] && { echo "refused: root index.html is a build output (see memory: never patch prerendered index)"; exit 2; }
  keys+=("$key")
done

sha() { shasum -a 256 | cut -c1-64; }

verify() {
  local bad=0
  for i in "${!keys[@]}"; do
    local key=${keys[$i]}
    local want got
    want=$(sha < "frontend/public/$key")
    got=$(curl -fsS "$SITE/$key?v=$(date +%s)" | sha) || got=fetch-failed
    if [ "$want" = "$got" ]; then echo "LIVE  $SITE/$key"; else echo "STALE $SITE/$key"; bad=1; fi
  done
  return $bad
}

if [ "$MODE" = verify ]; then verify .; exit $?; fi

./scripts/check.sh

backup="../_backup_ship_$(date +%Y-%m-%d_%H%M%S)"
for key in "${keys[@]}"; do
  meta=$(aws s3api head-object --bucket "$BUCKET" --key "$key" \
           --query '[ContentType,CacheControl]' --output text 2>/dev/null || echo "NEW")
  if [ "$meta" = NEW ]; then
    case "$key" in
      *.html) ctype="text/html; charset=utf-8"; cache="no-cache" ;;
      akara/vendor/*.js) ctype="text/javascript; charset=utf-8"; cache="public, max-age=31536000, immutable" ;;
      *.js) ctype="text/javascript; charset=utf-8"; cache="public, max-age=300" ;;
      *.json|*.xml) ctype=$([ "${key##*.}" = json ] && echo application/json || echo application/xml); cache="no-cache" ;;
      *) ctype="binary/octet-stream"; cache="public, max-age=300" ;;
    esac
  else
    ctype=$(cut -f1 <<<"$meta"); cache=$(cut -f2 <<<"$meta")
    # No Cache-Control on the live object: pages must revalidate, everything else 5 min.
    if [ "$cache" = None ]; then case "$key" in *.html) cache="no-cache" ;; *) cache="public, max-age=300" ;; esac; fi
  fi
  echo "$MODE  s3://$BUCKET/$key  [$ctype | $cache]$([ "$meta" = NEW ] && echo '  (new object)')"
  [ "$MODE" = dry ] && continue
  if [ "$meta" != NEW ]; then
    mkdir -p "$backup/$(dirname "$key")"
    aws s3 cp "s3://$BUCKET/$key" "$backup/$key" --only-show-errors
  fi
  aws s3 cp "frontend/public/$key" "s3://$BUCKET/$key" \
    --content-type "$ctype" --cache-control "$cache" --only-show-errors
done
[ "$MODE" = dry ] && exit 0
[ -d "$backup" ] && echo "backup of old live files: $backup"

paths=(); for key in "${keys[@]}"; do paths+=("/$key"); done
inv=$(aws cloudfront create-invalidation --distribution-id "$DIST" --paths "${paths[@]}" \
        --query Invalidation.Id --output text)
echo "invalidation $inv, waiting..."
aws cloudfront wait invalidation-completed --distribution-id "$DIST" --id "$inv"
verify .
