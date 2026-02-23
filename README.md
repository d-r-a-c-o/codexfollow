# Follower Clash Daily

A minimal browser game for daily follower battles built to be easy to record.

## What changed
- Uses real 3D rendering (WebGL with Three.js).
- Followers are now **beyblades** fighting inside an **inverse bowl arena**.
- Elimination happens by:
  - getting hit too much and exploding, or
  - getting knocked out over the bowl lip (ring-out).
- Usernames + health bars remain visible during battle.
- Setup panel hides during battle for clean recording.

## Features
- Paste real follower usernames (or import txt/csv).
- 2 or 3 teams.
- 2 or 3 in-match events only.
- One-click start flow for recording.
- Basic synthesized SFX (no external assets required).

## Run

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

> Note: this version imports Three.js from a CDN, so internet access is required when loading the page.
