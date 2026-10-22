# voice-summary

A Claude Code mod for English listening practice. Claude ends each reply with a short `🔊 English` summary in plain English, and the mod reads that summary aloud with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx), a small local text-to-speech model that sounds natural and runs on the CPU. Nothing is sent to an online service.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install voice-summary --marketplace stariver2000/claude-voice-summary
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

From a shell:

```
claude plugin install voice-summary --marketplace stariver2000/claude-voice-summary
```

In the Claude desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `stariver2000/claude-voice-summary`, then Add plugin.

## Setup

After installing the mod, run this once in Claude Code. It creates a Python virtualenv in `~/.local/share/claude-voice` and downloads the model (about 350 MB):

```
/voice setup
```

Requirements: Python 3.10+, `curl`, and an audio player (`paplay`, `pw-play`, `aplay` or `ffplay` on Linux; `afplay` on macOS). Set `CLAUDE_VOICE_HOME` to install somewhere else.

## Usage

| Command | What it does |
| --- | --- |
| `/voice` | Show the current settings |
| `/voice on`, `/voice off` | Turn the spoken summary on or off |
| `/voice voice <name>` | Pick a voice and hear a sample |
| `/voice speed <0.5-2>` | Set the speaking speed and hear a sample (default 1.05) |
| `/voice list` | List the voices |
| `/voice test` | Hear the current voice |

Voices start with `a` (American) or `b` (British), then `f` (female) or `m` (male): `af_heart` (default), `af_bella`, `am_michael`, `bf_emma`, `bm_george` and more.

A new reply stops the summary that is still playing.
