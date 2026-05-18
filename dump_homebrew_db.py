import sqlite3
import pathlib
from pprint import pprint

path = pathlib.Path(r"F:\\PROJECTS\\Vortex-Prime-emu\\docs\\store\\store.db")
conn = sqlite3.connect(path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
rows = cur.execute("SELECT * FROM homebrews").fetchall()
for row in rows:
    pprint(dict(row))
conn.close()
