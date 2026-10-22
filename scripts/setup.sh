#!/usr/bin/env bash
# Installs Kokoro TTS into its own virtualenv and downloads the model (~350 MB).
set -euo pipefail

DIR="${CLAUDE_VOICE_HOME:-$HOME/.local/share/claude-voice}"
MODEL_URL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"

mkdir -p "$DIR/voices"
if [ ! -x "$DIR/venv/bin/python" ]; then
  python3 -m venv "$DIR/venv"
fi
"$DIR/venv/bin/pip" install -q --disable-pip-version-check kokoro-onnx soundfile

for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  if [ ! -s "$DIR/voices/$f" ]; then
    curl -fsSL -o "$DIR/voices/$f.part" "$MODEL_URL/$f"
    mv "$DIR/voices/$f.part" "$DIR/voices/$f"
  fi
done

echo "Kokoro is ready in $DIR"
