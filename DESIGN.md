# Band Simulator — Design Doc (v0.1)

This doc takes your original pitch and fills in the gaps: numbers, formulas, and edge cases.
Anything marked **[DECIDE]** is a call I made that you may want to change.

---

## 1. Core Loop

```
Hire / train members ─► Write album ─► Release album (critics score it) ─► Gain fans in cities
        ▲                                                                        │
        │                                                                        ▼
 Spend money on gear,  ◄──── Earn money (album sales, tickets, merch) ◄──── Tour / play shows
 lessons, merch, travel
        │
        ▼
 End of year: pay salaries, or members leave. Nobody left = Game Over.
```

## 2. Time

- The game clock runs in **weeks**: 4 weeks per month, 12 months per year (48 weeks per year).
- **Decided:** time auto-advances Kairosoft-style (1 week ≈ 2.5 seconds at 1x), with pause / 1x / 2x / 4x. Opening any menu pauses the clock.
- Actions take time:

| Action | Duration |
|---|---|
| Write an album | 1 week per song (5–12 weeks) |
| Lessons | 1 week each |
| Single local show | 1 week |
| Tour | 1 week per city |
| Vacation | 2 weeks |
| Recruiting search | Word of mouth: 2 weeks, ad: 1 week, recruiter: instant |

## 3. Money (starting values) **[DECIDE]**

- Starting cash: **$1,500**
- Each member has a **yearly salary**: `base $400 + $60 × (sum of their stats)`. Better members cost more.
- At the end of the year, salaries are due all at once. If you can't pay everyone, you choose who gets paid. Unpaid members leave.
- If no members are left, the band fails and it's **Game Over**.

## 4. Band Members

### Stats

All stats except Stamina use a **1–10 level** with hidden XP underneath. Stamina is a 0–100 meter.

| Stat | Range | Gained from |
|---|---|---|
| Instrument (per instrument) | 0–10 | Lessons, shows |
| Music Theory | 1–10 | Lessons, writing albums |
| Performance | 1–10 | Shows only |
| Stamina | 0–100 meter | Rest, vacations |

- XP needed for the next level: `100 × current level`. Leveling slows down as stats get higher.
- Each member keeps a **dictionary of instrument levels**. Switching to an instrument they've never played sets it to 0. Their other instrument levels are kept.

### Gap: "Creativity"

Your critic formula mentions a *creativity* score, but creativity isn't one of the 4 stats. Two options:

- **(A)** Make **Creativity** a 5th stat. Gained from writing albums and from vacations ("inspiration"). Easy to understand.
- **(B)** Derive creativity from genre fit, a hidden personality trait, and a dice roll. Keeps 4 stats.

**Decided: (A)** — Creativity is a 5th stat (1–10).

### Genres (each member specializes in 1, assigned at random)

Rock, Punk, Metal, Pop, Hip-Hop, Jazz, Electronic, Folk, Country, Indie, R&B, Reggae

- Every year, 2 genres are **"Trending"** (+15% fan gain) and 1 is **"Stale"** (−10%). This gives players a reason to experiment.

### Instruments

Guitar, Bass, Drums, Vocals, Keys, Synth, Turntables, Sax, Violin

### Personality trait (1 per member, random, hidden until hired)

| Trait | Effect |
|---|---|
| Workaholic | Stamina drains 25% slower |
| Diva | Performance +1 on stage, more frequent requests |
| Prodigy | +50% XP |
| Gearhead | Gear wears half as fast and plays one tier higher |
| Steady | Smaller random swings (narrower dice) |
| Wildcard | Bigger random swings (wider dice) |

### Requests and Stamina

- Every ~8–16 weeks, a member may make a **request**: "I want to try Sax," "Let's make a Metal album," or "I need a break."
- If you honor it, they gain +15 Stamina. If you ignore it for 8 weeks, they lose −20 Stamina.
- Stamina affects the band:
  - **Below 30:** stat penalties during shows.
  - **0:** 50% chance per week that the member quits.
- Recovery:
  - Idle weeks: +5 per week.
  - Vacation: costs money, restores +60, and also gives +1 Creativity XP burst.

## 5. Recruiting

| Method | Cost | Candidates | Stat range |
|---|---|---|---|
| Word of mouth | Free | 2 | 1–4 |
| Ad | $250 | 4 | 2–6 |
| Talent recruiter | $1,200 | 3 | 4–8, with a 10% chance of a "star" (6–9) |

- Each candidate shows their stats, genre, known instruments, and salary. Their trait stays hidden until you hire them.
- **Firing penalty:** you lose `2% × (albums the member appeared on)` of total fans, capped at 20%.
- Hiring a high-stat member can give a small fan bump ("New lineup!").

## 6. Albums

1. **Start writing:** pick a genre and a working title.
2. **Song count:** `5 + floor(avgStamina / 100 × 7)`, giving 5–12 songs. Writing also drains stamina.
3. While writing, each week adds points to three hidden pools from each member: **Theory, Creativity, Musicianship**. Each weekly contribution is rolled, so it varies.
4. **Release format:**

| Format | Cost | Price per unit | Notes |
|---|---|---|---|
| Online | $0 | $0 | Fans ×1.2, no income |
| CD | $300 | $10 | Sold at release and at shows |
| CD + DVD | $650 | $18 | +25% sales at shows where performance score is ≥ 700 |
| CD + Cassette + Vinyl | $1,400 | $35 | Only "die-hard" fans buy (≈ 15% of fans) but at high margin |

## 7. Scoring and RNG (the important part)

**Goal:** scores should almost never repeat exactly. Here's how:

1. **Wide scales.** Critics score from **0–100** (not 1–10). Show scores range from **0–1000**. There are far more possible outcomes.
2. **Several dice instead of one.** Variance comes from summing several dice, like `3d20`. That produces a bell curve: most results land near the middle, with occasional extremes. Results are fair but never identical.
3. **Each critic has their own personality and dice.** Four critics, four different weightings, four independent rolls.
4. **Rare "moments."** A 4% chance of a *Breakout / Masterpiece* (+15 to +25). A 4% chance of a *Trainwreck / Panned* (−15 to −25). These create stories.
5. **Repeat breaker.** If a result exactly matches either of the last two results of the same type, the dice are rolled once more.

### Album critic score

```
base pools (normalized 0–100):
  T = band Theory contribution
  C = band Creativity contribution
  M = avg(instrument level of each member on their current instrument) × 10
  L = length score: 8–10 songs = 100, 6–7 or 11 = 80, 5 or 12 = 60

genreFit = +5 per member whose specialty == album genre;
           +8 if the genre is trending; −8 if the genre is stale

Each critic:
  raw = Σ(weight × pool) + genreFit + bias + roll(3d11 − 18)   // roll range −15 to +15, centered on 0
  if moment: ±15–25
  score = clamp(round(raw), 0, 100)
```

| Critic | Theory | Creativity | Musicianship | Length | Bias | Personality |
|---|---|---|---|---|---|---|
| "The Purist" | 0.45 | 0.15 | 0.30 | 0.10 | −4 | Harsh, values craft |
| "Hype Machine" | 0.10 | 0.45 | 0.25 | 0.20 | +5 | Generous, loves new ideas |
| "Old Head" | 0.30 | 0.10 | 0.50 | 0.10 | 0 | Cares about chops |
| "The Algorithm" | 0.20 | 0.30 | 0.20 | 0.30 | random ±6 each review | Unpredictable |

- **Album score** = average of the 4 critics, shown with 1 decimal (for example, **73.4**). This makes ties even rarer.
- **Score labels:**

| Score | Label |
|---|---|
| ≥ 90 | Classic |
| ≥ 75 | Acclaimed |
| ≥ 55 | Solid |
| ≥ 35 | Mixed |
| Below 35 | Flop |

### Show performance score (0–1000)

```
perf   = avg(member Performance) × 40        // up to 400
skill  = avg(instrument level) × 20          // up to 200
gear   = avg(gear quality × condition) × 15  // up to 150
album  = current album score × 1.5           // up to 150
stamina multiplier = 0.6 + 0.4 × (avgStamina / 100)

raw = (perf + skill + gear + album) × stamina multiplier
      + Σ per-member roll(2d25 − 26)         // every member rolls their own die
      + crowd roll(1d61 − 31)                // the crowd's mood that night
      + moment (4%: "Encore!" +80–150 / "Disaster" −80–150)
score = clamp(round(raw), 0, 1000)
```

**Results of a show:**
- Attendance = `min(venue capacity, cityFans × (0.3 + score / 2000))`
- Ticket revenue = attendance × ticket price for that city tier
- Merch buy chance per attendee = `score / 4000` per item type, capped at the stock you brought
- New fans in the city = `attendance × (score − 400) / 2000` (bad shows *lose* fans)

## 8. Fans and Cities

- Fans are tracked **per city**.
- When you release an album, new fans spread out from your hometown. The further away a city is, the smaller its share. Trending genres spread further.
- **Fan decay:** if more than 30 weeks pass since the last album, every city loses 1% of its fans per week. The same applies after a Flop release.

| Tier | Cities | Fans to unlock | Transport needed |
|---|---|---|---|
| Local | Hometown + 2 nearby | 0 / 50 | Van |
| Regional | 4 cities | 300 | Van |
| National | 5 cities | 1,500 | Tour Bus |
| International | 8 cities (London, Tokyo, Berlin, São Paulo, Seoul, Sydney, Paris, Mexico City) | 5,000 | Private Jet |

(The city names are placeholders. Your hometown is picked at the start.)

## 9. Touring

**Setup:**
- Pick a transport, the cities to visit (each must be unlocked), and how much of each merch item to stock.

| Transport | Cost per city | Stamina drain per show | Reach |
|---|---|---|---|
| Van | $50 | −14 | Local / Regional |
| Tour Bus (buy $4,000) | $150 | −9 | Up to National |
| Private Jet (rent $1,500 per tour) | $600 | −5 | Everything |

- While on tour, you can't hire, fire, write, or switch instruments.
- A tour can't continue if a member's stamina hits 0: they collapse and the tour ends early, which costs fans.

## 10. Merch

| Item | Unit cost | Sell price | Notes |
|---|---|---|---|
| Stickers | $0.5 | $3 | High buy rate |
| Patches | $1 | $5 | |
| Posters | $2 | $12 | |
| Shirts | $5 | $25 | Baseline |
| Hats | $6 | $25 | |
| Hoodies | $15 | $55 | Low buy rate, high margin |
| Albums | (format price) | | Free to bring if you released a physical format |

Unsold stock carries over to the next tour. You're betting on how well you'll perform.

## 11. Gear

- Each member has one **gear slot** for their current instrument (a guitar plus amp count as one "rig").
- **Quality tiers 1–5:**

| Tier | Name | Cost |
|---|---|---|
| 1 | Pawn Shop | $0 |
| 2 | Starter | $300 |
| 3 | Pro | $1,200 |
| 4 | Boutique | $4,000 |
| 5 | Legendary | $12,000 |

- **Condition** runs from 100% to 0% and drops 5–10% per show.
- **Maintenance** (new strings, tuning, repairs) costs `10% × tier price` and restores condition to 100%.
- **Below 40% condition:** the show might roll a gear-failure event, like "The bass amp blew!", with a big performance penalty.

## 12. Random Events (flavor + luck)

- Radio DJ plays your single (+fans in one city)
- Viral clip (+fans everywhere)
- Van breaks down (repair cost)
- Rival band feud (next album +creativity, −stamina)
- Label offers a deal (cash advance, but takes a cut of future sales) **[stretch]**
- Festival invite (huge one-off show if fans ≥ threshold)

## 13. Win / Long-term Goals

There's no hard win condition. Instead:
- **Milestones:** first CD, first Classic album, first international tour, 100k fans, Hall of Fame (20 years active).
- A **score summary** appears when the band fails or retires. It feeds a "Legacy" high-score list.

## 14. Art / Presentation

- 8-bit pixel style, portrait orientation for phones.
- **Main screen:** a pixel rehearsal room where the members idle and jam. Animation shows who is busy.
- Stat pop-ups ("+2 Theory!") float above members, Kairosoft-genre style.
- **Bottom menu:** Band · Write · Tour · Shop · Recruit · Calendar.

---

## Decisions log

- **Tech:** HTML5 / JavaScript, no build step. Runs in a phone browser; can be wrapped later (e.g. Capacitor).
- **Creativity:** a 5th stat.
- **Time:** auto-advances like Kairosoft's games.
- **Releases:** full albums only, no singles.
- **Traits:** "Flaky" was cut and replaced with "Gearhead".
- **Tuning:** city unlock thresholds were lowered for pacing (Local 30, Regional 150, National 800, International 2,500 fans). See `js/data.js` for all live numbers.
