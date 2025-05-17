#!/usr/bin/env sh

set -e

rm -r dist
yarn tsc -b .
npx esbuild src/openslide.ts \
    --bundle \
    --platform=browser \
    --outfile=dist/openslide.js \
    --format=esm
cp src/lib.wasm dist/lib.wasm

# Copy src/lib.wasm.map to dist/lib.wasm.map if it exists
if [ -f src/lib.wasm.map ]; then
    cp src/lib.wasm.map dist/lib.wasm.map
fi