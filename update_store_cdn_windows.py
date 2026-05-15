import sqlite3
import json
import pathlib
import datetime

base = pathlib.Path(r"F:\\PROJECTS\\Vortex-Prime-emu\\docs\\store")
db_path = base / "store.db"
readonly_db_path = base / "store_readonly.db"
page_path = base / "page1.json"

fields = {
    "name": "Homebrew Store (Online CDN)",
    "desc": "Official LightningMods Homebrew Store configured for Vortex Prime CDN.",
    "image": "https://vortex-prime-emu.com/store/storedata/icon0.png",
    "package": "https://vortex-prime-emu.com/store/pkgs/homebrewstore_onlinecdn.pkg",
    "version": "1.01",
    "picpath": "/user/app/NPXS39041/storedata/icon0.png",
    "desc_1": "Launches with the Vortex Prime-hosted CDN.",
    "desc_2": "No PC hosting required; serves content directly from vortex-prime-emu.com.",
    "ReviewStars": "5/5",
    "Size": "23 MB",
    "Author": "LightningMods / Vortex Prime",
    "apptype": "App",
    "pv": "9.00",
    "main_icon_path": "https://vortex-prime-emu.com/store/storedata/icon0.png",
    "main_menu_pic": "/user/app/NPXS39041/storedata/icon0.png",
    "number_downloads": "0",
    "releaseddate": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
}

def apply(db_path: pathlib.Path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    assignments = ", ".join(f"{col}=?" for col in fields)
    values = list(fields.values()) + ["1"]
    cur.execute(f"UPDATE homebrews SET {assignments} WHERE pid=?", values)

    if cur.rowcount == 0:
        placeholders = ", ".join("?" for _ in fields)
        cur.execute(
            f"INSERT INTO homebrews (pid, {', '.join(fields.keys())}) VALUES (?, {placeholders})",
            ["1"] + list(fields.values()),
        )

    conn.commit()
    row = conn.execute("SELECT * FROM homebrews WHERE pid=?", ("1",)).fetchone()
    conn.close()
    return dict(row)

entry = apply(db_path)
apply(readonly_db_path)

page = {"packages": [entry]}
page_path.write_text(json.dumps(page, indent=2), encoding="utf-8")

print("Updated:")
print(db_path)
print(readonly_db_path)
print(page_path)
print(json.dumps(page, indent=2))
