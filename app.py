import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from pymongo import MongoClient

app = FastAPI(title="Sho Reader")

# Cấu hình MongoDB
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://loint2101_db_user:Lcz2TWDTbWfSqJna@cluster0.cdad8y0.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
DB_NAME = "shonovel_db"
client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db["chapters"]
novel_meta_collection = db["novels"] # Collection mới cho metadata truyện

# Xác định thư mục gốc của ứng dụng (nơi chứa app.py)
BASE_DIR = Path(__file__).resolve().parent

# Tìm thư mục static và templates một cách linh hoạt
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

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    try:
        return templates.TemplateResponse("index.html", {"request": request})
    except Exception as e:
        return HTMLResponse(content=f"Error loading template: {str(e)}", status_code=500)

@app.get("/api/library")
async def get_library():
    """Lấy danh sách các bộ truyện từ DB kèm metadata."""
    novel_ids = collection.distinct("novel_id")
    novels = []
    for nid in novel_ids:
        # Lấy thêm tags/info từ novel_meta_collection nếu có
        meta = novel_meta_collection.find_one({"novel_id": nid}, {"_id": 0})
        novels.append({
            "id": nid,
            "title": nid.replace("-", " ").title(),
            "tags": meta.get("tags", []) if meta else [],
            "source": "database"
        })
    return novels

@app.get("/api/novel/{novel_id}/chapters")
async def get_chapters(novel_id: str):
    """Lấy danh sách chương từ MongoDB."""
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
        raise HTTPException(status_code=404, detail="Novel not found in database")
    return chapters

@app.get("/api/novel/{novel_id}/{chapter_id}")
async def get_chapter_content(novel_id: str, chapter_id: str):
    """Lấy nội dung chi tiết của một chương từ MongoDB."""
    try:
        chapter_num = int(chapter_id.split("-")[-1])
    except (ValueError, IndexError):
        raise HTTPException(status_code=400, detail="Invalid chapter ID format")

    doc = collection.find_one(
        {"novel_id": novel_id, "chapter_number": chapter_num},
        {"content": 1, "title": 1, "_id": 0}
    )
    
    if not doc:
        raise HTTPException(status_code=404, detail="Chapter not found in database")
    
    return {
        "id": chapter_id,
        "title": doc.get("title"),
        "content": doc.get("content")
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
