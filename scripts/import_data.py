"""Khôi phục personas/styles (+ history) vào DB trên server từ thư mục export.

Chạy trên SERVER (Ubuntu), TRỎ ĐÚNG volume, và DỪNG container trước để tránh ghi trùng:

    cd /opt/package-studio
    docker compose down
    DATA_DIR=/mnt/media/package-studio/data \
    OUTPUT_DIR=/mnt/media/package-studio/output \
      python3 scripts/import_data.py backup/export
    docker compose up -d

Chỉ cần python3 (registry dùng stdlib, không cần pip). Idempotent:
- personas/styles đã có (theo id) -> bỏ qua.
- history đã có (theo request_id) -> bỏ qua.
"""
import json
import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import registry  # noqa: E402


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("backup/export")
    out_dir = Path(os.environ.get("OUTPUT_DIR", "output"))
    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"DATA_DIR={registry.DATA_DIR}  OUTPUT_DIR={out_dir}")

    # ---- personas / styles ----
    pikz = json.loads((src / "pikzonalities.json").read_text(encoding="utf-8"))
    added = 0
    for it in pikz:
        if registry.get_pikzonality(it["id"]):
            continue
        registry.add_pikzonality(it["id"], it["name"], it["mode"],
                                 status=it.get("status") or "completed")
        registry.update_pikzonality(
            it["id"],
            portrait_url=it.get("portrait_url"),
            special_instructions=it.get("special_instructions"),
            instruction_versions=it.get("instruction_versions") or [],
        )
        added += 1
    print(f"pikzonalities imported: {added}/{len(pikz)}")

    # ---- history (tùy chọn) ----
    hpath = src / "history.json"
    if hpath.is_file():
        hist = json.loads(hpath.read_text(encoding="utf-8"))
        rows = imgs = 0
        for h in reversed(hist):  # đảo để ảnh mới nhất có hid lớn nhất (giữ thứ tự)
            rid = h.get("request_id")
            if rid and registry.history_exists(rid):
                continue
            entry = {k: v for k, v in h.items() if k != "file"}
            fname = h.get("file")
            if fname and (src / "output" / fname).is_file():
                dst = out_dir / fname
                try:
                    shutil.copy2(src / "output" / fname, dst)
                    imgs += 1
                    entry["local_path"] = str(dst)
                except Exception:  # noqa: BLE001
                    entry["local_path"] = None
            registry.add_history(**entry)
            rows += 1
        print(f"history imported: {rows} rows, images: {imgs}")


if __name__ == "__main__":
    main()
