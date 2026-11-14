# assets/ 의 CSS·JS를 고친 뒤 실행: 모든 HTML의 ?v= 버전을 지금 시각으로 바꿔서
# 브라우저가 예전 파일(GitHub Pages 10분 캐시)을 쓰지 않게 함.
# 사용법: python -X utf8 tools/bump.py
import glob, os, re, time

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = time.strftime("%Y%m%d%H%M")
n = 0
for f in glob.glob(os.path.join(root, "*.html")):
    h = open(f, encoding="utf-8").read()
    h2 = re.sub(r'((?:href|src)="assets/[\w.-]+\.(?:css|js))(\?v=\w+)?"', lambda m: f'{m.group(1)}?v={v}"', h)
    if h2 != h:
        open(f, "w", encoding="utf-8").write(h2)
        n += 1
print(f"version {v} → {n} files")
