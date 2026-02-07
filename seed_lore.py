from pymongo import MongoClient
import os

# Cấu hình
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://loint2101_db_user:Lcz2TWDTbWfSqJna@cluster0.cdad8y0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
client = MongoClient(MONGO_URI)
db = client["shonovel_db"]
lore_col = db["lore"]

# Dữ liệu mẫu cho bộ Kurasu de Nibanme (Cô nàng dễ thương nhì lớp)
lore_data = [
    {
        "novel_id": "kurasu-de-nibanme",
        "entity_id": "char_asanagi",
        "name": "Asanagi Umi",
        "type": "character",
        "description_steps": [
            {
                "min_chapter": 1,
                "content": "Một cô gái xinh đẹp, sắc sảo và là 'cô nàng dễ thương nhì lớp'. Cô có tính cách thẳng thắn, thực tế và thích chơi game."
            },
            {
                "min_chapter": 5,
                "content": "Thích ghé thăm nhà của Maehara Maki sau giờ học để cùng chơi game và ăn tối. Cô dần bộc lộ khía cạnh nữ tính và dịu dàng hơn khi ở riêng với Maki."
            },
            {
                "min_chapter": 30,
                "content": "Mối quan hệ với Maki đã tiến triển vượt mức tình bạn thông thường. Cô bắt đầu coi nhà Maki như một 'nơi chốn thuộc về' của mình."
            }
        ]
    },
    {
        "novel_id": "kurasu-de-nibanme",
        "entity_id": "char_maehara",
        "name": "Maehara Maki",
        "type": "character",
        "description_steps": [
            {
                "min_chapter": 1,
                "content": "Một nam sinh trung học bình thường, thích sống tách biệt và không quá nổi bật trong lớp."
            },
            {
                "min_chapter": 3,
                "content": "Trở thành người bạn bí mật của Asanagi Umi. Anh là một đầu bếp giỏi và thường xuyên nấu ăn cho Umi."
            }
        ]
    }
]

# Insert dữ liệu
lore_col.delete_many({"novel_id": "kurasu-de-nibanme"})
lore_col.insert_many(lore_data)

print("✅ Đã nạp dữ liệu Lore mẫu thành công!")
