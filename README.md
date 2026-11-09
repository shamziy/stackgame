# Tower Stack 3D

A browser stacking game built with Three.js. Slabs swing across the tower; drop each one so it lines up with the slab below. Whatever overhangs is sliced off and falls away, so the tower gets narrower with every sloppy drop.

## Features

- Perfect drops (within 0.08) flash a ripple, and three in a row grow the slab back
- Live best score: the Best chip updates the moment you pass it, with a "New best!" toast, and it is saved in the browser
- The sky shifts from dusk to deep space with a twinkling starfield as the tower climbs
- Synth sound effects (Web Audio) with a pentatonic chime that rises with your perfect streak, plus a mute toggle
- Speed ramps up with your score

## Run it

Double-click `index.html`, or serve the folder (`python3 -m http.server 8000`, then open http://localhost:8000). It uses plain script tags rather than ES modules, so no server is required. Three.js r128 loads from cdnjs, so you need an internet connection.

## Controls

Tap, click or press Space.

## Structure

- index.html: page and script tags (Three.js r128 from cdnjs)
- style.css: HUD, toast and overlay
- src/scene.js: renderer, orthographic camera, lights
- src/game.js: stacking rules, cutting, falling pieces, perfect-drop ripple
- src/audio.js: Web Audio sound effects
- src/main.js: input, HUD, best score, sky and stars, camera follow, render loop
