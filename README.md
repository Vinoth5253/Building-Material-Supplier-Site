# KVS&CO — Building Materials Showroom

Neumorphic + glassmorphic catalogue website (no purchasing, enquiry only) with an
admin panel and Excel import. Design tokens and rules: [DESIGN.md](DESIGN.md).

## Run locally
```
pip install -r requirements.txt
python app.py            # or double-click start.bat
```
- Website: http://127.0.0.1:5050
- Admin:   http://127.0.0.1:5050/admin  — first login `admin` / `kvs@2026` (change it in Admin › Settings)
- To let phones on the same Wi-Fi open it: `set KVS_HOST=0.0.0.0` before `python app.py`, then use the PC's IP.

## Updating items (admin)
| Task | Where |
|---|---|
| Bulk update items / availability | Admin › Excel import → upload workbook → preview → Apply |
| Get a workbook to edit | Admin › Excel import → *Template* or *Export current items* (see `KVSCO_sample_items.xlsx`) |
| Change one item's availability / Highlight / Innovation | Admin › Items table (saves instantly) |
| Add / change / remove an item's photo | Admin › Items — right-click the item (or click its picture, or drag a photo onto the row) |
| Edit full details | Admin › Items › ✎ |
| Admin language | EN / தமிழ் switch in the admin header (shared with the website) |
| Phone, WhatsApp, address, show/hide prices | Admin › Settings |

Import modes: **Merge** (add new SKUs, update matching ones, blank cells keep old values) or
**Replace all** (workbook becomes the full catalogue). Open pages refresh themselves within ~20 s.

## Standalone file for clients
`python build_standalone.py` → `dist/KVSCO_Showroom.html` — one file, no server needed.
It snapshots the current items, settings and photos. Double-click to open; the footer **Admin**
link (or adding `?admin` to the address) opens a demo admin (login `admin` / `kvs@2026`)
where the client can try everything. Demo changes stay in their browser only (Reset button
restores the original). Excel import/export needs internet the first time (Excel library from cdnjs).
Re-run the script after updating the real catalogue to send a fresh copy.

## Files
```
app.py        Flask server + API          seed.py   starter catalogue (first run only)
wsgi.py       entry point for hosting     static/   site + admin (HTML/CSS/JS)
data/         items.json, settings.json, auth.json (created on first run — back this up)
uploads/      uploaded product photos     (back this up too)
```

## Hosting (recommended: PythonAnywhere)
The app keeps data in files, so it needs a host with a persistent disk.

1. Create an account at pythonanywhere.com (free tier gives `yourname.pythonanywhere.com`;
   the ~$5/month plan allows your own domain such as `kvsco.in`).
2. **Files** tab → upload this folder (zip it, upload, then in a Bash console: `unzip KVSCO_Website.zip`).
   Don't upload `data/` if you want a fresh start.
3. Bash console: `pip install --user -r ~/KVSCO_Website/requirements.txt`
4. **Web** tab → *Add a new web app* → *Manual configuration* → Python 3.x.
5. Edit the WSGI file it shows and replace its contents with:
   ```python
   import sys
   sys.path.insert(0, "/home/YOURNAME/KVSCO_Website")
   from wsgi import application
   ```
6. Web tab → *Static files*: URL `/static/` → `/home/YOURNAME/KVSCO_Website/static`
   and `/uploads/` → `/home/YOURNAME/KVSCO_Website/uploads`. Turn on **Force HTTPS**.
7. Click **Reload**, open the site, sign in to `/admin` and **change the password immediately**.

Other options: a small VPS (DigitalOcean / Lightsail / Hostinger, ~₹400–600/month) running
`waitress-serve --port 8000 wsgi:application` behind nginx; or Render/Railway **with a
persistent disk/volume attached** (without one, edits are lost on every restart).
Static-only hosts (GitHub Pages, Netlify) can't run the admin panel.
