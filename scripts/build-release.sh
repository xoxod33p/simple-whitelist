#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> [1/3] Building Paper plugin with Maven..."
cd "$ROOT_DIR/plugin"
mvn clean package --no-transfer-progress

JAR_PATH="$ROOT_DIR/plugin/target/SimpleWhitelist.jar"
if [[ ! -f "$JAR_PATH" ]]; then
  echo "Error: SimpleWhitelist.jar not found!" >&2
  exit 1
fi

DIST_DIR="$ROOT_DIR/dist"
mkdir -p "$DIST_DIR"

echo "==> [2/3] Copying plugin jar..."
cp "$JAR_PATH" "$DIST_DIR/SimpleWhitelist.jar"

echo "==> [3/3] Packaging webapp bundle..."
cd "$ROOT_DIR/webapp"
zip -r "$DIST_DIR/webapp-dist.zip" package.json server.js public/ -x "*.DS_Store"

echo "==> Generating checksums..."
cd "$DIST_DIR"
sha256sum SimpleWhitelist.jar > SimpleWhitelist.jar.sha256
sha256sum webapp-dist.zip > webapp-dist.zip.sha256

echo ""
echo "Release build complete! Assets located in: $DIST_DIR"
ls -la "$DIST_DIR"
