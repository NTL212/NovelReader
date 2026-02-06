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

# Tìm thư mục static và templates một cách linh hoạt
def find_path(dir_name: str):
    # Ưu tiên kiểm tra cùng cấp với app.py (Docker style)
    local_path = BASE_DIR / dir_name
    if local_path.exists():
        return local_path
    
    # Check trong thư mục project (Workspace style)
    workspace_path = BASE_DIR / "projects" / "shonovel-reader" / dir_name
    if workspace_path.exists():
        return workspace_path
    
    # Fallback cuối cùng
    return local_path

static_dir = find_path("static")
templates_dir = find_path("templates")

print(f"DEBUG: Using static_dir={static_dir}")
print(f"DEBUG: Using templates_dir={templates_dir}")

# Đảm bảo thư mục tồn tại để tránh crash khi khởi động
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
