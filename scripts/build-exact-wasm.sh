#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CRATE_DIR="$ROOT_DIR/native/cut_buddy_exact_wasm"
OUT_DIR="$ROOT_DIR/scripts/wasm"
OUT_FILE="$OUT_DIR/cut_buddy_exact_wasm.wasm"

RUSTUP_TOOLCHAIN_BIN="/Users/brendan/.rustup/toolchains/stable-aarch64-apple-darwin/bin"
CARGO_CMD=("cargo")
RUSTC_CMD=()

if [ -x "$RUSTUP_TOOLCHAIN_BIN/cargo" ] && [ -x "$RUSTUP_TOOLCHAIN_BIN/rustc" ]; then
  CARGO_CMD=("$RUSTUP_TOOLCHAIN_BIN/cargo")
  RUSTC_CMD=("$RUSTUP_TOOLCHAIN_BIN/rustc")
elif [ -x "/opt/homebrew/opt/rustup/bin/rustup" ]; then
  CARGO_CMD=("/opt/homebrew/opt/rustup/bin/rustup" "run" "stable" "cargo")
elif ! command -v cargo >/dev/null 2>&1; then
  echo "cargo is required to build the WASM solver." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

if [ "${#RUSTC_CMD[@]}" -gt 0 ]; then
  RUSTC="${RUSTC_CMD[0]}" "${CARGO_CMD[@]}" build \
    --manifest-path "$CRATE_DIR/Cargo.toml" \
    --target wasm32-unknown-unknown \
    --release
else
  "${CARGO_CMD[@]}" build \
  --manifest-path "$CRATE_DIR/Cargo.toml" \
  --target wasm32-unknown-unknown \
  --release
fi

cp "$CRATE_DIR/target/wasm32-unknown-unknown/release/cut_buddy_exact_wasm.wasm" "$OUT_FILE"

echo "Built $OUT_FILE"
