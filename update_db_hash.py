import hashlib
import pathlib
import json

base = pathlib.Path(r"F:\\PROJECTS\\Vortex-Prime-emu\\docs\\store")
readonly_path = base / "store_readonly.db"
hash_path = base / "db_hash.json"

md5 = hashlib.md5(readonly_path.read_bytes()).hexdigest()

hash_path.write_text(json.dumps({"hash": md5}, indent=2), encoding="utf-8")
print(f"Updated hash: {md5}")
