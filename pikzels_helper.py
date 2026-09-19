"""
Pikzels v2 API helper — huấn luyện persona/style và tạo thumbnail.

Docs: https://docs.pikzels.com/
- Base URL : https://api.pikzels.com
- Auth     : header X-Api-Key: pkz_...
- Models   : pkz_2, pkz_3, pkz_4, pkz_4_5  (persona/style/prompt chỉ dùng pkz_4 / pkz_4_5)
- Format   : 16:9 | 9:16 | 1:1
- Lưu ý    : URL output HẾT HẠN sau 24h -> tải về ngay.

API key lấy theo thứ tự: tham số api_key -> biến môi trường PIKZELS_API_KEY -> pikzels_env.API_KEY
"""

import os
import time
import random
from pathlib import Path

import requests

BASE_URL = "https://api.pikzels.com"

MODELS = ("pkz_2", "pkz_3", "pkz_4", "pkz_4_5")
FORMATS = ("16:9", "9:16", "1:1")


def _load_api_key(api_key=None):
    if api_key:
        return api_key
    if os.environ.get("PIKZELS_API_KEY"):
        return os.environ["PIKZELS_API_KEY"]
    try:
        from pikzels_env import API_KEY  # tạo file pikzels/pikzels_env.py với API_KEY = "pkz_..."
        return API_KEY
    except Exception:
        raise RuntimeError(
            "Chưa có API key. Truyền api_key=..., đặt env PIKZELS_API_KEY, "
            "hoặc tạo pikzels/pikzels_env.py với API_KEY = 'pkz_...'."
        )


class PikzelsError(Exception):
    def __init__(self, message, code=None, request_id=None, status=None):
        super().__init__(message)
        self.code = code
        self.request_id = request_id
        self.status = status


class PikzelsClient:

    def __init__(self, api_key=None, base_url=BASE_URL, timeout=180,
                 max_retries=5):
        self.api_key = _load_api_key(api_key)
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.session = requests.Session()
        self.session.headers.update({
            "X-Api-Key": self.api_key,
            "Content-Type": "application/json",
        })

    # ---------------------------------------------------------------- core
    def _request(self, method, path, json_body=None):
        url = f"{self.base_url}{path}"
        for attempt in range(self.max_retries):
            resp = self.session.request(
                method, url, json=json_body, timeout=self.timeout
            )

            # 429 / 5xx -> exponential backoff + jitter (theo khuyến nghị docs)
            if resp.status_code == 429 or resp.status_code >= 500:
                if attempt < self.max_retries - 1:
                    wait = (2 ** attempt) + random.uniform(0, 1)
                    print(f"[pikzels] {resp.status_code} -> thử lại sau {wait:.1f}s "
                          f"(lần {attempt + 1}/{self.max_retries})")
                    time.sleep(wait)
                    continue

            try:
                data = resp.json()
            except ValueError:
                data = {}

            if not resp.ok:
                err = (data or {}).get("error", {}) if isinstance(data, dict) else {}
                raise PikzelsError(
                    err.get("message", resp.text or f"HTTP {resp.status_code}"),
                    code=err.get("code"),
                    request_id=(data or {}).get("request_id") if isinstance(data, dict) else None,
                    status=resp.status_code,
                )
            return data

        raise PikzelsError("Hết số lần thử lại", status=429)

    # ------------------------------------------------------- thumbnails
    def thumbnail_from_text(self, prompt, model="pkz_4_5", format="16:9",
                            support_image_url=None, support_image_base64=None,
                            persona=None, style=None):
        """POST /v2/thumbnail/text -> dict {model, output, prompt_compacted, request_id}"""
        body = {"prompt": prompt, "model": model, "format": format}
        if support_image_url:
            body["support_image_url"] = support_image_url
        if support_image_base64:
            body["support_image_base64"] = support_image_base64
        if persona:
            body["persona"] = persona
        if style:
            body["style"] = style
        return self._request("POST", "/v2/thumbnail/text", body)

    def thumbnail_from_image(self, image_url=None, image_base64=None,
                             model="pkz_4_5", format="16:9", prompt=None,
                             image_weight=None, support_image_url=None,
                             support_image_base64=None, persona=None, style=None):
        """POST /v2/thumbnail/image. image_url có thể là link YouTube watch."""
        if not (image_url or image_base64):
            raise ValueError("Cần image_url hoặc image_base64")
        body = {"model": model, "format": format}
        if image_url:
            body["image_url"] = image_url
        if image_base64:
            body["image_base64"] = image_base64
        if prompt:
            body["prompt"] = prompt
        if image_weight:  # low|medium|high, chỉ pkz_2
            body["image_weight"] = image_weight
        if support_image_url:
            body["support_image_url"] = support_image_url
        if support_image_base64:
            body["support_image_base64"] = support_image_base64
        if persona:
            body["persona"] = persona
        if style:
            body["style"] = style
        return self._request("POST", "/v2/thumbnail/image", body)

    def edit_thumbnail(self, prompt, image_url=None, image_base64=None,
                       format="16:9", mask_url=None, mask_base64=None,
                       support_image_url=None, support_image_base64=None):
        """POST /v2/thumbnail/edit (chỉnh sửa / inpaint bằng mask)."""
        if not (image_url or image_base64):
            raise ValueError("Cần image_url hoặc image_base64")
        body = {"prompt": prompt, "format": format}
        if image_url:
            body["image_url"] = image_url
        if image_base64:
            body["image_base64"] = image_base64
        if mask_url:
            body["mask_url"] = mask_url
        if mask_base64:
            body["mask_base64"] = mask_base64
        if support_image_url:
            body["support_image_url"] = support_image_url
        if support_image_base64:
            body["support_image_base64"] = support_image_base64
        return self._request("POST", "/v2/thumbnail/edit", body)

    def score_thumbnail(self, image_url=None, image_base64=None, title=None):
        """POST /v2/thumbnail/score -> main_score + subscores + suggestion."""
        if not (image_url or image_base64):
            raise ValueError("Cần image_url hoặc image_base64")
        body = {}
        if image_url:
            body["image_url"] = image_url
        if image_base64:
            body["image_base64"] = image_base64
        if title:
            body["title"] = title
        return self._request("POST", "/v2/thumbnail/score", body)

    def generate_titles(self, prompt=None, support_image_url=None,
                        support_image_base64=None):
        """POST /v2/title/text -> {outputs[], reasoning, prompt_compacted, request_id}.
        Cần ít nhất prompt HOẶC 1 ảnh tham chiếu (URL YouTube cũng được)."""
        if not (prompt or support_image_url or support_image_base64):
            raise ValueError("Cần prompt hoặc support_image")
        body = {}
        if prompt:
            body["prompt"] = prompt
        if support_image_url:
            body["support_image_url"] = support_image_url
        if support_image_base64:
            body["support_image_base64"] = support_image_base64
        return self._request("POST", "/v2/title/text", body)

    # ------------------------------------------------------- pikzonalities
    def create_persona(self, name, image_urls=None, image_base64s=None):
        """POST /v2/pikzonality/persona. Cần ĐÚNG 3 ảnh khuôn mặt. Async -> trả {id}."""
        return self._create_pikzonality("persona", name, image_urls, image_base64s)

    def create_style(self, name, image_urls=None, image_base64s=None):
        """POST /v2/pikzonality/style. Cần ĐÚNG 3 ảnh style. Async -> trả {id}."""
        return self._create_pikzonality("style", name, image_urls, image_base64s)

    def _create_pikzonality(self, kind, name, image_urls, image_base64s):
        body = {"name": name}
        if image_urls:
            if len(image_urls) != 3:
                raise ValueError("Cần đúng 3 ảnh (image_urls)")
            body["image_urls"] = image_urls
        elif image_base64s:
            if len(image_base64s) != 3:
                raise ValueError("Cần đúng 3 ảnh (image_base64s)")
            body["image_base64s"] = image_base64s
        else:
            raise ValueError("Cần image_urls hoặc image_base64s (đúng 3 ảnh)")
        return self._request("POST", f"/v2/pikzonality/{kind}", body)

    def get_pikzonality(self, pikzonality_id):
        """GET /v2/pikzonality/{id}. status: processing|completed|failed, progress 0-100."""
        return self._request("GET", f"/v2/pikzonality/{pikzonality_id}")

    def update_pikzonality(self, pikzonality_id, special_instructions):
        """Cập nhật special_instructions cho persona/style.
        TODO: docs không nêu rõ HTTP verb; đang giả định PATCH. Xác thực khi chạy thật."""
        return self._request(
            "PATCH", f"/v2/pikzonality/{pikzonality_id}",
            {"special_instructions": special_instructions},
        )

    def delete_pikzonality(self, pikzonality_id):
        return self._request("DELETE", f"/v2/pikzonality/{pikzonality_id}")

    def wait_pikzonality(self, pikzonality_id, poll_interval=5, timeout=600):
        """Poll đến khi completed/failed. Trả object cuối; raise nếu failed/timeout."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            obj = self.get_pikzonality(pikzonality_id)
            status = obj.get("status")
            progress = obj.get("progress")
            print(f"[pikzels] {pikzonality_id} status={status} progress={progress}")
            if status == "completed":
                return obj
            if status == "failed":
                raise PikzelsError(f"Pikzonality {pikzonality_id} thất bại",
                                   request_id=obj.get("request_id"))
            time.sleep(poll_interval)
        raise PikzelsError(f"Timeout chờ {pikzonality_id}")

    # --------------------------------------------------------- tiện ích
    def train_persona(self, name, image_urls=None, image_base64s=None,
                      special_instructions=None, **wait_kwargs):
        """Tạo persona + poll đến completed. Trả về persona_id."""
        res = self.create_persona(name, image_urls, image_base64s)
        pid = res["id"]
        self.wait_pikzonality(pid, **wait_kwargs)
        if special_instructions:
            self.update_pikzonality(pid, special_instructions)
        return pid

    def train_style(self, name, image_urls=None, image_base64s=None,
                    special_instructions=None, **wait_kwargs):
        """Tạo style + poll đến completed. Trả về style_id."""
        res = self.create_style(name, image_urls, image_base64s)
        sid = res["id"]
        self.wait_pikzonality(sid, **wait_kwargs)
        if special_instructions:
            self.update_pikzonality(sid, special_instructions)
        return sid

    @staticmethod
    def download(url, dest):
        """Tải ảnh output về đĩa NGAY (link chết sau 24h). Trả về đường dẫn."""
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        r = requests.get(url, timeout=180)
        r.raise_for_status()
        dest.write_bytes(r.content)
        print(f"[pikzels] saved {dest}")
        return str(dest)


if __name__ == "__main__":
    # Ví dụ nhanh — cần đặt PIKZELS_API_KEY hoặc pikzels/pikzels_env.py trước.
    client = PikzelsClient()

    # 1) Huấn luyện (bỏ comment khi có 3 ảnh thật)
    # persona_id = client.train_persona("My Face", image_urls=[
    #     "https://.../face1.jpg", "https://.../face2.jpg", "https://.../face3.jpg"])
    # style_id = client.train_style("Channel Style", image_urls=[
    #     "https://.../s1.jpg", "https://.../s2.jpg", "https://.../s3.jpg"])

    # 2) Tạo thumbnail từ text
    res = client.thumbnail_from_text(
        prompt="I bought my own island",
        model="pkz_4_5",
        format="16:9",
        # persona=persona_id, style=style_id,
    )
    print(res)

    # 3) Chấm điểm rồi tải về
    score = client.score_thumbnail(image_url=res["output"], title="I Bought My Own Island")
    print("Score:", score["main_score"], score["subscores"])
    client.download(res["output"], "output/thumbnail_01.png")
