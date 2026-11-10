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

## Our Family (relatives register, tree and card list)

- **Page:** `#/family` (menu → Our Family, or Home → Coming up). One shared register for both weddings: every relative, eldest first, with Married, Meat, Village and Passed away; the Tree view draws the same people from above; Cards is the numbered wedding-card list; ⇩ Word file exports the card list and every family's table.
- **Database:** run `supabase/016_our_family.sql` once. It creates `family_register` (one row, `main`), keeps an earlier copy every 15 minutes in `family_register_versions` (newest 300), adds the register to the nightly backup, and loads the list typed so far. Full and Lists-only people can edit; View-only people can only look. Saving goes through `save_family_register()`, which refuses a save made on top of someone else's newer one.
- **Code:** `js/family.js` is one self-contained module in its own shadow root (its styles never mix with the site's). It is generated from the standalone relatives page, so change it there and rebuild rather than editing by hand when possible.
