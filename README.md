# FitOS v0.4 — fitness and nutrition tracker

FitOS is an Android-friendly, offline-first Progressive Web App (PWA) for personal food, training, and body-progress tracking. It is plain HTML/CSS/JavaScript and has no mandatory account, backend, analytics, or paid API.

## Included in this build

- **Monochrome app identity:** black-and-white symbol combining a dumbbell and food bowl; no letters in the icon.
- **Nutrition diary:** log food by weighed grams, with daily totals for calories, protein, carbs, fat and fibre.
- **Expanded offline food list:** 122 entries, covering common Tamil/South Indian and broader Indian foods, with English/Tamil aliases where available.
- **Raw/cooked distinctions:** raw/dry/cooked/prepared foods are separate records when available. Always pick the state matching what you weighed.
- **Transparent data quality:** food records carry source and confidence notes. Composite dishes, restaurant meals, and recipes are explicitly low-confidence estimates where appropriate.
- **Custom foods:** create a food from its package label or a manually entered estimate; custom entries stay on the device.
- **Recipe builder:** add ingredient weights and the final cooked yield to calculate nutrition per 100 g of the finished recipe, with ingredient-source uncertainty retained.
- **Saved day templates:** save the current day's food entries and repeat them later. The template copies the original portion and nutrient snapshots; it does not recalculate a recipe.
- **Offline phrase parser:** deterministic parsing for supported common patterns, with a review step before entries are saved. Ambiguous portions are not silently assumed.
- **Training and progress:** log exercises/sets/reps/load, body measurements, weight, steps, water, sleep, energy, soreness and stress; weight and waist trends render locally when enough measurements exist.
- **Targets and local assessment:** editable daily calorie and macro targets with a simple rules-based summary.
- **Supplement / medication journal:** optional manual record of name, amount, unit, timing and notes—no dosing advice or reminders.
- **Data ownership:** JSON backup/restore and CSV exports for food logs or all stored record types.
- **PWA installation:** manifest, monochrome PNG icons, and versioned service-worker app-shell cache.
- **Legacy backup support:** FitOS v0.4 can import the previous Aesthetic OS Stage 1 JSON backup format.

## Start on a computer

1. Extract the ZIP.
2. Open a terminal in the `fitos_v0.2` folder.
3. Run `python -m http.server 8000`.
4. Visit `http://localhost:8000` in Chrome or Chromium.
5. Open `tests.html?autorun=1` to run browser checks.

Opening `index.html` directly as a `file://` URL can be useful for a quick visual check, but IndexedDB and service-worker behaviour must be tested on localhost or HTTPS.

## Install on Android

For reliable installation and offline app-shell caching, the files must be hosted at an HTTPS address. GitHub Pages is one option:

1. Create a GitHub repository and upload the contents of this folder (the files, not the ZIP file).
2. In the repository settings, enable GitHub Pages for the main branch and root folder.
3. Open the published HTTPS site in Chrome or Brave.
4. Use the browser menu and choose **Install app** or **Add to Home screen**.
5. Open FitOS once while online, then test it offline.

The app is a web app installed through your browser, not a native APK. The host serves the app files; the app code does not upload your personal records.

## Backups and privacy

Records are held in IndexedDB on that browser/device. They do not automatically sync to another phone. Export a JSON backup regularly, copy it to a safe location, then restore it on the new install. CSV files are useful for spreadsheet analysis. Browser storage can be cleared by the browser or operating system, so backups matter.

Restore supports `MERGE` (add/update records by IDs) or `REPLACE` (clear current local FitOS records, then restore the selected backup). Choose `REPLACE` only when you are sure the backup contains everything you want to keep.

## Food database accuracy and provenance

This build includes a broad starter dataset, **not a complete direct import of a national nutrient database**. Many individual values are approximate per-100 g estimates. Composite dishes, restaurant meals, oil amounts, bone-in portions, and prepared recipes can differ widely. Missing micronutrients are not shown as zero; this build currently tracks only energy, protein, carbohydrate, fat, and fibre.

Reference resources for future source-led expansion:

- ICMR-NIN, *Indian Food Composition Tables 2017* (food sampling/analytical data; most foods in IFCT are raw, so cooked meals need separate treatment): https://www.nin.res.in/ebooks/IFCT2017_16122024.pdf
- FAO Food Composition Tables and Databases — India IFCT 2017 record: https://www.fao.org/food-composition/tables-and-databases/detail/%28country--date%29-title-9/en
- Anuvaad Indian Nutrient Databank methodology (composite recipe calculations reference IFCT/other food-composition sources): https://www.anuvaad.org.in/methodology/

Packaged items such as whey, paneer, chocolate, protein bars and ready-made foods should be created from the exact package's nutrition label. Do not treat generic brand-like aliases as exact label data.

## Known limits for this build

- Values are suitable for consistent journaling but are not laboratory-exact; low-confidence dishes should be treated as broad estimates.
- Some regional foods, specific restaurant products, brands, serving counts and recipes are not yet included.
- Quick-entry parsing is intentionally limited and not a general AI language model; check every proposed item and quantity.
- Saved meal templates repeat past entries; they are not a full ingredient-level recipe calculator.
- No automatic device step/sleep integration, food-photo recognition, cloud sync, reminders, or clinician-grade medical advice.
- The local coach is a basic target comparison, not a diagnostic tool.

## Development checks

- `node --check app.js`
- `node --check db.js`
- `node --check foods.js`
- Browser test page: `tests.html?autorun=1`

## Version

FitOS v0.4 • October 2026
