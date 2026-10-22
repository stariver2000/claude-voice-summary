"""Speak text from stdin with Kokoro TTS, detached so the caller returns at once.

    speak.py --voice af_heart --speed 1.05 < text

A new call stops the one still playing.
"""
import argparse
import os
import shutil
import signal
import subprocess
import sys

DATA_DIR = os.environ.get("CLAUDE_VOICE_HOME", os.path.expanduser("~/.local/share/claude-voice"))
CACHE_DIR = os.path.expanduser("~/.cache/claude-voice")
PID_FILE = os.path.join(CACHE_DIR, "speak.pid")
WAV_FILE = os.path.join(CACHE_DIR, "speak.wav")
# Silence played before the speech: an idle (suspended) Bluetooth or HDMI output
# takes a moment to wake and drops whatever plays first.
LEAD_IN_SECONDS = float(os.environ.get("CLAUDE_VOICE_LEAD_IN", "0.8"))
PLAYERS = (["paplay"], ["pw-play"], ["aplay", "-q"], ["afplay"], ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet"])


def stop_previous():
    try:
        with open(PID_FILE) as f:
            os.killpg(int(f.read()), signal.SIGTERM)
    except (OSError, ValueError):
        pass


def play(path):
    for player in PLAYERS:
        if shutil.which(player[0]):
            subprocess.run([*player, path], check=False)
            return


def synthesize_and_play(text, voice, speed):
    import numpy as np
    import soundfile as sf
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(f"{DATA_DIR}/voices/kokoro-v1.0.onnx", f"{DATA_DIR}/voices/voices-v1.0.bin")
    lang = "en-gb" if voice.startswith("b") else "en-us"
    samples, rate = kokoro.create(text, voice=voice, speed=speed, lang=lang)
    lead_in = np.zeros(int(rate * LEAD_IN_SECONDS), dtype=samples.dtype)
    sf.write(WAV_FILE, np.concatenate([lead_in, samples]), rate)
    play(WAV_FILE)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default="af_heart")
    parser.add_argument("--speed", type=float, default=1.05)
    parser.add_argument("--child", action="store_true")
    args = parser.parse_args()
    text = sys.stdin.read().strip()
    if not text:
        return

    if args.child:
        synthesize_and_play(text, args.voice, args.speed)
        return

    os.makedirs(CACHE_DIR, exist_ok=True)
    stop_previous()
    proc = subprocess.Popen(
        [sys.executable, __file__, "--child", "--voice", args.voice, "--speed", str(args.speed)],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        start_new_session=True, text=True,
    )
    proc.stdin.write(text)
    proc.stdin.close()
    with open(PID_FILE, "w") as f:
        f.write(str(proc.pid))


if __name__ == "__main__":
    main()
