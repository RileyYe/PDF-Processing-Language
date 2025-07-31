import re
import os
import zipfile
import tempfile
from typing import List, Dict, Any, Optional, Union
from abc import ABC, abstractmethod
from enum import Enum
from pathlib import Path

from main import PDF, PDFList


class StreamState(Enum):
    """流状态枚举"""
    SINGLE = "SingleStream"  # 单一、完整的文档
    MULTI = "MultiStream"   # 有序的、独立的文档/页面集合


class Stream:
    """流对象，包含内容和状态"""

    def __init__(self, content: Union[PDF, PDFList], state: StreamState):
        self.content = content
        self.state = state

    def __repr__(self):
        return f"Stream(state={self.state.value}, content_type={type(self.content).__name__})"


class Command(ABC):
    """命令抽象基类"""

    def __init__(self, name: str, params: Optional[Dict[str, Any]] = None):
        self.name = name
        self.params = params or {}

    @abstractmethod
    def execute(self, input_stream: Optional[Stream]) -> Stream:
        """执行命令，返回新的流"""
        pass


class Generator(Command):
    """生成器命令：创建初始流"""
    pass


class Transformer(Command):
    """转换器命令：接收一个流，输出一个新流"""
    pass


class Consumer(Command):
    """消费者命令：终止管道或执行带有副作用的操作"""
    pass


class LoadCommand(Generator):
    """Load命令：通过URL加载PDF文件"""

    def execute(self, input_stream: Optional[Stream]) -> Stream:
        if input_stream is not None:
            raise ValueError("Load命令只能作为管道的第一个命令")

        url = self.params.get('url')
        if not url:
            raise ValueError("Load命令需要url参数")

        pdf = PDF(url)
        return Stream(pdf, StreamState.SINGLE)


class SelectCommand(Transformer):
    """Select命令：从单一文档中选择页面（分流器）"""

    def execute(self, input_stream: Stream) -> Stream:
        if input_stream.state != StreamState.SINGLE:
            raise ValueError("Select命令只能应用于SingleStream")

        pdf = input_stream.content

        # 根据参数类型选择处理方式
        if 'mode' in self.params:
            # Select{mode="each"}
            if self.params['mode'] == 'each':
                pdf_list = pdf.split_pages()
                return Stream(pdf_list, StreamState.MULTI)
            else:
                raise ValueError(f"不支持的mode值: {self.params['mode']}")

        elif 'pages' in self.params:
            # Select{pages="1,3,5"} 或 Select{pages="1..3,5..7"}
            pages = self._parse_pages_string(
                self.params['pages'], pdf.get_page_count())
            selected_pdf_list = PDFList(
                [pdf.get_single_page(p) for p in pages])
            return Stream(selected_pdf_list, StreamState.MULTI)

        elif 'where' in self.params:
            # Select{where="$page % 2 == 0"}
            condition = self.params['where']
            pages = self._evaluate_condition(condition, pdf.get_page_count())
            selected_pdf_list = PDFList(
                [pdf.get_single_page(p) for p in pages])
            return Stream(selected_pdf_list, StreamState.MULTI)

        else:
            raise ValueError("Select命令需要mode、pages或where参数")

    def _parse_pages_string(self, pages_str: str, total_pages: int) -> List[int]:
        """解析页面字符串，支持逗号和空格分隔"""
        pages = []
        # 支持逗号和空格作为分隔符
        parts = re.split(r'[,\s]+', pages_str.strip())
        parts = [p for p in parts if p]  # 移除空字符串

        for part in parts:
            if '..' in part:
                # 范围格式 "1..3"
                start, end = map(int, part.split('..'))
                pages.extend(range(start - 1, end))  # 转换为0-based
            elif part == '$total':
                # 动态变量
                pages.append(total_pages - 1)  # 最后一页，0-based
            else:
                # 单页
                pages.append(int(part) - 1)  # 转换为0-based

        return sorted(list(set(pages)))

    def _evaluate_condition(self, condition: str, total_pages: int) -> List[int]:
        """评估条件表达式"""
        pages = []
        for page_num in range(1, total_pages + 1):  # 1-based页码
            # 替换变量
            expr = condition.replace('$page', str(page_num))
            expr = expr.replace('$total', str(total_pages))

            # 安全的表达式求值
            if self._is_safe_expression(expr):
                try:
                    if eval(expr):
                        pages.append(page_num - 1)  # 转换为0-based
                except:
                    continue

        return pages

    def _is_safe_expression(self, expr: str) -> bool:
        """检查表达式是否安全"""
        allowed_chars = set('0123456789+-*/%() ==!=<>&|')
        return all(c in allowed_chars for c in expr)


class ConcatCommand(Transformer):
    """Concat命令：将多文档流合并成单一文档（聚合器）"""

    def execute(self, input_stream: Stream) -> Stream:
        if input_stream.state != StreamState.MULTI:
            raise ValueError("Concat命令只能应用于MultiStream")

        pdf_list = input_stream.content
        
        # 检查是否有图像数据需要合并
        has_images = any(hasattr(pdf, '_images') and pdf._images for pdf in pdf_list)
        
        if has_images:
            # 合并图像数据
            merged_pdf = self._merge_images(pdf_list)
        else:
            # 合并PDF数据
            merged_pdf = pdf_list.merge()
            
        return Stream(merged_pdf, StreamState.SINGLE)
    
    def _merge_images(self, pdf_list) -> 'PDF':
        """合并PDF列表中的图像数据，保持最高质量"""
        from PIL import Image
        
        all_images = []
        # 收集所有图像
        for pdf in pdf_list:
            if hasattr(pdf, '_images') and pdf._images:
                all_images.extend(pdf._images)
        
        if not all_images:
            raise ValueError("没有找到可合并的图像数据")
        
        if len(all_images) == 1:
            # 只有一个图像，直接返回
            result_pdf = PDF(b'')  # 创建空PDF对象
            result_pdf._images = all_images
            return result_pdf
        
        # 分析图像特征，选择最佳模式
        first_image = all_images[0]
        
        # 确定最合适的图像模式
        if first_image.mode == 'RGBA' or any(img.mode == 'RGBA' for img in all_images):
            target_mode = 'RGBA'
            background_color = (255, 255, 255, 255)  # 白色背景，完全不透明
        elif first_image.mode == 'RGB' or any(img.mode == 'RGB' for img in all_images):
            target_mode = 'RGB'
            background_color = (255, 255, 255)  # 白色背景
        else:
            # 其他模式统一转为RGB
            target_mode = 'RGB'
            background_color = (255, 255, 255)
        
        # 计算合并后图像的尺寸
        max_width = max(img.width for img in all_images)
        total_height = sum(img.height for img in all_images)
        
        # 创建新的高质量空白图像
        merged_image = Image.new(target_mode, (max_width, total_height), background_color)
        
        # 保持DPI信息（使用第一个图像的DPI）
        if hasattr(first_image, 'info') and 'dpi' in first_image.info:
            merged_image.info['dpi'] = first_image.info['dpi']
            print(f"✓ 保持原始DPI设置: {first_image.info['dpi']}")
        else:
            print("⚠ 警告: 无法获取原始图像的DPI信息")
        
        # 将所有图像垂直拼接，保持原始质量
        y_offset = 0
        for img in all_images:
            # 确保图像模式一致，避免质量损失
            if img.mode != target_mode:
                if target_mode == 'RGBA' and img.mode == 'RGB':
                    # RGB转RGBA，添加alpha通道
                    img = img.convert('RGBA')
                elif target_mode == 'RGB' and img.mode == 'RGBA':
                    # RGBA转RGB，使用白色背景合成
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[-1])  # 使用alpha通道作为mask
                    img = background
                else:
                    img = img.convert(target_mode)
            
            # 高质量粘贴（居中对齐）
            x_offset = (max_width - img.width) // 2
            merged_image.paste(img, (x_offset, y_offset))
            y_offset += img.height
        
        # 创建新的PDF对象并存储合并后的图像
        result_pdf = PDF(b'')  # 创建空PDF对象
        result_pdf._images = [merged_image]
        
        dpi_info = merged_image.info.get('dpi', '未设置')
        print(f"✓ 已合并 {len(all_images)} 个图像为单个高质量图像 ({merged_image.width}x{merged_image.height}, {target_mode}, DPI: {dpi_info})")
        return result_pdf


class PNGCommand(Transformer):
    """PNG命令：将流中的每个文档转换为PNG图像格式（一对一）"""

    def execute(self, input_stream: Stream) -> Stream:
        dpi = self.params.get('dpi', 150)
        mode = self.params.get('mode', 'auto')  # auto, single, pages

        if input_stream.state == StreamState.SINGLE:
            # 单一文档转换为PNG
            pdf = input_stream.content
            page_count = pdf.get_page_count()

            if mode == 'single' or (mode == 'auto' and page_count > 1):
                # 多页PDF转换为单一合并PNG图像
                pdf.to_single_png(dpi=dpi)
            else:
                # 转换为多个PNG图像（每页一个）
                pdf.to_png(dpi=dpi)

            return Stream(pdf, StreamState.SINGLE)

        elif input_stream.state == StreamState.MULTI:
            # 多文档流，每个文档转换为PNG
            pdf_list = input_stream.content
            for pdf in pdf_list:
                if mode == 'single':
                    pdf.to_single_png(dpi=dpi)
                else:
                    pdf.to_png(dpi=dpi)
            return Stream(pdf_list, StreamState.MULTI)

        else:
            raise ValueError(f"PNG命令不支持流状态: {input_stream.state}")


class SaveCommand(Consumer):
    """Save命令：将管道处理的最终结果打包成ZIP文件"""

    def execute(self, input_stream: Stream) -> Stream:
        name = self.params.get('name', 'output')

        # 创建临时目录
        with tempfile.TemporaryDirectory() as temp_dir:
            if input_stream.state == StreamState.SINGLE:
                # 单一文档
                pdf = input_stream.content
                if hasattr(pdf, '_images') and pdf._images:
                    # 如果是图像数据，保存为PNG
                    pdf.save_images(temp_dir, name)
                else:
                    # 保存为PDF
                    pdf.save(temp_dir, f"{name}.pdf")

            elif input_stream.state == StreamState.MULTI:
                # 多文档流
                pdf_list = input_stream.content
                for i, pdf in enumerate(pdf_list):
                    if hasattr(pdf, '_images') and pdf._images:
                        # 保存为图像
                        pdf.save_images(temp_dir, f"{name}_{i+1:02d}")
                    else:
                        # 保存为PDF
                        pdf.save(temp_dir, f"{name}_{i+1:02d}.pdf")

            # 创建ZIP文件
            output_dir = "./output"
            os.makedirs(output_dir, exist_ok=True)
            zip_path = os.path.join(output_dir, f"{name}.zip")

            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for root, dirs, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, temp_dir)
                        zipf.write(file_path, arcname)

            print(f"✓ 结果已保存到: {zip_path}")

        return input_stream  # 消费者不改变流


# === 解析器 ===

class PDFLParser:
    """PDF-PL语法解析器"""

    # 命令注册表
    COMMANDS = {
        'Load': LoadCommand,
        'Select': SelectCommand,
        'Concat': ConcatCommand,
        'PNG': PNGCommand,
        'Save': SaveCommand,
    }

    def parse(self, pipeline_text: str) -> List[Command]:
        """解析管道文本为命令列表"""
        pipeline_text = pipeline_text.strip()
        if not pipeline_text:
            raise ValueError("管道不能为空")

        # 分割管道
        command_strings = [cmd.strip() for cmd in pipeline_text.split('|')]
        commands = []

        for cmd_str in command_strings:
            command = self._parse_command(cmd_str)
            commands.append(command)

        # 验证管道结构
        self._validate_pipeline(commands)

        return commands

    def _parse_command(self, cmd_str: str) -> Command:
        """解析单个命令"""
        # 匹配命令格式: IDENTIFIER{param1=value1,param2=value2}
        match = re.match(r'(\w+)(?:\{([^}]*)\})?', cmd_str.strip())
        if not match:
            raise ValueError(f"无效的命令格式: {cmd_str}")

        name, params_str = match.groups()

        # 检查命令是否存在
        if name not in self.COMMANDS:
            raise ValueError(f"未知命令: {name}")

        # 解析参数
        params = self._parse_parameters(params_str) if params_str else {}

        # 创建命令实例
        command_class = self.COMMANDS[name]
        return command_class(name, params)

    def _parse_parameters(self, params_str: str) -> Dict[str, Any]:
        """解析参数字符串"""
        params = {}
        if not params_str:
            return params

        # 分割参数
        param_pairs = [p.strip() for p in params_str.split(',')]
        print(param_pairs)
        for pair in param_pairs:
            if ':' not in pair:
                raise ValueError(f"无效的参数格式: {pair}")

            key, value = pair.split(':', 1)
            key = key.strip()
            value = value.strip()

            # 解析值
            params[key] = self._parse_value(value)

        return params

    def _parse_value(self, value_str: str) -> Any:
        """解析参数值"""
        value_str = value_str.strip()

        # 字符串值（带引号）
        if (value_str.startswith('"') and value_str.endswith('"')) or \
           (value_str.startswith("'") and value_str.endswith("'")):
            return value_str[1:-1]  # 移除引号

        # 布尔值
        if value_str.lower() == 'true':
            return True
        elif value_str.lower() == 'false':
            return False

        # 数字值（只有当字符串只包含数字、小数点和负号时才尝试解析为数字）
        if re.match(r'^-?\d+(\.\d+)?$', value_str):
            try:
                if '.' in value_str:
                    return float(value_str)
                else:
                    return int(value_str)
            except ValueError:
                pass

        # 默认为字符串
        return value_str

    def _validate_pipeline(self, commands: List[Command]):
        """验证管道结构"""
        if not commands:
            raise ValueError("管道不能为空")

        # 第一个命令必须是生成器
        if not isinstance(commands[0], Generator):
            raise ValueError("管道的第一个命令必须是生成器（如Load）")

        # 后续命令不能是生成器
        for cmd in commands[1:]:
            if isinstance(cmd, Generator):
                raise ValueError("生成器命令只能作为管道的第一个命令")


# === 执行引擎 ===

class PDFLExecutor:
    """PDF-PL执行引擎"""

    def execute(self, commands: List[Command]) -> Stream:
        """执行命令管道"""
        current_stream = None

        for i, command in enumerate(commands):
            print(f"执行命令 {i+1}/{len(commands)}: {command.name}{command.params}")
            current_stream = command.execute(current_stream)
            print(f"  -> {current_stream}")

        return current_stream


# === 主接口 ===

def parse_and_execute(pipeline_text: str) -> Stream:
    """解析并执行PDF-PL管道"""
    parser = PDFLParser()
    executor = PDFLExecutor()

    try:
        commands = parser.parse(pipeline_text)
        result = executor.execute(commands)
        return result
    except Exception as e:
        print(f"{e}")
        raise


# === 测试用例 ===

if __name__ == "__main__":
    # 设置调试模式
    os.environ["debug"] = "true"

    # 测试用例
    test_cases = [
        # 用例1: 将PDF每一页分别保存为PNG图片
        'Load{url:"https://space4-oss.oss-cn-shanghai.aliyuncs.com/2025.7%25E6%259C%2588%2520C%252B%252B%25E5%2585%25A5%25E9%2597%25A8II%2520%25E7%25BB%2593%25E8%25AF%25BE%25E6%258A%25A5%25E5%2591%258A.pdf"} | Select{mode:"each"} | PNG{dpi:300} | Save{name:"report_pages"}',

        # 用例2: 提取奇数页并合并为一个新的PDF
        'Load{url:"https://space4-oss.oss-cn-shanghai.aliyuncs.com/2025.7%25E6%259C%2588%2520C%252B%252B%25E5%2585%25A5%25E9%2597%25A8II%2520%25E7%25BB%2593%25E8%25AF%25BE%25E6%258A%25A5%25E5%2591%258A.pdf"} | Select{where:"$page % 2 == 1"} | Concat | Save{name:"odd_pages_only"}',

        # 用例3: 仅提取封面和封底
        'Load{url:"https://space4-oss.oss-cn-shanghai.aliyuncs.com/2025.7%25E6%259C%2588%2520C%252B%252B%25E5%2585%25A5%25E9%2597%25A8II%2520%25E7%25BB%2593%25E8%25AF%25BE%25E6%258A%25A5%25E5%2591%258A.pdf"} | Select{pages:"1,$total"} | Save{name:"cover_and_back"}',

        # 用例4: 选择指定页面范围并转换为高分辨率PNG
        'Load{url:"https://space4-oss.oss-cn-shanghai.aliyuncs.com/2025.7%25E6%259C%2588%2520C%252B%252B%25E5%2585%25A5%25E9%2597%25A8II%2520%25E7%25BB%2593%25E8%25AF%25BE%25E6%258A%25A5%25E5%2591%258A.pdf"} | Select{pages:"1..3,5..7"} | PNG{dpi:200} | Save{name:"selected_ranges"}',
    ]

    for i, pipeline in enumerate(test_cases, 1):
        print(f"\n=== 测试用例 {i} ===")
        print(f"管道: {pipeline}")
        try:
            result = parse_and_execute(pipeline)
            print(f"✓ 执行成功")
        except Exception as e:
            print(f"✗ 执行失败: {e}")
