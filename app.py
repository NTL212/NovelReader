import os
import json
import redis.asyncio as redis
from fastapi import FastAPI, Request, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from pymongo import MongoClient
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Sho Reader")

# --- Cấu hình Database ---
DEFAULT_MONGO_URI = "mongodb+srv://loint2101_db_user:Lcz2TWDTbWfSqJna@cluster0.cdad8y0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
MONGO_URI = os.getenv("MONGO_URI", DEFAULT_MONGO_URI)
DB_NAME = "shonovel_db"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["chapters"]
novel_meta_collection = db["novels"]
lore_collection = db["lore"] # Collection cho Wiki Ngữ Cảnh

# Cấu hình Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# --- Pydantic Models cho Lore System ---
class LoreStep(BaseModel):
    min_chapter: int
    content: str

class LoreResponse(BaseModel):
    entity_id: str
    name: str
    type: str
    visible_description: str
    spoiler_free_steps: List[LoreStep]

# --- Cấu hình File System ---
BASE_DIR = Path(__file__).resolve().parent

def find_path(dir_name: str):
    local_path = BASE_DIR / dir_name
    if local_path.exists():
        return local_path
    return local_path

static_dir = find_path("static")
templates_dir = find_path("templates")

os.makedirs(static_dir, exist_ok=True)
os.makedirs(templates_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
templates = Jinja2Templates(directory=str(templates_dir))

# --- API Endpoints ---

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        return HTMLResponse(content=f"Error loading template: {str(e)}", status_code=500)

@app.get("/api/library")
async def get_library():
    """Lấy danh sách các bộ truyện từ DB kèm metadata (Cached)."""
    CACHE_KEY = "library:novels_list"
    try:
        cached_data = await redis_client.get(CACHE_KEY)
        if cached_data:
            return json.loads(cached_data)
    except Exception:
        pass

    novel_ids = collection.distinct("novel_id")
    metas_cursor = novel_meta_collection.find(
        {"novel_id": {"$in": novel_ids}},
        {"_id": 0, "novel_id": 1, "tags": 1}
    )
    meta_map = {doc["novel_id"]: doc for doc in metas_cursor}
    
    novels = []
    for nid in novel_ids:
        meta = meta_map.get(nid)
        novels.append({
            "id": nid,
            "title": nid.replace("-", " ").title(),
            "tags": meta.get("tags", []) if meta else [],
            "source": "database"
        })
    
    try:
        await redis_client.setex(CACHE_KEY, 600, json.dumps(novels))
    except Exception:
        pass
    
    return novels

@app.get("/api/novel/{novel_id}/chapters")
async def get_chapters(novel_id: str):
    cursor = collection.find(
        {"novel_id": novel_id},
        {"chapter_number": 1, "title": 1, "_id": 0}
    ).sort("chapter_number", 1)
    
    chapters = []
    for doc in cursor:
        chapters.append({
            "id": f"chapter-{doc['chapter_number']}",
            "title": doc.get("title", f"Chương {doc['chapter_number']}")
        })
    
    if not chapters:
        raise HTTPException(status_code=404, detail="Novel not found")
    return chapters

@app.get("/api/novel/{novel_id}/{chapter_id}")
async def get_chapter_content(novel_id: str, chapter_id: str):
    CACHE_KEY = f"novel:{novel_id}:content:{chapter_id}"
    try:
        cached_data = await redis_client.get(CACHE_KEY)
        if cached_data:
            return json.loads(cached_data)
    except Exception:
        pass

    try:
        chapter_num = int(chapter_id.split("-")[-1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid chapter ID")

    doc = collection.find_one(
        {"novel_id": novel_id, "chapter_number": chapter_num},
        {"content": 1, "title": 1, "_id": 0}
    )
    
    if not doc:
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    response_data = {
        "id": chapter_id,
        "title": doc.get("title"),
        "content": doc.get("content")
    }

    try:
        await redis_client.setex(CACHE_KEY, 86400, json.dumps(response_data))
    except Exception:
        pass
    
    return response_data

# --- TÍNH NĂNG MỚI: WIKI NGỮ CẢNH CHỐNG SPOILER ---
@app.get("/api/lore/{novel_id}/{entity_id}", response_model=LoreResponse)
async def get_contextual_lore(
    novel_id: str, 
    entity_id: str, 
    current_chapter: int = Query(..., ge=0)
):
    """Lấy thông tin Wiki nhân vật/thuật ngữ không bị spoiler dựa trên chương đang đọc."""
    cache_key = f"lore:{novel_id}:{entity_id}:{current_chapter}"

    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
    except Exception:
        pass

    entity = lore_collection.find_one(
        {"novel_id": novel_id, "entity_id": entity_id},
        {"_id": 0} 
    )

    if not entity:
        raise HTTPException(status_code=404, detail="Lore entity not found")

    # Lọc nội dung dựa trên tiến độ đọc (Anti-Spoiler)
    allowed_steps = [
        step for step in entity.get("description_steps", [])
        if step["min_chapter"] <= current_chapter
    ]
    allowed_steps.sort(key=lambda x: x["min_chapter"])

    full_text = "\n\n".join([step["content"] for step in allowed_steps])

    response_payload = {
        "entity_id": entity["entity_id"],
        "name": entity["name"],
        "type": entity.get("type", "unknown"),
        "visible_description": full_text,
        "spoiler_free_steps": allowed_steps
    }

    try:
        await redis_client.setex(cache_key, 3600, json.dumps(response_payload))
    except Exception:
        pass

    return response_payload

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
