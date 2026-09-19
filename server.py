"""FastAPI backend cho Pikzels Studio — REST + WebSocket, reuse PikzelsClient + registry.

Chạy:  python -m uvicorn server:app --port 8000
Hoặc:  python server.py   (tự chạy uvicorn + serve webui/dist)
"""
import base64
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import registry
import ui_utils
from pricing import PRICING
from pikzels_helper import PikzelsClient, PikzelsError, MODELS, FORMATS

BASE = Path(__file__).parent
DIST = BASE / "webui" / "dist"
OUTPUT_DIR = BASE / "output"

app = FastAPI(title="Pikzels Studio API")

try:
    client: Optional[PikzelsClient] = PikzelsClient()
    KEY_ERR = None
except Exception as e:  # noqa: BLE001
    client, KEY_ERR = None, str(e)


def need_client():
    if client is None:
        raise HTTPException(503, f"API key chưa cấu hình: {KEY_ERR}")
    return client


def to_http(e: PikzelsError):
    return HTTPException(e.status or 502, str(e))


# ---------------------------------------------------------------- models
class TextReq(BaseModel):
    prompt: str
    model: str = "pkz_4_5"
    format: str = "16:9"
    persona: Optional[str] = None
    style: Optional[str] = None
    support_image_url: Optional[str] = None
    support_image_base64: Optional[str] = None


class ImageReq(TextReq):
    prompt: Optional[str] = None  # optional cho image
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    image_weight: Optional[str] = None


class EditReq(BaseModel):
    prompt: str
    format: str = "16:9"
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    mask_url: Optional[str] = None
    mask_base64: Optional[str] = None
    support_image_url: Optional[str] = None
    support_image_base64: Optional[str] = None


class ScoreReq(BaseModel):
    image_url: Optional[str] = None
    image_base64: Optional[str] = None
    title: Optional[str] = None


class TitlesReq(BaseModel):
    prompt: Optional[str] = None
    support_image_url: Optional[str] = None
    support_image_base64: Optional[str] = None


class PikzReq(BaseModel):
    mode: str  # style | persona
    name: str
    image_urls: Optional[list[str]] = None
    image_base64s: Optional[list[str]] = None
    special_instructions: Optional[str] = None


class InstrReq(BaseModel):
    special_instructions: str


class SaveReq(BaseModel):
    image_url: str
    folder: Optional[str] = None
    kind: str = "create"
    meta: dict = {}


# ---------------------------------------------------------------- config / util
@app.get("/api/config")
def config():
    return {
        "key_ok": client is not None,
        "key_masked": ui_utils.mask_key(client.api_key) if client else None,
        "base_url": client.base_url if client else None,
        "key_error": KEY_ERR,
        "models": list(MODELS),
        "formats": list(FORMATS),
        "pricing": PRICING,
    }


@app.get("/api/image")
def proxy_image(url: str, download: int = 0):
    """Proxy ảnh Pikzels (tránh CORS) + LOẠI BỎ metadata lạ trước khi trả về."""
    try:
        data = ui_utils.strip_metadata(ui_utils.fetch_bytes(url))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Không tải được ảnh: {e}")
    headers = {"Content-Disposition": "attachment; filename=thumbnail.png"} if download else {}
    return Response(content=data, media_type="image/png", headers=headers)


@app.post("/api/save")
def save_image(req: SaveReq):
    from datetime import datetime
    data = ui_utils.strip_metadata(ui_utils.fetch_bytes(req.image_url))
    folder = Path(req.folder).expanduser() if req.folder else OUTPUT_DIR
    folder.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
    path = folder / f"{req.kind}_{ts}.png"
    path.write_bytes(data)
    # Dedup: chỉ thêm history nếu request_id chưa có (tránh trùng khi vừa Download vừa Lưu tất cả).
    rid = req.meta.get("request_id")
    if not registry.history_exists(rid):
        registry.add_history(kind=req.kind, local_path=str(path),
                             output_url=req.image_url, **req.meta)
    return {"path": str(path)}


# ---------------------------------------------------------------- thumbnails
@app.post("/api/thumbnail/text")
def thumb_text(req: TextReq):
    try:
        return need_client().thumbnail_from_text(**req.model_dump())
    except PikzelsError as e:
        raise to_http(e)


@app.post("/api/thumbnail/image")
def thumb_image(req: ImageReq):
    try:
        return need_client().thumbnail_from_image(**req.model_dump())
    except PikzelsError as e:
        raise to_http(e)


@app.post("/api/thumbnail/edit")
def thumb_edit(req: EditReq):
    try:
        return need_client().edit_thumbnail(**req.model_dump())
    except PikzelsError as e:
        raise to_http(e)


@app.post("/api/thumbnail/score")
def thumb_score(req: ScoreReq):
    try:
        return need_client().score_thumbnail(**req.model_dump())
    except PikzelsError as e:
        raise to_http(e)


@app.post("/api/titles")
def titles(req: TitlesReq):
    try:
        return need_client().generate_titles(**req.model_dump())
    except PikzelsError as e:
        raise to_http(e)


# ---------------------------------------------------------------- pikzonalities
@app.get("/api/pikzonalities")
def list_pikz():
    return registry.load_pikzonalities()


@app.post("/api/pikzonalities")
def create_pikz(req: PikzReq):
    c = need_client()
    try:
        fn = c.create_style if req.mode == "style" else c.create_persona
        r = fn(req.name, image_urls=req.image_urls, image_base64s=req.image_base64s)
        registry.add_pikzonality(r["id"], req.name, req.mode, status="processing")
        if req.special_instructions:
            c.update_pikzonality(r["id"], req.special_instructions)
            registry.set_instructions(r["id"], req.special_instructions)
        return registry.get_pikzonality(r["id"])
    except PikzelsError as e:
        raise to_http(e)


@app.post("/api/pikzonalities/{pid}/refresh")
def refresh_pikz(pid: str):
    c = need_client()
    try:
        obj = c.get_pikzonality(pid)
        registry.update_pikzonality(pid, status=obj.get("status"),
                                    portrait_url=obj.get("portrait_url"))
        if obj.get("special_instructions"):
            registry.set_instructions(pid, obj["special_instructions"])
        return registry.get_pikzonality(pid)
    except PikzelsError as e:
        raise to_http(e)


@app.patch("/api/pikzonalities/{pid}")
def update_instr(pid: str, req: InstrReq):
    c = need_client()
    try:
        c.update_pikzonality(pid, req.special_instructions)
        registry.set_instructions(pid, req.special_instructions)
        return registry.get_pikzonality(pid)
    except PikzelsError as e:
        raise to_http(e)


@app.post("/api/pikzonalities/{pid}/restore/{index}")
def restore_instr(pid: str, index: int):
    text = registry.restore_instruction(pid, index)
    try:
        if text is not None:
            need_client().update_pikzonality(pid, text)
    except PikzelsError as e:
        raise to_http(e)
    return registry.get_pikzonality(pid)


@app.delete("/api/pikzonalities/{pid}")
def delete_pikz(pid: str):
    try:
        need_client().delete_pikzonality(pid)
    except PikzelsError:
        pass
    registry.remove_pikzonality(pid)
    return {"ok": True}


# ---------------------------------------------------------------- history
@app.get("/api/history")
def history(limit: int = 24, offset: int = 0,
            style: Optional[str] = None, persona: Optional[str] = None,
            favorite: int = 0, date_from: Optional[str] = None, date_to: Optional[str] = None):
    return registry.query_history(limit=limit, offset=offset, style=style, persona=persona,
                                  favorite=bool(favorite), date_from=date_from, date_to=date_to)


@app.get("/api/history/{hid}/image")
def history_image(hid: int):
    entry = registry.get_history_entry(hid)
    if not entry or not entry.get("local_path"):
        raise HTTPException(404, "Not found")
    p = Path(entry["local_path"])
    if not p.is_file():
        raise HTTPException(404, "File missing")
    return FileResponse(p, media_type="image/png")


class FavReq(BaseModel):
    favorite: bool


@app.post("/api/history/{hid}/favorite")
def history_favorite(hid: int, req: FavReq):
    return {"favorite": registry.set_favorite(hid, req.favorite)}


class HScoreReq(BaseModel):
    request_id: str
    score: int


@app.post("/api/history/score")
def history_score(req: HScoreReq):
    registry.set_history_score(req.request_id, req.score)
    return {"ok": True}


def _delete_one(hid: int):
    entry = registry.get_history_entry(hid)
    if entry and entry.get("local_path"):
        try:
            Path(entry["local_path"]).unlink(missing_ok=True)
        except Exception:  # noqa: BLE001
            pass
    registry.remove_history(hid)


@app.delete("/api/history/{hid}")
def history_delete(hid: int):
    _delete_one(hid)
    return {"ok": True}


class DelReq(BaseModel):
    hids: list[int]


@app.post("/api/history/delete")
def history_delete_bulk(req: DelReq):
    for hid in req.hids:
        _delete_one(hid)
    return {"deleted": len(req.hids)}


@app.post("/api/history/{hid}/score")
def history_score_one(hid: int):
    """Chấm điểm 1 ảnh trong Gallery (đọc file local -> Pikzels score) + lưu điểm."""
    entry = registry.get_history_entry(hid)
    if not entry or not entry.get("local_path"):
        raise HTTPException(404, "Not found")
    p = Path(entry["local_path"])
    if not p.is_file():
        raise HTTPException(404, "File missing")
    data_url = "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()
    try:
        sc = need_client().score_thumbnail(image_base64=data_url)
    except PikzelsError as e:
        raise to_http(e)
    registry.set_score_hid(hid, sc["main_score"])
    return sc


# ---------------------------------------------------------------- WebSocket batch generate
@app.websocket("/ws/generate")
async def ws_generate(ws: WebSocket):
    await ws.accept()
    try:
        req = await ws.receive_json()
        c = client
        if c is None:
            await ws.send_json({"type": "error", "message": f"API key: {KEY_ERR}"})
            return
        count = int(req.get("count", 1))
        source = req.get("source", "Text")
        common = dict(model=req.get("model", "pkz_4_5"), format=req.get("format", "16:9"),
                      persona=req.get("persona") or None, style=req.get("style") or None,
                      support_image_url=req.get("support_image_url") or None,
                      support_image_base64=req.get("support_image_base64") or None)
        await ws.send_json({"type": "start", "total": count})
        import anyio
        for i in range(count):
            try:
                if source == "Image":
                    res = await anyio.to_thread.run_sync(
                        lambda: c.thumbnail_from_image(
                            prompt=req.get("prompt") or None,
                            image_url=req.get("image_url") or None,
                            image_base64=req.get("image_base64") or None,
                            image_weight=req.get("image_weight") or None, **common))
                else:
                    res = await anyio.to_thread.run_sync(
                        lambda: c.thumbnail_from_text(prompt=req["prompt"], **common))
                await ws.send_json({"type": "item", "index": i, "total": count,
                                    "output": res["output"], "request_id": res["request_id"],
                                    "model": res.get("model"),
                                    "prompt_compacted": res.get("prompt_compacted", False)})
            except PikzelsError as e:
                await ws.send_json({"type": "item_error", "index": i, "message": str(e),
                                    "code": e.code})
        await ws.send_json({"type": "done"})
    except WebSocketDisconnect:
        pass
    except Exception as e:  # noqa: BLE001
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


# ---------------------------------------------------------------- serve SPA
if DIST.exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        f = DIST / full_path
        if full_path and f.is_file():
            return FileResponse(f)
        # index.html không cache để UI luôn cập nhật sau khi rebuild (assets có hash vẫn cache tốt).
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-cache"})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
