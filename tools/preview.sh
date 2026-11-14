#!/bin/bash
# 가짜 DB(tools/fake-supabase.js)로 사이트를 띄워 스크린샷을 찍음 (Windows + Edge)
# 사용법: bash tools/preview.sh [페이지 ...]     예) bash tools/preview.sh index.html jobs.html
#   - 휴대폰(390px) 화면을 나란히 찍은 phones.png, 각 페이지 PC(1440px) 화면 desk-<이름>.png
#   - 결과 폴더: %TEMP%/site-preview/shots
SITE="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${TEMP:-/tmp}/site-preview"; P="$OUT/site"; S="$OUT/shots"
rm -rf "$P" 2>/dev/null; mkdir -p "$P" "$S"
cp -r "$SITE"/*.html "$SITE/assets" "$P/"; cp "$SITE/tools/fake-supabase.js" "$P/assets/"
PAGES=("$@"); [ ${#PAGES[@]} -eq 0 ] && PAGES=(index.html jobs.html resources.html)
python -X utf8 - "$P" "${PAGES[@]}" <<'PY'
import sys, glob, os
P, pages = sys.argv[1], sys.argv[2:]
for f in glob.glob(os.path.join(P, "*.html")):
    s = open(f, encoding="utf-8").read()
    s = s.replace("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js", "assets/fake-supabase.js")
    s = s.replace("</head>", "<style>.js [data-reveal]{opacity:1!important;transform:none!important}</style></head>")
    open(f, "w", encoding="utf-8").write(s)
frames = "".join(f'<iframe src="{p}" style="width:390px;height:1900px;border:0;background:#fff"></iframe>' for p in pages)
open(os.path.join(P, "_phones.html"), "w").write('<!doctype html><body style="margin:0;background:#888;display:flex;gap:16px;padding:16px">' + frames + "</body>")
PY
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
PORT=$((8850 + RANDOM % 100))
cd "$P"; python -m http.server $PORT >/dev/null 2>&1 & SRV=$!; sleep 1
shot(){ "$EDGE" --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$OUT/edge-$RANDOM" --window-size=$2 --virtual-time-budget=9000 --screenshot="$S/$1.png" "http://localhost:$PORT/$3" >/dev/null 2>&1; }
W=$(( ${#PAGES[@]} * 406 + 26 ))
shot phones "$W,1932" _phones.html
for p in "${PAGES[@]}"; do shot "desk-${p%.html}" 1440,1600 "$p"; done
kill $SRV
echo "screenshots: $S"
