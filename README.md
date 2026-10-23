# The Wedding War Room

The family's shared planning site for Charani & Adahrii and Elow & Maniziia.

- **Hosting:** GitHub Pages (this repository)
- **Data, photos and logins:** Supabase (`supabase/setup.sql` creates everything)
- **Preview without the database:** open `index.html?demo`

## Who can do what
- Family members get in with the shared passcode and their name.
- Anyone can add, edit, move, remove (to the Bin) and restore.
- Only the admin can delete things permanently and open Settings
  (wedding dates, names, theme colours, the passcode).

## Maintenance

- **Release a change:** run `scripts/bump.sh` from the repo root. It moves every `?v=` import, the service worker cache name and the tests to the next version, so phones pick up the new files.
- **Check nothing broke:** `tests/run.sh` runs the browser tests against a local copy in demo mode (needs Python, Playwright with Chromium, and Pillow). `tests/cssdiff.py <tag>` takes phone and laptop screenshots of the main pages; `tests/cssdiff.py <tagA> <tagB>` compares two sets.
- **Styles:** everything is in `css/style.css`. The dark look (navy & gold, emerald garden) is the last section, so it wins over the older layers above it.
