"""Pikzels Thumbnail Studio — UI Streamlit gom mọi tính năng API Pikzels v2.

Chạy:  streamlit run app.py
"""
import json
from datetime import datetime
from pathlib import Path

import streamlit as st

import registry
import ui_utils
from pikzels_helper import PikzelsClient, PikzelsError, MODELS, FORMATS

OUTPUT_DIR = Path(__file__).parent / "output"

st.set_page_config(page_title="Pikzels Thumbnail Studio", page_icon="🖼️",
                   layout="wide", initial_sidebar_state="expanded")

# (key, icon, label)
NAV = [
    ("Create", "🎨", "Create"),
    ("Edit", "✏️", "Edit"),
    ("Score", "⭐", "Score"),
    ("Titles", "📝", "Titles"),
    ("Personas", "🧬", "Personas/Styles"),
    ("API", "⚙️", "Quản lý API"),
]


@st.cache_resource
def get_client():
    return PikzelsClient()


def err(e):
    st.error(f"{getattr(e, 'code', None) or 'ERROR'}: {e}")


def save_bytes(data, folder, kind, meta):
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
    dest = Path(folder).expanduser()
    dest.mkdir(parents=True, exist_ok=True)
    path = dest / f"{kind}_{ts}.png"
    path.write_bytes(data)
    registry.add_history(kind=kind, local_path=str(path), **meta)
    return str(path)


def persona_style_pickers(model, key_prefix):
    if model not in ("pkz_4", "pkz_4_5"):
        st.caption("Persona/Style chỉ dùng với pkz_4 hoặc pkz_4_5.")
        return None, None
    personas = registry.list_pikzonalities("persona")
    styles = registry.list_pikzonalities("style")
    persona_id = style_id = None
    c1, c2 = st.columns(2)
    with c1:
        opts = ["(none)"] + [f"{p['name']} · {p['id'][:8]}" for p in personas]
        sel = st.selectbox("Persona", opts, key=f"{key_prefix}_persona")
        if sel != "(none)":
            persona_id = personas[opts.index(sel) - 1]["id"]
    with c2:
        opts = ["(none)"] + [f"{s['name']} · {s['id'][:8]}" for s in styles]
        sel = st.selectbox("Style", opts, key=f"{key_prefix}_style")
        if sel != "(none)":
            style_id = styles[opts.index(sel) - 1]["id"]
    return persona_id, style_id


# ---------------------------------------------------------------- client
try:
    client = get_client()
    key_ok, key_err = True, None
except Exception as e:  # noqa: BLE001
    client, key_ok, key_err = None, False, e

st.session_state.setdefault("page", "Create")
st.session_state.setdefault("nav_collapsed", False)

# ---------------------------------------------------------------- sidebar nav (tab buttons)
collapsed = st.session_state["nav_collapsed"]
sb_width = 84 if collapsed else 300
st.markdown(f"""
<style>
[data-testid="stSidebar"] {{ min-width: {sb_width}px; max-width: {sb_width}px; }}
[data-testid="stSidebar"] .stButton > button {{ text-align: left; }}
</style>
""", unsafe_allow_html=True)

with st.sidebar:
    top = st.columns([1, 1]) if not collapsed else [st.container()]
    if not collapsed:
        top[0].markdown("### Pikzels")
        if top[1].button("«", help="Thu gọn", width="stretch"):
            st.session_state["nav_collapsed"] = True
            st.rerun()
    else:
        if st.button("»", help="Mở rộng", width="stretch"):
            st.session_state["nav_collapsed"] = False
            st.rerun()

    st.divider()
    for key, icon, label in NAV:
        active = st.session_state["page"] == key
        btn_label = icon if collapsed else f"{icon}  {label}"
        if st.button(btn_label, key=f"nav_{key}", width="stretch",
                     type="primary" if active else "secondary",
                     help=label if collapsed else None):
            st.session_state["page"] = key
            st.rerun()

    if not collapsed:
        st.divider()
        st.markdown("[📖 Docs](https://docs.pikzels.com/)")

page = st.session_state["page"]

# Giữ giá trị widget khi chuyển tab: Streamlit tự dọn key của widget không được
# render ở lần chạy hiện tại; "chạm" lại các key để giữ trạng thái form.
# Bỏ qua key của widget ĐÃ render phía trên (nút nav) — không được sửa sau khi khởi tạo.
for _k in list(st.session_state.keys()):
    if _k.startswith("nav_") or _k in ("page", "nav_collapsed"):
        continue
    st.session_state[_k] = st.session_state[_k]

if not key_ok and page != "API":
    st.warning("Chưa nạp được API key — vào tab ⚙️ Quản lý API.")


# ================================================================ API
def page_api():
    st.subheader("⚙️ Quản lý API")
    if key_ok:
        st.success("Đã nạp API key.")
        st.text_input("API key", value=ui_utils.mask_key(client.api_key), disabled=True)
        st.text_input("Base URL", value=client.base_url, disabled=True)
        if st.button("🔌 Test kết nối", type="primary"):
            try:
                client.generate_titles(prompt="test")
                st.success("Kết nối OK.")
            except PikzelsError as e:
                if e.status in (401, 403):
                    err(e)
                else:
                    st.success("Kết nối OK (API phản hồi).")
            except Exception as e:  # noqa: BLE001
                err(e)
    else:
        st.error(f"Chưa nạp được API key: {key_err}")
        st.markdown("Tạo file `pikzels_env.py` với `API_KEY = 'pkz_...'` "
                    "hoặc đặt biến môi trường `PIKZELS_API_KEY`, rồi khởi động lại app.")


# ================================================================ CREATE
def render_create_grid(results, meta):
    """Vẽ lưới kết quả (persist) với Download + Score mỗi ô."""
    st.divider()
    st.markdown(f"### Kết quả ({len(results)} ảnh)")
    folder = st.text_input("Folder lưu (Windows)", value=str(OUTPUT_DIR), key="create_folder")
    if st.button("💾 Lưu tất cả vào folder", key="create_save_all"):
        paths = [save_bytes(r["bytes"], folder, "create",
                            {**meta, "request_id": r["res"]["request_id"],
                             "model": r["res"].get("model")}) for r in results]
        st.success(f"Đã lưu {len(paths)} ảnh vào {folder}")

    scores = st.session_state.setdefault("create_scores", {})
    per_row = 3
    for start in range(0, len(results), per_row):
        cols = st.columns(per_row)
        for j, col in enumerate(cols):
            idx = start + j
            if idx >= len(results):
                break
            r = results[idx]
            with col:
                if r["res"].get("prompt_compacted"):
                    st.caption("⚠️ prompt bị rút gọn")
                st.image(r["bytes"], width="stretch")
                st.download_button("⬇️ Download", r["bytes"],
                                   file_name=f"thumbnail_{idx + 1}.png", mime="image/png",
                                   key=f"dl_{idx}", width="stretch")
                if st.button("⭐ Score", key=f"sc_{idx}", width="stretch"):
                    try:
                        scores[idx] = client.score_thumbnail(image_url=r["res"]["output"])
                    except PikzelsError as e:
                        err(e)
                if idx in scores:
                    sc = scores[idx]
                    st.metric("Score", sc["main_score"])
                    st.caption(" · ".join(f"{k}:{v}" for k, v in sc["subscores"].items()))
                    if sc.get("suggestion"):
                        st.caption(sc["suggestion"])


def page_create():
    st.subheader("🎨 Tạo thumbnail")
    source = st.radio("Nguồn", ["Text", "Image"], horizontal=True, key="create_src")
    c1, c2, c3 = st.columns([2, 2, 1])
    with c1:
        model = st.selectbox("Model", MODELS, index=MODELS.index("pkz_4_5"), key="create_model")
    with c2:
        fmt = st.selectbox("Format", FORMATS, key="create_fmt")
    with c3:
        count = st.slider("Số lượng", 1, 10, 1, key="create_count")

    prompt = st.text_area("Prompt", height=150, key="create_prompt",
                          placeholder="Mô tả thumbnail...")
    n = len(prompt)
    (st.warning if n > 750 else st.caption)(
        f"{n} ký tự" + (" — sẽ bị rút gọn (>750)!" if n > 750 else ""))

    persona_id, style_id = persona_style_pickers(model, "create")

    with st.expander("Ảnh tham chiếu (support image, chỉ pkz_4/4_5)"):
        sup_up = st.file_uploader("Upload", type=["png", "jpg", "jpeg", "webp"], key="create_sup_up")
        sup_url = st.text_input("hoặc URL (YouTube watch cũng được)", key="create_sup_url")

    img_up = img_url = weight = None
    if source == "Image":
        st.markdown("**Ảnh gốc** (bắt buộc)")
        img_up = st.file_uploader("Upload ảnh gốc", type=["png", "jpg", "jpeg", "webp"],
                                  key="create_img_up")
        img_url = st.text_input("hoặc URL ảnh gốc", key="create_img_url")
        if model == "pkz_2":
            weight = st.selectbox("image_weight (pkz_2)", ["(none)", "low", "medium", "high"])
            weight = None if weight == "(none)" else weight

    go = st.button(f"🚀 Tạo {count} ảnh", type="primary", key="create_go")

    if go:
        try:
            support = ui_utils.resolve_support(sup_up, sup_url)
            common = dict(model=model, format=fmt, persona=persona_id, style=style_id, **support)
            img = ui_utils.resolve_image(img_up, img_url) if source == "Image" else {}
            if source == "Text" and not prompt.strip():
                st.error("Cần prompt."); st.stop()
            if source == "Image" and not img:
                st.error("Cần ảnh gốc (upload hoặc URL)."); st.stop()

            meta = {"prompt": prompt, "format": fmt, "style": style_id, "persona": persona_id}
            # --- lưới loading: N ô placeholder + spinner ---
            st.markdown(f"#### Đang tạo {count} ảnh...")
            prog = st.progress(0.0, text="Bắt đầu...")
            placeholders, per_row = [], 3
            for start in range(0, count, per_row):
                cols = st.columns(per_row)
                for j in range(per_row):
                    if start + j < count:
                        ph = cols[j].empty()
                        ph.info("⏳ Đang tạo...")
                        placeholders.append(ph)

            results = []
            for i in range(count):
                if source == "Text":
                    res = client.thumbnail_from_text(prompt=prompt, **common)
                else:
                    res = client.thumbnail_from_image(
                        prompt=prompt or None, image_weight=weight, **img, **common)
                data = ui_utils.fetch_bytes(res["output"])
                results.append({"res": res, "bytes": data})
                placeholders[i].image(data, caption=f"#{i + 1}", width="stretch")
                prog.progress((i + 1) / count, text=f"Đã tạo {i + 1}/{count}")

            st.session_state["create_results"] = results
            st.session_state["create_meta"] = meta
            st.session_state["create_scores"] = {}
            st.rerun()  # vẽ lại lưới persist có Download/Score
        except PikzelsError as e:
            err(e)

    # Lưới kết quả persist (giữ khi chuyển tab & quay lại)
    results = st.session_state.get("create_results")
    if results:
        render_create_grid(results, st.session_state.get("create_meta", {}))


# ================================================================ EDIT
def page_edit():
    st.subheader("✏️ Chỉnh sửa / inpaint")
    hist = [h for h in registry.load_history() if h.get("local_path")]
    hist_opts = ["(none)"] + [f"{h['kind']} · {Path(h['local_path']).name}" for h in hist]
    pick = st.selectbox("Chọn từ lịch sử", hist_opts, key="edit_hist")
    e_up = st.file_uploader("hoặc upload ảnh", type=["png", "jpg", "jpeg", "webp"], key="edit_up")
    e_url = st.text_input("hoặc URL ảnh", key="edit_url")
    e_prompt = st.text_area("Prompt sửa", height=100, key="edit_prompt")
    e_fmt = st.selectbox("Format", FORMATS, key="edit_fmt")
    with st.expander("Mask (vùng inpaint) + support image (tùy chọn)"):
        m_up = st.file_uploader("Mask upload", type=["png", "jpg", "jpeg"], key="edit_mask_up")
        m_url = st.text_input("hoặc Mask URL", key="edit_mask_url")
        es_up = st.file_uploader("Support upload", type=["png", "jpg", "jpeg", "webp"], key="edit_sup_up")
        es_url = st.text_input("hoặc Support URL", key="edit_sup_url")

    if st.button("✏️ Sửa", type="primary", key="edit_go"):
        try:
            img = ui_utils.resolve_image(e_up, e_url)
            if not img and pick != "(none)":
                local = hist[hist_opts.index(pick) - 1]["local_path"]
                img = {"image_base64": ui_utils.bytes_to_data_url(
                    Path(local).read_bytes(), "image/png")}
            if not img:
                st.error("Cần chọn/nhập ảnh gốc."); st.stop()
            mask = ui_utils.resolve_mask(m_up, m_url)
            support = ui_utils.resolve_support(es_up, es_url)
            with st.spinner("Đang sửa..."):
                res = client.edit_thumbnail(prompt=e_prompt, format=e_fmt, **img, **mask, **support)
            st.session_state["edit_res"] = {"res": res, "bytes": ui_utils.fetch_bytes(res["output"])}
        except PikzelsError as e:
            err(e)

    r = st.session_state.get("edit_res")
    if r:
        if r["res"].get("prompt_compacted"):
            st.caption("⚠️ prompt bị rút gọn")
        st.image(r["bytes"], width="stretch")
        st.download_button("⬇️ Download", r["bytes"], file_name="edited.png",
                           mime="image/png", key="edit_dl")


# ================================================================ SCORE
def page_score():
    st.subheader("⭐ Chấm điểm thumbnail")
    s_up = st.file_uploader("Upload ảnh", type=["png", "jpg", "jpeg", "webp"], key="score_up")
    s_url = st.text_input("hoặc URL ảnh", key="score_url")
    s_title = st.text_input("Title (tùy chọn)", key="score_title")
    if st.button("⭐ Chấm điểm", type="primary", key="score_go"):
        try:
            img = ui_utils.resolve_image(s_up, s_url)
            if not img:
                st.error("Cần ảnh (upload hoặc URL)."); st.stop()
            with st.spinner("Đang chấm..."):
                sc = client.score_thumbnail(title=s_title or None, **img)
            st.session_state["score_res"] = sc
        except PikzelsError as e:
            err(e)
    sc = st.session_state.get("score_res")
    if sc:
        st.metric("Main score", sc["main_score"])
        cols = st.columns(len(sc["subscores"]))
        for col, (k, v) in zip(cols, sc["subscores"].items()):
            col.metric(k, v)
        if sc.get("suggestion"):
            st.info(sc["suggestion"])


# ================================================================ TITLES
def page_titles():
    st.subheader("📝 Sinh tiêu đề")
    t_prompt = st.text_area("Prompt / mô tả video", height=100, key="titles_prompt")
    t_up = st.file_uploader("Ảnh tham chiếu (tùy chọn)", type=["png", "jpg", "jpeg", "webp"], key="titles_up")
    t_url = st.text_input("hoặc URL ảnh/YouTube (tùy chọn)", key="titles_url")
    if st.button("📝 Sinh titles", type="primary", key="titles_go"):
        try:
            support = ui_utils.resolve_support(t_up, t_url)
            if not (t_prompt.strip() or support):
                st.error("Cần prompt hoặc ảnh tham chiếu."); st.stop()
            with st.spinner("Đang sinh..."):
                st.session_state["titles_res"] = client.generate_titles(
                    prompt=t_prompt or None, **support)
        except PikzelsError as e:
            err(e)
    res = st.session_state.get("titles_res")
    if res:
        for tt in res.get("outputs", []):
            st.code(tt, language=None)
        if res.get("reasoning"):
            with st.expander("Reasoning"):
                st.write(res["reasoning"])


# ================================================================ PIKZONALITIES
def page_pikz():
    st.subheader("🧬 Persona / Style — huấn luyện & quản lý")

    with st.expander("➕ Tạo mới (cần đúng 3 ảnh)", expanded=False):
        mode = st.radio("Loại", ["style", "persona"], horizontal=True, key="pk_mode")
        name = st.text_input("Tên (1-25 ký tự)", key="pk_name")
        st.caption("3 ảnh — upload file HOẶC dán 3 URL (mỗi dòng 1 URL).")
        ups = st.file_uploader("Upload 3 ảnh", type=["png", "jpg", "jpeg", "webp"],
                               accept_multiple_files=True, key="pk_ups")
        urls_raw = st.text_area("hoặc 3 URL (mỗi dòng 1)", height=90, key="pk_urls")
        instr = st.text_area("Special instructions (tùy chọn)", height=70, key="pk_instr")
        if st.button("🧬 Train", type="primary", key="pk_go"):
            urls = [u.strip() for u in urls_raw.splitlines() if u.strip()]
            try:
                kwargs = {}
                if ups and len(ups) == 3:
                    kwargs["image_base64s"] = [ui_utils.uploaded_to_data_url(u) for u in ups]
                elif len(urls) == 3:
                    kwargs["image_urls"] = urls
                else:
                    st.error("Cần đúng 3 ảnh (upload hoặc URL)."); st.stop()
                if not name.strip():
                    st.error("Cần tên."); st.stop()
                fn = client.create_style if mode == "style" else client.create_persona
                with st.spinner("Đang gửi..."):
                    r = fn(name, **kwargs)
                registry.add_pikzonality(r["id"], name, mode, status="processing")
                if instr.strip():
                    client.update_pikzonality(r["id"], instr)
                    registry.set_instructions(r["id"], instr)
                st.success(f"Đã tạo {mode} id={r['id']}. Bấm Refresh để cập nhật trạng thái.")
            except PikzelsError as e:
                err(e)

    st.divider()
    st.markdown("### Danh sách")
    items = registry.load_pikzonalities()
    style_json = Path(__file__).parent / "style_id.json"
    if style_json.exists() and st.button("⬇️ Import style_id.json (kéo cả instructions)"):
        d = json.loads(style_json.read_text())
        sid = d["style_id"]
        registry.add_pikzonality(sid, d.get("name", "imported"), "style", status="unknown")
        try:
            obj = client.get_pikzonality(sid)
            registry.update_pikzonality(sid, status=obj.get("status"),
                                        portrait_url=obj.get("portrait_url"))
            if obj.get("special_instructions"):
                registry.set_instructions(sid, obj["special_instructions"])
        except PikzelsError as e:
            err(e)
        st.rerun()

    if not items:
        st.caption("Chưa có persona/style. Tạo ở trên hoặc import style_id.json.")

    for it in items:
        with st.container(border=True):
            c1, c2, c3 = st.columns([3, 1, 1])
            with c1:
                st.write(f"**{it['name']}** · `{it['mode']}` · status: `{it.get('status')}`")
                st.caption(it["id"])
                if it.get("portrait_url"):
                    st.image(it["portrait_url"], width=120)
            with c2:
                if st.button("🔄 Refresh", key=f"ref_{it['id']}"):
                    try:
                        obj = client.get_pikzonality(it["id"])
                        registry.update_pikzonality(it["id"], status=obj.get("status"),
                                                    portrait_url=obj.get("portrait_url"))
                        if obj.get("special_instructions"):
                            registry.set_instructions(it["id"], obj["special_instructions"])
                        st.rerun()
                    except PikzelsError as e:
                        err(e)
            with c3:
                if st.button("🗑️ Delete", key=f"del_{it['id']}"):
                    try:
                        client.delete_pikzonality(it["id"])
                    except PikzelsError as e:
                        err(e)
                    registry.remove_pikzonality(it["id"])
                    st.rerun()

            new_instr = st.text_area("Special instructions", value=it.get("special_instructions") or "",
                                     key=f"instr_{it['id']}", height=80)
            if st.button("💾 Lưu (tạo version mới)", key=f"upd_{it['id']}"):
                try:
                    client.update_pikzonality(it["id"], new_instr)
                    registry.set_instructions(it["id"], new_instr)
                    st.success("Đã cập nhật + lưu version.")
                    st.rerun()
                except PikzelsError as e:
                    err(e)

            versions = it.get("instruction_versions", [])
            if versions:
                with st.expander(f"🕘 Lịch sử ({len(versions)} version)"):
                    for vi in range(len(versions) - 1, -1, -1):
                        v = versions[vi]
                        tag = f"v{vi + 1} · {v['at']}"
                        if "restored_from" in v:
                            tag += f" (khôi phục từ v{v['restored_from'] + 1})"
                        st.caption(tag)
                        st.code(v["text"] or "(trống)", language=None)
                        if vi != len(versions) - 1:
                            if st.button("↩️ Khôi phục bản này", key=f"rst_{it['id']}_{vi}"):
                                text = registry.restore_instruction(it["id"], vi)
                                try:
                                    client.update_pikzonality(it["id"], text)
                                except PikzelsError as e:
                                    err(e)
                                st.rerun()


PAGE_FUNCS = {
    "Create": page_create, "Edit": page_edit, "Score": page_score,
    "Titles": page_titles, "Personas": page_pikz, "API": page_api,
}
PAGE_FUNCS[page]()
