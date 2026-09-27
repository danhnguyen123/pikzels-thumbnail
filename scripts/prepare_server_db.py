"""Tạo bản DB SQLite sẵn sàng cho SERVER từ DB local.

DB là nguồn dữ liệu duy nhất (không dùng JSON nữa). Script này:
  1. Checkpoint WAL + copy data/pikzels.db -> backup/server/data/pikzels.db
  2. Sửa `local_path` của mọi ảnh gallery trong bản copy sang đường dẫn TRÊN SERVER
     (mặc định /mnt/media/package-studio/output/<tên_file>) để ảnh hiển thị đúng.
  3. Copy các file ảnh gốc sang backup/server/output/ để đẩy lên server.

Chạy LOCAL (đóng server trước cho chắc):
    python scripts/prepare_server_db.py
    python scripts/prepare_server_db.py /duong/dan/output/tren/server

Sau đó copy 2 thứ lên Oracle Volume:
    scp backup/server/data/pikzels.db  ubuntu@<server>:/mnt/media/package-studio/data/pikzels.db
    scp -r backup/server/output/.      ubuntu@<server>:/mnt/media/package-studio/output/

(Chỉ cần copy pikzels.db là đủ để khôi phục Personas/Styles; copy thêm output/ để có ảnh Gallery.)
"""
import json
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC_DB = ROOT / "data" / "pikzels.db"
DEFAULT_SERVER_OUTPUT = "/mnt/media/package-studio/output"


def main():
    server_output = (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SERVER_OUTPUT).rstrip("/")
    if not SRC_DB.is_file():
        print(f"DB not found: {SRC_DB}")
        sys.exit(1)

    out = ROOT / "backup" / "server"
    (out / "data").mkdir(parents=True, exist_ok=True)
    (out / "output").mkdir(parents=True, exist_ok=True)

    # 1) checkpoint WAL để dồn hết vào file .db rồi copy
    con = sqlite3.connect(SRC_DB)
    con.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    con.close()
    dst_db = out / "data" / "pikzels.db"
    shutil.copy2(SRC_DB, dst_db)

    # 2) + 3) sửa local_path trong bản copy + copy ảnh gốc
    con = sqlite3.connect(dst_db)
    con.row_factory = sqlite3.Row
    rows = con.execute("SELECT hid, data FROM history").fetchall()
    rewritten = copied = missing = 0
    for r in rows:
        try:
            d = json.loads(r["data"])
        except Exception:  # noqa: BLE001
            continue
        lp = d.get("local_path")
        if not lp:
            continue
        base = Path(lp).name
        if Path(lp).is_file():
            shutil.copy2(lp, out / "output" / base)
            copied += 1
        else:
            missing += 1
        d["local_path"] = f"{server_output}/{base}"
        con.execute("UPDATE history SET data=? WHERE hid=?",
                    (json.dumps(d, ensure_ascii=False), r["hid"]))
        rewritten += 1
    con.commit()
    con.close()

    npikz = sqlite3.connect(dst_db).execute("SELECT COUNT(*) FROM pikzonalities").fetchone()[0]
    print(f"[ok] server DB ready: {dst_db}")
    print(f"     personas/styles: {npikz}")
    print(f"     history local_path rewritten: {rewritten} (images copied: {copied}, missing: {missing})")
    print()
    print("Copy to server:")
    print(f"  scp \"{dst_db}\"  ubuntu@<server>:/mnt/media/package-studio/data/pikzels.db")
    print(f"  scp -r \"{out / 'output'}\"/*  ubuntu@<server>:/mnt/media/package-studio/output/")


if __name__ == "__main__":
    main()
