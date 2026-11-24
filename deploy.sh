#!/usr/bin/env bash
# smart-biz-calc 배포 스크립트
# 사용법: bash deploy.sh [owner/repo]
#   기본값: k77070888-netizen/smart-biz-calc
set -euo pipefail

REPO="${1:-k77070888-netizen/smart-biz-calc}"
BRANCH="main"
cd "$(dirname "$0")"

echo "▶ 대상 저장소: $REPO"

# 1) 원격 확인 / 설정
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "https://github.com/${REPO}.git"
else
  git remote add origin "https://github.com/${REPO}.git"
fi

# 2) 푸시
git add -A
if ! git diff --cached --quiet; then
  git commit -m "배포: $(date +%Y-%m-%d\ %H:%M)"
fi
git push -u origin "$BRANCH"

# 3) GitHub Pages 활성화 (이미 켜져 있으면 갱신)
echo "▶ GitHub Pages 활성화 시도"
if gh api "repos/${REPO}/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/${REPO}/pages" -f "source[branch]=${BRANCH}" -f "source[path]=/" >/dev/null && echo "  · 기존 Pages 설정 갱신"
else
  gh api -X POST "repos/${REPO}/pages" -f "source[branch]=${BRANCH}" -f "source[path]=/" >/dev/null 2>&1 \
    && echo "  · Pages 활성화 완료" \
    || echo "  ! Pages API 권한 없음 — 저장소 Settings → Pages 에서 main / (root) 를 선택해 주세요."
fi

# 4) 라이브 URL 확인 (최대 5분 폴링)
URL="https://$(echo "$REPO" | cut -d/ -f1 | tr '[:upper:]' '[:lower:]').github.io/$(echo "$REPO" | cut -d/ -f2)/"
echo "▶ 라이브 확인: $URL"
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)
  echo "  [$i/30] HTTP $code"
  [ "$code" = "200" ] && { echo "✅ 배포 완료: $URL"; exit 0; }
  sleep 10
done
echo "⚠ 5분 내 200 응답 없음 — Actions/Pages 빌드 상태를 확인하세요: https://github.com/${REPO}/actions"
exit 1
