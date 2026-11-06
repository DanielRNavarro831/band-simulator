# Band Simulator

An 8-bit band management sim for mobile browsers. It's plain HTML5/JavaScript with no build step.

## Run it

Browsers block scripts on `file://` pages, so serve the folder:

```bash
python -m http.server 8123
```

Then open http://localhost:8123.

To play on your phone, connect it to the same Wi-Fi and open `http://<your-PC's-IP>:8123`.

## Files

| File | What's in it |
|---|---|
| `DESIGN.md` | Game design, formulas and the decisions log |
| `js/data.js` | **All tuning numbers**: costs, prices, cities, critics, traits |
| `js/rng.js` | Dice helpers |
| `js/game.js` | Simulation: weekly tick, albums and critic scoring, shows, tours, events, payday, save/load |
| `js/render.js` | 160×120 pixel-art canvas (rehearsal room, stage, sprites) |
| `js/ui.js` | HUD, menus and modals |
| `js/main.js` | Title screen and game loop |

The game autosaves to the browser's localStorage every week.
