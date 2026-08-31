#!/bin/sh
set -eu

base=/home/chtne/.pptbench-deploy-20260830-1806
stage="$base/site"
archive="$base/dist.tar"
root=/home/chtne/pptbench-showcase
backup=/home/chtne/pptbench-showcase.backup-20260830-1806

test -f "$archive"
test -d "$stage"
tar -xf "$archive" -C "$stage"
test -f "$stage/pptbench/index.html"
test -f "$stage/pptbench/leaderboard/index.html"

cp "$stage/pptbench/index.html" "$stage/index.html"
mkdir -p "$stage/leaderboard"
cp "$stage/pptbench/leaderboard/index.html" "$stage/leaderboard/index.html"
sed -i 's|href="/pptbench/leaderboard/"|href="/leaderboard/"|g' "$stage/index.html" "$stage/pptbench/index.html"

test ! -e "$backup"
grep -q 'Key findings' "$stage/index.html"
! grep -q 'mailto:nana@einsia.ai' "$stage/index.html"
test -f "$stage/_astro/index.UBk8lpWb.css"

chmod -R u+rwX,go+rX,go-w "$stage"
mv "$root" "$backup"
mv "$stage" "$root"

test -f "$root/index.html"
test -f "$root/leaderboard/index.html"
grep -q 'Key findings' "$root/index.html"
! grep -q 'mailto:nana@einsia.ai' "$root/index.html"
grep -q 'href="/leaderboard/"' "$root/index.html"
printf 'DEPLOYED_ROOT=%s\nBACKUP=%s\n' "$root" "$backup"
