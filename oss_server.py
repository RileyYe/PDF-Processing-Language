import secrets
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="OSS Service", description="独立的对象存储服务")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000", "http://127.0.0.1:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UploadResponse(BaseModel):
    success: bool
    message: str
    file_id: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """
    上传文件到OSS，返回8位随机ID
    """
    try:
        # 检查文件大小限制 (100MB)
        if file.size and file.size > 100 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="文件大小不能超过100MB")
        
        # 获取文件扩展名
        file_extension = ""
        if file.filename:
            file_extension = Path(file.filename).suffix.lower()
        
        # 生成8位随机ID
        file_id = secrets.token_hex(4)  # 生成8位十六进制字符串
        filename = f"{file_id}{file_extension}"
        
        # 确保uploads目录存在
        uploads_dir = Path("uploads")
        uploads_dir.mkdir(exist_ok=True)
        
        # 保存文件
        file_path = uploads_dir / filename
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # 构造下载URL
        download_url = f"http://localhost:9000/download/{filename}"
        
        return UploadResponse(
            success=True,
            message=f"文件上传成功！文件ID: {file_id}",
            file_id=file_id,
            download_url=download_url
        )
        
    except (OSError, ValueError, IOError) as e:
        return UploadResponse(
            success=False,
            message="文件上传失败",
            error=str(e)
        )

@app.get("/download/{filename}")
async def download_file(filename: str):
    """
    从OSS下载文件
    """
    file_path = Path("uploads") / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件未找到")
    
    # 根据文件扩展名设置正确的媒体类型
    media_type = "application/octet-stream"
    if filename.lower().endswith('.pdf'):
        media_type = "application/pdf"
    elif filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        media_type = f"image/{filename.split('.')[-1].lower()}"
    elif filename.lower().endswith('.txt'):
        media_type = "text/plain"
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type=media_type
    )

@app.get("/")
async def root():
    """
    OSS服务根路径
    """
    return {
        "message": "OSS Service",
        "version": "1.0.0",
        "description": "独立的对象存储服务",
        "endpoints": {
            "upload": "POST /upload - 上传文件",
            "download": "GET /download/{filename} - 下载文件"
        }
    }

@app.get("/health")
async def health_check():
    """
    健康检查
    """
    return {"status": "healthy", "service": "OSS"}

if __name__ == "__main__":
    import uvicorn
    print("启动OSS服务在端口9000...")
    uvicorn.run(app, host="0.0.0.0", port=9000)