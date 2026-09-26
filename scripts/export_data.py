"""Export personas/styles + gallery history ra 1 thư mục portable để khôi phục trên server.

Chạy LOCAL (Windows):
    python scripts/export_data.py            # -> backup/export/
    python scripts/export_data.py <out_dir>

Tạo:
    <out_dir>/pikzonalities.json   # personas/styles (id, name, mode, instructions, versions...)
    <out_dir>/history.json         # lịch sử gallery (đã đổi local_path -> tên file)
    <out_dir>/output/<file>.png    # copy các ảnh còn tồn tại

Chỉ dùng stdlib (registry). Không cần server chạy.
"""
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import registry  # noqa: E402


def main():
    root = Path(__file__).resolve().parent.parent
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "backup" / "export"
    img_dir = out / "output"
    img_dir.mkdir(parents=True, exist_ok=True)

    pikz = registry.load_pikzonalities()
    (out / "pikzonalities.json").write_text(
        json.dumps(pikz, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"pikzonalities: {len(pikz)}")

    hist = registry.load_history()
    exported, copied = [], 0
    for h in hist:
        lp = h.get("local_path")
        fname = None
        if lp and Path(lp).is_file():
            fname = Path(lp).name
            try:
                shutil.copy2(lp, img_dir / fname)
                copied += 1
            except Exception:  # noqa: BLE001
                fname = None
        h2 = {k: v for k, v in h.items() if k != "hid"}
        h2["file"] = fname  # tên file để import map; None nếu ảnh gốc không còn
        exported.append(h2)
    (out / "history.json").write_text(
        json.dumps(exported, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"history: {len(exported)} rows, images copied: {copied}")
    print(f"-> {out}")


if __name__ == "__main__":
    main()
