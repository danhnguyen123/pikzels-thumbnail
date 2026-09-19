"""Train một style Pikzels từ 3 ảnh thumbnail đối thủ trong refs/."""
import base64
import json
import mimetypes
from pathlib import Path

from pikzels_helper import PikzelsClient

REFS = ["refs/1.jpg", "refs/2.jpg", "refs/3.jpg"]
STYLE_NAME = "Ancient Sealed"
OUT = "style_id.json"


def to_data_url(path):
    mime = mimetypes.guess_type(path)[0] or "image/jpeg"
    b64 = base64.b64encode(Path(path).read_bytes()).decode()
    return f"data:{mime};base64,{b64}"


client = PikzelsClient()

images = [to_data_url(p) for p in REFS]
print(f"Training style '{STYLE_NAME}' from {len(images)} images...")

style_id = client.train_style(
    STYLE_NAME,
    image_base64s=images,
    special_instructions=(
        "Dark ancient-mystery YouTube thumbnail: bold white uppercase headline across the top, "
        "a grid of ten small ornately-framed panels of eerie ancient/underground sites, "
        "torch-lit high-contrast cinematic lighting, weathered stone textures, muted earthy tones."
    ),
    poll_interval=6,
    timeout=900,
)

print("STYLE_ID =", style_id)
Path(OUT).write_text(json.dumps({"style_id": style_id, "name": STYLE_NAME}, indent=2))
print(f"Saved to {OUT}")
