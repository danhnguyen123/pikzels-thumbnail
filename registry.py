"""Lưu trữ local cho Pikzels Studio bằng SQLite (giữ nguyên API cũ).

- 1 file DB: data/pikzels.db (WAL — an toàn ghi đồng thời).
- Cột TEXT cho prompt/instructions dài (SQLite không giới hạn thực tế).
- Lần chạy đầu: tự import data/pikzonalities.json + data/history.json (nếu có), giữ file JSON làm backup.
"""
import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

# Có thể trỏ ra volume (Docker/cloud) qua env DATA_DIR; mặc định ./data (local).
DATA_DIR = Path(os.environ.get("DATA_DIR", str(Path(__file__).parent / "data")))
DB_FILE = DATA_DIR / "pikzels.db"
PIKZ_FILE = DATA_DIR / "pikzonalities.json"      # backup / nguồn import lần đầu
HISTORY_FILE = DATA_DIR / "history.json"

# Cột "cố định" của pikzonalities; field lạ dồn vào cột extra (JSON) để giữ tính linh hoạt.
_PIKZ_COLS = ("name", "mode", "status", "created_at", "portrait_url", "special_instructions")
_lock = threading.Lock()


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def _conn():
    """Mở connection SQLite, tự commit/rollback + đóng khi xong."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_FILE, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA journal_mode=WAL")
    c.execute("PRAGMA busy_timeout=30000")
    c.execute("PRAGMA foreign_keys=ON")
    try:
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()


def _init():
    with _lock, _conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS pikzonalities (
            id TEXT PRIMARY KEY,
            name TEXT,
            mode TEXT,
            status TEXT,
            created_at TEXT,
            portrait_url TEXT,
            special_instructions TEXT,
            extra TEXT
        );
        CREATE TABLE IF NOT EXISTS instruction_versions (
            vid INTEGER PRIMARY KEY AUTOINCREMENT,
            pikz_id TEXT NOT NULL,
            text TEXT,
            at TEXT,
            restored_from INTEGER,
            FOREIGN KEY (pikz_id) REFERENCES pikzonalities(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS history (
            hid INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT,
            request_id TEXT,
            kind TEXT,
            style TEXT,
            persona TEXT,
            favorite INTEGER DEFAULT 0,
            score INTEGER,
            data TEXT
        );
        """)
        _ensure_history_columns(c)
        _migrate_json(c)


def _ensure_history_columns(c):
    """Thêm cột (style/persona/favorite/score) cho DB cũ + backfill từ data JSON."""
    cols = {r["name"] for r in c.execute("PRAGMA table_info(history)").fetchall()}
    for col, decl in (("style", "TEXT"), ("persona", "TEXT"),
                      ("favorite", "INTEGER DEFAULT 0"), ("score", "INTEGER")):
        if col not in cols:
            c.execute(f"ALTER TABLE history ADD COLUMN {col} {decl}")
    # backfill style/persona/score từ data JSON cho các dòng thiếu
    for r in c.execute("SELECT hid,data,style,persona,score FROM history").fetchall():
        try:
            d = json.loads(r["data"])
        except Exception:
            continue
        upd, params = [], []
        if r["style"] is None and d.get("style"):
            upd.append("style=?"); params.append(d["style"])
        if r["persona"] is None and d.get("persona"):
            upd.append("persona=?"); params.append(d["persona"])
        if r["score"] is None and d.get("score") is not None:
            upd.append("score=?"); params.append(d["score"])
        if upd:
            c.execute(f"UPDATE history SET {', '.join(upd)} WHERE hid=?", (*params, r["hid"]))


def _migrate_json(c):
    # Chỉ import khi bảng trống và file JSON tồn tại (chạy 1 lần).
    if c.execute("SELECT COUNT(*) FROM pikzonalities").fetchone()[0] == 0 and PIKZ_FILE.exists():
        try:
            for it in json.loads(PIKZ_FILE.read_text(encoding="utf-8")):
                extra = {k: v for k, v in it.items()
                         if k not in _PIKZ_COLS and k not in ("id", "instruction_versions")}
                c.execute(
                    "INSERT OR IGNORE INTO pikzonalities "
                    "(id,name,mode,status,created_at,portrait_url,special_instructions,extra) "
                    "VALUES (?,?,?,?,?,?,?,?)",
                    (it.get("id"), it.get("name"), it.get("mode"), it.get("status"),
                     it.get("created_at") or _now(), it.get("portrait_url"),
                     it.get("special_instructions"),
                     json.dumps(extra, ensure_ascii=False) if extra else None))
                for v in it.get("instruction_versions", []):
                    c.execute("INSERT INTO instruction_versions (pikz_id,text,at,restored_from) "
                              "VALUES (?,?,?,?)",
                              (it.get("id"), v.get("text"), v.get("at"), v.get("restored_from")))
        except Exception:
            pass

    if c.execute("SELECT COUNT(*) FROM history").fetchone()[0] == 0 and HISTORY_FILE.exists():
        try:
            items = json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
            for e in reversed(items):  # JSON newest-first -> chèn cũ trước để id tăng dần theo tuổi
                c.execute("INSERT INTO history (created_at,request_id,kind,data) VALUES (?,?,?,?)",
                          (e.get("created_at") or _now(), e.get("request_id"), e.get("kind"),
                           json.dumps(e, ensure_ascii=False)))
        except Exception:
            pass


def _row_to_pikz(c, row):
    d = {"id": row["id"], "name": row["name"], "mode": row["mode"], "status": row["status"],
         "created_at": row["created_at"], "portrait_url": row["portrait_url"],
         "special_instructions": row["special_instructions"]}
    if row["extra"]:
        try:
            d.update(json.loads(row["extra"]))
        except Exception:
            pass
    d["instruction_versions"] = [
        _version(v) for v in c.execute(
            "SELECT text,at,restored_from FROM instruction_versions "
            "WHERE pikz_id=? ORDER BY vid ASC", (row["id"],)).fetchall()]
    return d


def _version(v):
    out = {"text": v["text"], "at": v["at"]}
    if v["restored_from"] is not None:
        out["restored_from"] = v["restored_from"]
    return out


# ---------------------------------------------------------------- pikzonalities
def load_pikzonalities():
    with _conn() as c:
        rows = c.execute("SELECT * FROM pikzonalities ORDER BY created_at ASC, rowid ASC").fetchall()
        return [_row_to_pikz(c, r) for r in rows]


def list_pikzonalities(mode=None):
    with _conn() as c:
        if mode:
            rows = c.execute("SELECT * FROM pikzonalities WHERE mode=? ORDER BY created_at ASC, rowid ASC",
                             (mode,)).fetchall()
        else:
            rows = c.execute("SELECT * FROM pikzonalities ORDER BY created_at ASC, rowid ASC").fetchall()
        return [_row_to_pikz(c, r) for r in rows]


def get_pikzonality(pid):
    with _conn() as c:
        r = c.execute("SELECT * FROM pikzonalities WHERE id=?", (pid,)).fetchone()
        return _row_to_pikz(c, r) if r else None


def _apply_fields(c, pid, fields):
    """Cập nhật cột/extra + (nếu có) thay bảng instruction_versions."""
    if "instruction_versions" in fields:
        versions = fields.pop("instruction_versions") or []
        c.execute("DELETE FROM instruction_versions WHERE pikz_id=?", (pid,))
        for v in versions:
            c.execute("INSERT INTO instruction_versions (pikz_id,text,at,restored_from) VALUES (?,?,?,?)",
                      (pid, v.get("text"), v.get("at"), v.get("restored_from")))
    known = {k: v for k, v in fields.items() if k in _PIKZ_COLS}
    unknown = {k: v for k, v in fields.items() if k not in _PIKZ_COLS and k != "id"}
    if unknown:
        row = c.execute("SELECT extra FROM pikzonalities WHERE id=?", (pid,)).fetchone()
        cur = {}
        if row and row["extra"]:
            try:
                cur = json.loads(row["extra"])
            except Exception:
                cur = {}
        cur.update(unknown)
        known["extra"] = json.dumps(cur, ensure_ascii=False)
    if known:
        sets = ", ".join(f"{k}=?" for k in known)
        c.execute(f"UPDATE pikzonalities SET {sets} WHERE id=?", (*known.values(), pid))


def add_pikzonality(pid, name, mode, status="processing", **extra):
    with _lock, _conn() as c:
        exists = c.execute("SELECT 1 FROM pikzonalities WHERE id=?", (pid,)).fetchone()
        if exists:
            _apply_fields(c, pid, {"name": name, "mode": mode, "status": status, **extra})
        else:
            c.execute("INSERT INTO pikzonalities (id,name,mode,status,created_at) VALUES (?,?,?,?,?)",
                      (pid, name, mode, status, _now()))
            if extra:
                _apply_fields(c, pid, dict(extra))
    return get_pikzonality(pid)


def update_pikzonality(pid, **fields):
    fields = {k: v for k, v in fields.items() if v is not None}
    with _lock, _conn() as c:
        if not c.execute("SELECT 1 FROM pikzonalities WHERE id=?", (pid,)).fetchone():
            return None
        _apply_fields(c, pid, fields)
    return get_pikzonality(pid)


def set_instructions(pid, text):
    """Đặt special_instructions hiện tại + lưu 1 version mới (bỏ qua nếu trùng bản hiện tại)."""
    with _lock, _conn() as c:
        r = c.execute("SELECT special_instructions FROM pikzonalities WHERE id=?", (pid,)).fetchone()
        if not r:
            return
        if r["special_instructions"] != text:
            c.execute("INSERT INTO instruction_versions (pikz_id,text,at) VALUES (?,?,?)",
                      (pid, text, _now()))
        c.execute("UPDATE pikzonalities SET special_instructions=? WHERE id=?", (text, pid))


def restore_instruction(pid, index):
    """Khôi phục special_instructions về version thứ `index` (0-based theo thứ tự thời gian)."""
    with _lock, _conn() as c:
        versions = c.execute(
            "SELECT text FROM instruction_versions WHERE pikz_id=? ORDER BY vid ASC", (pid,)).fetchall()
        if not (0 <= index < len(versions)):
            return None
        text = versions[index]["text"]
        c.execute("UPDATE pikzonalities SET special_instructions=? WHERE id=?", (text, pid))
        c.execute("INSERT INTO instruction_versions (pikz_id,text,at,restored_from) VALUES (?,?,?,?)",
                  (pid, text, _now(), index))
        return text


def remove_pikzonality(pid):
    with _lock, _conn() as c:
        c.execute("DELETE FROM instruction_versions WHERE pikz_id=?", (pid,))
        c.execute("DELETE FROM pikzonalities WHERE id=?", (pid,))


# ---------------------------------------------------------------- history
def load_history():
    with _conn() as c:
        rows = c.execute("SELECT data FROM history ORDER BY hid DESC").fetchall()
        out = []
        for r in rows:
            try:
                out.append(json.loads(r["data"]))
            except Exception:
                pass
        return out


def add_history(**entry):
    entry.setdefault("created_at", _now())
    with _lock, _conn() as c:
        c.execute("INSERT INTO history (created_at,request_id,kind,style,persona,favorite,score,data) "
                  "VALUES (?,?,?,?,?,?,?,?)",
                  (entry.get("created_at"), entry.get("request_id"), entry.get("kind"),
                   entry.get("style"), entry.get("persona"),
                   1 if entry.get("favorite") else 0, entry.get("score"),
                   json.dumps(entry, ensure_ascii=False)))
    return entry


def query_history(limit=24, offset=0, style=None, persona=None, kind=None,
                  favorite=None, date_from=None, date_to=None):
    """Lịch sử ảnh có phân trang + lọc. Trả {items, total}. Mới nhất trước."""
    where, params = [], []
    if style:
        where.append("style=?"); params.append(style)
    if persona:
        where.append("persona=?"); params.append(persona)
    if kind:
        where.append("kind=?"); params.append(kind)
    if favorite:
        where.append("favorite=1")
    if date_from:
        where.append("substr(created_at,1,10) >= ?"); params.append(date_from)
    if date_to:
        where.append("substr(created_at,1,10) <= ?"); params.append(date_to)
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    with _conn() as c:
        total = c.execute(f"SELECT COUNT(*) FROM history{clause}", params).fetchone()[0]
        rows = c.execute(
            f"SELECT hid,data,favorite,score FROM history{clause} ORDER BY hid DESC LIMIT ? OFFSET ?",
            (*params, limit, offset)).fetchall()
    items = []
    for r in rows:
        try:
            d = json.loads(r["data"])
        except Exception:
            d = {}
        d["hid"] = r["hid"]
        d["favorite"] = bool(r["favorite"])
        d["score"] = r["score"]
        items.append(d)
    return {"items": items, "total": total}


def remove_history(hid):
    with _lock, _conn() as c:
        c.execute("DELETE FROM history WHERE hid=?", (hid,))


def history_exists(request_id):
    if not request_id:
        return False
    with _conn() as c:
        return c.execute("SELECT 1 FROM history WHERE request_id=? LIMIT 1", (request_id,)).fetchone() is not None


def get_history_entry(hid):
    with _conn() as c:
        r = c.execute("SELECT data FROM history WHERE hid=?", (hid,)).fetchone()
    if not r:
        return None
    try:
        d = json.loads(r["data"]); d["hid"] = hid; return d
    except Exception:
        return None


def set_favorite(hid, favorite):
    with _lock, _conn() as c:
        c.execute("UPDATE history SET favorite=? WHERE hid=?", (1 if favorite else 0, hid))
    return bool(favorite)


def set_score_hid(hid, score):
    """Gán điểm cho 1 ảnh theo hid (cột + data JSON)."""
    with _lock, _conn() as c:
        r = c.execute("SELECT data FROM history WHERE hid=?", (hid,)).fetchone()
        if not r:
            return
        try:
            d = json.loads(r["data"])
        except Exception:
            d = {}
        d["score"] = score
        c.execute("UPDATE history SET score=?, data=? WHERE hid=?",
                  (score, json.dumps(d, ensure_ascii=False), hid))


def set_history_score(request_id, score):
    """Gán điểm cho ảnh đã lưu (khớp theo request_id) — cột + data JSON."""
    with _lock, _conn() as c:
        for r in c.execute("SELECT hid,data FROM history WHERE request_id=?", (request_id,)).fetchall():
            try:
                d = json.loads(r["data"])
            except Exception:
                d = {}
            d["score"] = score
            c.execute("UPDATE history SET score=?, data=? WHERE hid=?",
                      (score, json.dumps(d, ensure_ascii=False), r["hid"]))


def update_history(request_id, **fields):
    with _lock, _conn() as c:
        r = c.execute("SELECT hid,data FROM history WHERE request_id=? ORDER BY hid DESC LIMIT 1",
                      (request_id,)).fetchone()
        if not r:
            return
        try:
            data = json.loads(r["data"])
        except Exception:
            data = {}
        data.update(fields)
        c.execute("UPDATE history SET data=? WHERE hid=?",
                  (json.dumps(data, ensure_ascii=False), r["hid"]))


_init()
