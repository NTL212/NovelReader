import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path

app = FastAPI(title="Sho Reader")

# Đường dẫn đến thư mục chứa Light Novels
BASE_LN_PATH = Path("/home/ubuntu/.openclaw/workspace/projects/light-novels/active")

# Xác định thư mục gốc của ứng dụng (nơi chứa app.py)
BASE_DIR = Path(__file__).resolve().parent

# Cấu hình Static và Templates
# Trong Docker, BASE_DIR sẽ là /app
# Thư mục static và templates sẽ nằm ngay tại /app/static và /app/templates
static_dir = BASE_DIR / "static"
templates_dir = BASE_DIR / "templates"

if not static_dir.exists():
    # Fallback cho môi trường local workspace
    static_dir = BASE_DIR / "projects" / "shonovel-reader" / "static"
if not templates_dir.exists():
    templates_dir = BASE_DIR / "projects" / "shonovel-reader" / "templates"

app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
templates = Jinja2Templates(directory=str(templates_dir))

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
    files = sorted(chapter_path.glob("chapter-*.txt"), key=lambda x: int(x.stem.split("-")[-1]) if x.stem.split("-")[-1].isdigit() else 0)
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
