# Kinship In Motion

An interactive network of enslaved people and their relationships, drawn from
the Thistlewood diaries. The site reads two spreadsheets and draws the graph
automatically — there is **no build step and no code to run**.

Live site: https://eindevr-principal.github.io/kinship_in_motion_network_v2/

---

## The files

| File | What it is |
|------|------------|
| `KINSHIP IN MOTION DATABASE_FOR_UPLOAD.xlsx` | The **one file the client maintains.** The site reads its `GLOSSARY` and `RELATIONSHIPS` tabs. |
| `index.html` | The webpage that draws the network. You rarely touch this. |
| `validate.mjs` | Automatically checks the data for mistakes before publishing. |
| `.github/workflows/deploy.yml` | The automation that checks the data and publishes the site. |

The site only reads two tabs — `GLOSSARY` and `RELATIONSHIPS`. The other tabs in
the workbook (EVENTS, LookUp, working sheets, etc.) are ignored, so they can stay.

---

## Updating the site — the simple version (for the client)

**She never exports CSVs and never picks a sheet.** She edits the workbook and
replaces one file. Here is the whole routine, start to finish:

1. Open the workbook, make edits on the **GLOSSARY** or **RELATIONSHIPS** tab,
   and **Save** (keep the file name exactly the same).
2. Go to the repository on GitHub and click the file
   **`KINSHIP IN MOTION DATABASE_FOR_UPLOAD.xlsx`**.
3. Click the **trash-can icon** to delete it, then **Commit changes**.
   (Deleting first is the reliable way to replace a file on GitHub.)
4. Click **Add file → Upload files**, drag in the freshly saved workbook — it
   **must have the same file name** — and **Commit changes**.
5. Done. Within a minute or two the live site updates itself. A green check ✓
   under the **Actions** tab means it published.

That's the entire process: *save, delete the old file, upload the new one.*

> **Important:** the uploaded file's name must stay exactly
> `KINSHIP IN MOTION DATABASE_FOR_UPLOAD.xlsx`. If it's saved under a new name
> (for example with a date on the end), the site won't find it. Keep one file,
> same name, every time.

### If something in the data is wrong

Before publishing, the automation checks the workbook. If it finds a problem — a
relationship pointing to a person who isn't in the glossary, a duplicated person
ID, a location used where a person belongs — it **stops and shows a red X**
instead of publishing a broken graph. Click the failed run under the **Actions**
tab for a plain-English message like:

```
RELATIONSHIPS row 47: relation ID "P9999" is not in the glossary (type "FRIEND OF").
```

Fix that row in the workbook and re-upload. The old site stays up in the
meantime, so a typo never takes the graph down.

---

## How the two tabs work together

Every person has a **PERSON ID** like `P1`, `P2` on the GLOSSARY tab. A row on the
RELATIONSHIPS tab links two of those IDs:

- **PERSON ID** — the person the relationship is *from* (e.g. `P1`)
- **RELATIONSHIP** — the kind of relationship (e.g. `MOTHER OF`)
- **RELATION IDS** — the person the relationship is *to* (e.g. `P2`)

So `P1 · MOTHER OF · P2` draws a line between Molia and Silvia. Rows with a type
but no RELATION ID are treated as notes, not connections.

The site matches these columns loosely (it accepts `RELATIONSHIP` or `Label`,
`LOCATION(S)` or `LOCATIONS`, and so on), so small header changes won't break it.

Relationships are grouped into three colors:

- **Family & kinship** — mother/father/daughter/son/sister/brother, partners, housemates
- **Labor & care** — field gang, midwife, nurse, gardener, business partner, seasoning
- **Community & culture** — friend, shipmate, and shared heritage (Igbo, Congo, Anansi storyteller, Myal)

---

## Using the site

- **Click a person** for their full biography and every relationship they have.
- **Search** by name in the top-right box to jump to anyone.
- **Filter** to a single relationship type, or click a color in the legend to
  show/hide a whole family.
- Bigger dots = more connections. Drag to pan, scroll to zoom.

Everyone in the glossary appears. People who already have relationships form the
connected network in the middle; the rest are faint dots in an outer ring (still
searchable and clickable) that move into the network automatically as soon as a
relationship is added for them. The **Unconnected people** legend toggle hides
that ring.

---

## One-time setup (already done, kept for reference)

For automatic publishing, GitHub Pages must be set to publish from the automation:
**Settings → Pages → Build and deployment → Source → GitHub Actions**. That's the
only setting; after it, every commit publishes automatically.

---

## Checking the data on your own computer (optional, for you — not the client)

```bash
npm install xlsx@0.18.5 --no-save
node validate.mjs
```

To preview the site before committing, run a simple web server in this folder
(`python3 -m http.server 8000`) and visit `http://localhost:8000`. Opening
