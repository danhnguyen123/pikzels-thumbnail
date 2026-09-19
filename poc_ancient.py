"""POC: tạo thumbnail phong cách 'ancient sealed sites' giống đối thủ (Hướng A - text prompt)."""
from pikzels_helper import PikzelsClient

client = PikzelsClient()

PROMPT = (
    "YouTube thumbnail, dark ancient mystery style. A large bold headline at the very top "
    "in thick white uppercase condensed sans-serif with a black outline reading "
    "'NEVER OPENED AGAIN'. Below it, a grid of ten small framed panels, each with an ornate "
    "stone border, showing eerie ancient sites: sealed tomb doors, carved stone gates, "
    "underground crypt corridors, hieroglyph vaults, dark cave entrances. Cinematic torch-lit "
    "lighting, deep shadows, muted earthy browns, teal and gold tones, weathered stone texture, "
    "high contrast, dramatic and ominous mood, ultra detailed."
)

res = client.thumbnail_from_text(prompt=PROMPT, model="pkz_4_5", format="16:9")
print("Model:", res["model"], "| compacted:", res["prompt_compacted"])
print("Output URL:", res["output"])

score = client.score_thumbnail(image_url=res["output"], title="10 Ancient Sites Permanently Sealed")
print("Score:", score["main_score"], score["subscores"])
print("Suggestion:", score.get("suggestion"))

client.download(res["output"], "output/poc_ancient_01.png")
