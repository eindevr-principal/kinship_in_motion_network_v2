# Kinship In Motion

An interactive network of enslaved people and their relationships, drawn from
the Thistlewood diaries. The site reads two spreadsheets and draws the graph
automatically — there is **no build step and no code to run**.

Live site: https://eindevr-principal.github.io/kinship_in_motion_network_v2/

---

## The files

| File | What it is |
|------|------------|
| `kim_glossary.csv` | One row per **person** (and per location). Names, ethnicity, locations, biography. This is your list of people. |
| `kim_relationships.csv` | One row per **relationship** between two people. |
| `index.html` | The webpage that draws the network. You rarely need to touch this. |
| `scripts/validate.mjs` | Automatically checks your data for mistakes before publishing. |
| `.github/workflows/deploy.yml` | The automation that checks the data and publishes the site. |

You no longer need a separate merged `kim_version_1.csv` — the page joins the two
files together itself, every time it loads.

---

## How to update the data (the whole point)

You edit the spreadsheets **right on GitHub** — no download, no software, no code.

1. Go to the repository on GitHub and click the file you want to change
   (`kim_glossary.csv` to add/edit a person, `kim_relationships.csv` to add/edit
   a relationship).
2. Click the **pencil icon** (✏️ *Edit this file*) in the top-right.
3. Make your edits and click the green **Commit changes** button.
4. That's it. Within a minute or two the live site rebuilds itself with your
   changes. You can watch it happen under the repo's **Actions** tab — a green
   check ✓ means it published.

Prefer working in Excel or Google Sheets? Edit there, export as CSV with the
**same file name**, and drag it onto the file on GitHub to replace it. Just keep
the column headers exactly as they are.

### If something in the data is wrong

Before publishing, the automation checks your spreadsheets. If it finds a problem
— a relationship pointing to a person who isn't in the glossary, a duplicated
person ID, a location used where a person belongs — it **stops and shows a red X**
instead of publishing a broken graph. Click the failed run under the **Actions**
tab and you'll see a plain-English message like:

```
Relationships (row 47): relation ID "P9999" is not in the glossary (label "FRIEND OF").
```

Fix that row, commit again, and it republishes. The old site stays up in the
meantime, so a typo never takes the graph down.

---

## How the two spreadsheets fit together

Every person has a **PERSON ID** like `P1`, `P2` in the glossary. A relationship
row links two of those IDs:

- **PERSON ID** — the person the relationship is *from* (e.g. `P1`)
- **Label** — the kind of relationship (e.g. `MOTHER OF`)
- **RELATION IDS** — the person the relationship is *to* (e.g. `P2`)

So `P1 · MOTHER OF · P2` draws a line between Molia and Silvia.

Rows with a Label but **no RELATION ID** (like `GARDENER`) are treated as notes,
not connections, so they don't add a line to the graph.

Relationships are grouped into three color families on the graph:

- **Family & kinship** — mother/father/daughter/son/sister/brother, partners, housemates
- **Labor & care** — field gang, midwife, nurse, gardener, business partner, seasoning
- **Community & culture** — friend, shipmate, and shared heritage (Igbo, Congo, Anansi storyteller, Myal)

---

## Using the site

- **Click a person** to open their full biography and every relationship they have.
- **Search** by name in the top-right box to jump to anyone.
- **Filter** to a single relationship type, or click a color in the legend to
  show/hide a whole family.
- Bigger dots = more connections. Drag to pan, scroll to zoom.

Everyone in the glossary appears — all 491 people. The 96 who currently have
relationships form the connected network in the middle; the remaining people are
shown as faint dots in an outer ring (still searchable and clickable for their
biography) and will move into the network automatically as soon as you add a
relationship for them in `kim_relationships.csv`. You can hide that outer ring
with the **Unconnected people** toggle in the legend.

---

## One-time setup (only needed once, ever)

For the automatic publishing to work, GitHub Pages has to be told to publish from
the automation:

1. In the repository, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

That's the only setting. After that, every commit publishes automatically.

---

## Cleaning up the old project files (optional)

This version replaces the old webpack build. These leftover files from the
previous setup are no longer used and can be deleted whenever convenient:

- `package.json`, `package-lock.json`, `webpack.config.js`
- the `src/` folder and any `kim_version_1.csv`
- the `node_modules/` and `dist/` folders

Nothing breaks if you leave them; removing them just keeps the repo tidy.

---

## Previewing on your own computer (optional, for the curious)

You don't need this, but if you ever want to see changes before committing, open
a terminal in this folder and run any simple web server, e.g.:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`. (Opening `index.html` directly by
double-clicking won't work, because browsers block the CSV files from loading
that way — it needs to be served.)

To check your data the same way the automation does:

```bash
node scripts/validate.mjs
```
