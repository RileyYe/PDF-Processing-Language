import os
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from parser_pdfl import parse_and_execute

app = FastAPI(title="PDF-PL API", description="PDF Processing Language - 声明式PDF处理管道语言")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生产环境中应该指定具体的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 托管静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")

class ParseRequest(BaseModel):
    command: str

class ParseResponse(BaseModel):
    message: str
    output_dir: str
    files_count: int

@app.post("/parse")
async def parse_command(request: ParseRequest):
    """
    解析并执行PDF-PL管道命令，返回处理结果的压缩包
    
    PDF-PL语法示例:
    Load{url:"https://example.com/file.pdf"} | Select{mode:"each"} | PNG{dpi:300} | Save{name:"output"}
    """
    if not request.command.strip():
        raise HTTPException(status_code=400, detail="管道命令不能为空")
    
    # 创建临时目录用于存储处理结果
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_dir = tempfile.mkdtemp(prefix=f"pdflang_{timestamp}_")
    
    try:
        # 临时修改工作目录到临时目录，这样输出文件会保存到临时目录
        original_cwd = os.getcwd()
        os.chdir(temp_dir)
        
        # 执行命令
        parse_and_execute(request.command)
        
        # 检查输出目录
        output_path = Path(temp_dir) / "output"
        if not output_path.exists():
            raise HTTPException(status_code=404, detail="管道执行后未找到输出文件")
        
        # 统计生成的文件数量
        files_count = sum(1 for file_path in output_path.rglob("*") if file_path.is_file())
        
        if files_count == 0:
            raise HTTPException(status_code=404, detail="管道执行后未生成任何文件")
        
        # 创建压缩包
        zip_filename = f"pdflang_output_{timestamp}.zip"
        zip_path = Path(temp_dir) / zip_filename
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in output_path.rglob("*"):
                if file_path.is_file():
                    # 保持相对路径结构
                    arcname = file_path.relative_to(output_path)
                    zipf.write(file_path, arcname)
        
        # 恢复原工作目录
        os.chdir(original_cwd)
        
        # 返回zip文件
        return FileResponse(
            path=zip_path,
            filename=zip_filename,
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename={zip_filename}",
                "X-Files-Count": str(files_count)
            }
        )
        
    except Exception as e:
        # 恢复原工作目录
        os.chdir(original_cwd)
        
        # 清理临时目录
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        
        # 抛出HTTP异常
        raise HTTPException(status_code=500, detail=f"{str(e)}")

@app.get("/")
async def root():
    """
    根路径，返回前端页面
    """
    with open("static/index.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    return HTMLResponse(content=html_content)

@app.get("/api")
async def api_info():
    """
    API信息路径
    """
    return {
        "message": "PDF-PL API",
        "version": "1.0.0",
        "description": "PDF Processing Language - 声明式PDF处理管道语言",
        "syntax_examples": [
            'Load{url:"https://example.com/file.pdf"} | Select{mode:"each"} | PNG{dpi:300} | Save{name:"output"}',
            'Load{url:"https://example.com/file.pdf"} | Select{where:"$page % 2 == 1"} | Concat | Save{name:"odd_pages"}',
            'Load{url:"https://example.com/file.pdf"} | Select{pages:"1,$total"} | Save{name:"cover_and_back"}'
        ],
        "commands": {
            "Load": "生成器 - 加载PDF文件",
            "Select": "转换器 - 选择页面（分流器）",
            "Concat": "转换器 - 合并文档（聚合器）",
            "PNG": "转换器 - 转换为PNG图像",
            "Save": "消费者 - 保存结果为ZIP文件"
        },
        "endpoints": {
            "parse": "POST /parse - 解析并执行PDF-PL管道",
            "health": "GET /health - 健康检查",
            "frontend": "GET / - 前端界面"
        }
    }

@app.get("/health")
async def health_check():
    """
    健康检查
    """
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
