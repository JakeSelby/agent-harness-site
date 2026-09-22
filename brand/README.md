# brand

`og-card.html` is the source of the Open Graph card served at `/og.png`, 1200x630. This
directory is not served; it exists so the card can be re-rendered rather than re-drawn.

The card loads Inter and Source Serif 4 from Google Fonts at render time, as the site's own
layout does, so no font software is bundled or redistributed here. Only the rendered PNG ships.

Regenerate with `./render-og-card.sh`, which needs network access, Pillow, and Google Chrome at
the path it names. The favicons come from the mark in the harness repository, not from here.
