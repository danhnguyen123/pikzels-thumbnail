"""Tạo thumbnail 'DUG TOO DEEP' theo style đã train (style_id.json)."""
import json
from pathlib import Path
from pikzels_helper import PikzelsClient

client = PikzelsClient()
style_id = json.loads(Path("style_id.json").read_text())["style_id"]

# Prompt 'evidence mosaic' nén <750 ký tự (style lo phần nét vẽ).
PROMPT = (
    "Archaeological evidence mosaic, one-artist line-art, alternating warm/cool "
    "and close/medium/wide. Black top bar, huge white uppercase 'DUG TOO DEEP'. "
    "2x5 grid, thin dividers, uppercase label each tile: "
    "1 GREAT ORME wide teal hillside mine cutaway; "
    "2 CHEHRABAD close salt-preserved miner, ivory; "
    "3 LION CAVERN miner hitting red ochre wall; "
    "4 WADI EL-HUDI wide giant stela, tiny man, anomaly, blue-gray; "
    "5 HALLSTATT wooden stair blocked by salt, amber; "
    "6 SPIENNES top-down deep circular shaft, tiny skeleton, anomaly; "
    "7 GRIMES GRAVES giant antler pick, dog skeleton, bronze; "
    "8 KRZEMIONKI hand holding flint axe, neutral; "
    "9 DUZDAGI two workers with salt baskets, gold; "
    "10 KESTEL researcher at silver-gold ore vein, teal."
)
print("Prompt length:", len(PROMPT))

res = client.thumbnail_from_text(
    prompt=PROMPT, model="pkz_4_5", format="16:9", style=style_id
)
print("compacted:", res["prompt_compacted"], "| URL:", res["output"])

score = client.score_thumbnail(image_url=res["output"], title="10 Ancient Mines - Dug Too Deep")
print("Score:", score["main_score"], score["subscores"])
print("Suggestion:", score.get("suggestion"))

client.download(res["output"], "output/dug_too_deep_02.png")
