#!/bin/sh
# pnpm deploy:pages → build the static landing page and publish it to the gh-pages branch.
#
# GitHub Pages serves that branch at https://<user>.github.io/<repo>/. The branch
# holds only build output and is overwritten on every deploy; main is never touched.
set -eu
cd "$(dirname "$0")/.."

REMOTE_URL=$(git remote get-url origin)
NAME=$(git config user.name)
EMAIL=$(git config user.email)
SHA=$(git rev-parse --short HEAD)

rm -rf out
pnpm build:pages
# The preview has no service worker, so the PWA files copied from public/ are dead weight.
rm -f out/sw.js out/offline.html
touch out/.nojekyll

TMP=$(mktemp -d)
cp -R out/. "$TMP"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c "user.name=$NAME" -c "user.email=$EMAIL" commit -q -m "Deploy landing preview from $SHA"
git push -f "$REMOTE_URL" gh-pages
rm -rf "$TMP"
echo "Published. Pages usually updates within a minute."
