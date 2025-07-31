import os
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Optional
import requests

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from parser_pdfl_v2 import parse_and_execute

app = FastAPI(title="PDF-PL API", description="PDF Processing Language - 声明式PDF处理管道语言")

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # 前端开发服务器
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ExecuteRequest(BaseModel):
    command: str

class ExecuteResponse(BaseModel):
    success: bool
    message: str
    output_file: Optional[str] = None
    download_url: Optional[str] = None
    error: Optional[str] = None


@app.post("/execute")
async def execute_command(request: ExecuteRequest):
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
        
        # 将zip文件移动到输出目录以便下载
        final_zip_path = Path("output") / zip_filename
        final_zip_path.parent.mkdir(exist_ok=True)
        shutil.move(zip_path, final_zip_path)
        
        # 上传到OSS服务
        try:
            with open(final_zip_path, 'rb') as f:
                files = {'file': (zip_filename, f, 'application/zip')}
                response = requests.post('http://localhost:9000/upload', files=files, timeout=30)
                
            if response.status_code == 200:
                oss_data = response.json()
                if oss_data.get('success'):
                    # 上传成功，删除本地文件
                    os.remove(final_zip_path)
                    
                    return ExecuteResponse(
                        success=True,
                        message=f"管道执行成功！生成了 {files_count} 个文件，已上传到OSS。",
                        output_file=zip_filename,
                        download_url=oss_data.get('download_url')
                    )
                else:
                    # OSS上传失败，返回本地文件
                    return ExecuteResponse(
                        success=True,
                        message=f"管道执行成功！生成了 {files_count} 个文件。(OSS上传失败，使用本地文件)",
                        output_file=zip_filename
                    )
            else:
                # OSS服务响应错误，返回本地文件
                return ExecuteResponse(
                    success=True,
                    message=f"管道执行成功！生成了 {files_count} 个文件。(OSS服务不可用，使用本地文件)",
                    output_file=zip_filename
                )
        except (requests.exceptions.RequestException, IOError) as e:
            # OSS上传出现异常，返回本地文件
            return ExecuteResponse(
                success=True,
                message=f"管道执行成功！生成了 {files_count} 个文件。(OSS上传异常：{str(e)}，使用本地文件)",
                output_file=zip_filename
            )
        
    except (OSError, ValueError, RuntimeError) as e:
        # 恢复原工作目录
        os.chdir(original_cwd)
        
        # 清理临时目录
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        
        # 返回错误响应
        return ExecuteResponse(
            success=False,
            message="管道执行失败",
            error=str(e)
        )

@app.get("/")
async def root():
    """
    API 根路径
    """
    return {
        "message": "PDF-PL API Server",
        "version": "1.0.0",
        "description": "PDF Processing Language - 声明式PDF处理管道语言 API 服务",
        "frontend": "前端服务运行在 http://localhost:3000",
        "docs": "/docs",
        "redoc": "/redoc"
    }

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

@app.get("/download/{filename}")
async def download_file(filename: str):
    """
    下载生成的文件
    """
    file_path = Path("output") / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件未找到")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/zip"
    )


@app.get("/health")
async def health_check():
    """
    健康检查
    """
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
