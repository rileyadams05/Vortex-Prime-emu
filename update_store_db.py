import sqlite3
import pathlib
import datetime

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
    "releaseddate": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    "number_downloads": "0"
}

def apply(path: pathlib.Path):
    conn = sqlite3.connect(path)
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
    conn.close()

base = pathlib.Path(r"F:\\PROJECTS\\Vortex-Prime-emu\\docs\\store")
for db_name in ("store.db", "store_readonly.db"):
    apply(base / db_name)
