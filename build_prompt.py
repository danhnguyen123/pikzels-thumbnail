"""Build + đo prompt thumbnail 'evidence mosaic' <750 ký tự (style lo phần nét vẽ)."""

# Câu định nghĩa mosaic + luân phiên góc/màu, nén tối đa.
LEAD = ("Archaeological evidence mosaic, one-artist line-art, alternating warm/cool "
        "and close/medium/wide. Black top bar, huge white uppercase 'DUG TOO DEEP'. "
        "2x5 grid, thin dividers, uppercase label each tile: ")

# [nhãn] [góc/chủ thể] [màu] — mỗi ô 1 loại bằng chứng khác nhau, 2 ô anomaly.
TILES = [
    "1 GREAT ORME wide teal hillside mine cutaway",
    "2 CHEHRABAD close salt-preserved miner, ivory",
    "3 LION CAVERN miner hitting red ochre wall",
    "4 WADI EL-HUDI wide giant stela, tiny man, anomaly, blue-gray",
    "5 HALLSTATT wooden stair blocked by salt, amber",
    "6 SPIENNES top-down deep circular shaft, tiny skeleton, anomaly",
    "7 GRIMES GRAVES giant antler pick, dog skeleton, bronze",
    "8 KRZEMIONKI hand holding flint axe, neutral",
    "9 DUZDAGI two workers with salt baskets, gold",
    "10 KESTEL researcher at silver-gold ore vein, teal",
]

PROMPT = LEAD + "; ".join(TILES) + "."
print("LEN:", len(PROMPT))
print(PROMPT)
