import sqlite3
import pathlib

path = pathlib.Path(r"F:\\PROJECTS\\Vortex-Prime-emu\\docs\\store\\store.db")
conn = sqlite3.connect(path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cur.fetchall()]
print("Tables:", tables)
if "homebrews" in tables:
    cur.execute("PRAGMA table_info(homebrews)")
    print("Columns:")
    for row in cur.fetchall():
        print(row)
    cur.execute("SELECT pid,id,name,version,Author,package,image FROM homebrews LIMIT 5")
    rows = cur.fetchall()
    print("Sample rows:")
    for r in rows:
        print(r)
conn.close()
