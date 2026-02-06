import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path

app = FastAPI(title="Sho Reader")

# Đường dẫn đến thư mục chứa Light Novels
BASE_LN_PATH = Path("/home/ubuntu/.openclaw/workspace/projects/light-novels/active")

# Tự động xác định đường dẫn thư mục hiện tại
CURRENT_DIR = Path(__file__).parent

# Cấu hình Static và Templates dựa trên môi trường (Docker hay Local)
STATIC_DIR = CURRENT_DIR / "static"
TEMPLATES_DIR = CURRENT_DIR / "templates"

# Nếu không thấy ở root, thử tìm trong subfolder (để tương thích local workspace)
if not STATIC_DIR.exists():
    STATIC_DIR = CURRENT_DIR / "projects" / "shonovel-reader" / "static"
if not TEMPLATES_DIR.exists():
    TEMPLATES_DIR = CURRENT_DIR / "projects" / "shonovel-reader" / "templates"

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/library")
async def get_library():
    """Lấy danh sách các bộ truyện hiện có."""
    novels = []
    if not BASE_LN_PATH.exists():
        return novels
    
    for novel_dir in BASE_LN_PATH.iterdir():
        if novel_dir.is_dir():
            novels.append({
                "id": novel_dir.name,
                "title": novel_dir.name.replace("-", " ").title(),
                "path": str(novel_dir)
            })
    return novels

@app.get("/api/novel/{novel_id}/chapters")
async def get_chapters(novel_id: str):
    """Lấy danh sách chương của một bộ truyện."""
    chapter_path = BASE_LN_PATH / novel_id / "translated" / "vn"
    if not chapter_path.exists():
        raise HTTPException(status_code=404, detail="Novel chapters not found")
    
    chapters = []
    # Lấy danh sách file .txt và sắp xếp theo số chương
    files = sorted(chapter_path.glob("chapter-*.txt"), key=lambda x: int(x.stem.split("-")[-1]))
    for f in files:
        chapters.append({
            "id": f.stem,
            "title": f.stem.replace("-", " ").title()
        })
    return chapters

@app.get("/api/novel/{novel_id}/{chapter_id}")
async def get_chapter_content(novel_id: str, chapter_id: str):
    """Lấy nội dung chi tiết của một chương."""
    file_path = BASE_LN_PATH / novel_id / "translated" / "vn" / f"{chapter_id}.txt"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Chapter not found")
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    return {
        "id": chapter_id,
        "content": content
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
