#!/usr/bin/env bash
# Copy docs/wiki into the GitHub wiki repository and commit. Push it yourself afterwards.
# The wiki must exist first: open the Wiki tab on GitHub and save a first page once.
set -euo pipefail

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
wiki_dir="${WIKI_DIR:-$repo_root/../Authors-Toolbox.wiki}"
wiki_url="${WIKI_URL:-https://github.com/danielroa98/Authors-Toolbox.wiki.git}"

if [ ! -d "$wiki_dir/.git" ]; then
  git clone "$wiki_url" "$wiki_dir"
else
  git -C "$wiki_dir" pull --ff-only
fi

# pages and images; README.md only describes the folder in the main repository
find "$wiki_dir" -maxdepth 1 -name '*.md' -delete
rm -rf "$wiki_dir/images"
cp "$repo_root"/docs/wiki/*.md "$wiki_dir"/
rm -f "$wiki_dir/README.md"
cp -R "$repo_root/docs/wiki/images" "$wiki_dir/images"

cd "$wiki_dir"
git add -A
if git diff --cached --quiet; then
  echo "The wiki is already up to date."
else
  version=$(node -p "require('$repo_root/manifest.json').version" 2>/dev/null || echo "")
  git commit -q -m "Update wiki${version:+ for $version}"
  echo "Committed. Push with: git -C \"$wiki_dir\" push"
fi
