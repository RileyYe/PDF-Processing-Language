import re
import os
import zipfile
import tempfile
from typing import List, Dict, Any, Optional, Union, Type
from abc import ABC, abstractmethod
from enum import Enum
from dataclasses import dataclass, field

from main import PDF, PDFList


class StreamState(Enum):
    """流状态枚举"""
    SINGLE = "SingleStream"  # 单一、完整的文档
    MULTI = "MultiStream"   # 有序的、独立的文档/页面集合


@dataclass
class PipelineContext:
    """管道上下文，包含配置、状态和共享资源"""
    
    # 全局配置
    default_dpi: int = 150
    output_dir: str = "./output"
    temp_dir: Optional[str] = None
    debug_mode: bool = False
    
    # 运行时状态
    current_step: int = 0
    total_steps: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    # 共享资源
    temp_files: List[str] = field(default_factory=list)
    
    def log(self, message: str, level: str = "INFO"):
        """记录日志"""
        if self.debug_mode or level == "ERROR":
            print(f"[{level}] Step {self.current_step}/{self.total_steps}: {message}")
    
    def get_temp_dir(self) -> str:
        """获取临时目录"""
        if self.temp_dir is None:
            self.temp_dir = tempfile.mkdtemp()
        return self.temp_dir
    
    def cleanup(self):
        """清理资源"""
        if self.temp_dir and os.path.exists(self.temp_dir):
            import shutil
            shutil.rmtree(self.temp_dir)
        for temp_file in self.temp_files:
            if os.path.exists(temp_file):
                os.remove(temp_file)


class Concatable(ABC):
    """可合并接口"""
    
    @abstractmethod
    def concat(self, others: List['Concatable']) -> 'Concatable':
        """与其他对象合并"""
        raise NotImplementedError


class Transformable(ABC):
    """可转换接口"""
    
    @abstractmethod
    def to_png(self, dpi: int = 150, mode: str = 'auto') -> 'Transformable':
        """转换为PNG"""
        raise NotImplementedError
    
    @abstractmethod
    def save(self, path: str, name: str):
        """保存到指定路径"""
        raise NotImplementedError


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
    def execute(self, input_stream: Optional[Stream], ctx: PipelineContext) -> Stream:
        """执行命令，返回新的流"""
        raise NotImplementedError
    
    def validate_params(self) -> bool:
        """验证参数有效性"""
        return True
    
    def get_description(self) -> str:
        """获取命令描述"""
        return f"{self.name} command"


class Generator(Command):
    """生成器命令：创建初始流"""


class Transformer(Command):
    """转换器命令：接收一个流，输出一个新流"""


class Consumer(Command):
    """消费者命令：终止管道或执行带有副作用的操作"""


# 命令注册装饰器
class CommandRegistry:
    """命令注册表"""
    
    def __init__(self):
        self._commands: Dict[str, Type[Command]] = {}
    
    def register(self, name: str):
        """注册命令装饰器"""
        def decorator(command_class: Type[Command]):
            self._commands[name] = command_class
            return command_class
        return decorator
    
    def get_command(self, name: str) -> Type[Command]:
        """获取命令类"""
        if name not in self._commands:
            raise ValueError(f"未知命令: {name}")
        return self._commands[name]
    
    def list_commands(self) -> List[str]:
        """列出所有已注册的命令"""
        return list(self._commands.keys())
    
    def register_command(self, name: str, command_class: Type[Command]):
        """手动注册命令"""
        self._commands[name] = command_class


# 全局命令注册表
registry = CommandRegistry()

# === 命令实现 ===

@registry.register('Load')
class LoadCommand(Generator):
    """Load命令：通过URL加载PDF文件"""

    def execute(self, input_stream: Optional[Stream], ctx: PipelineContext) -> Stream:
        if input_stream is not None:
            raise ValueError("Load命令只能作为管道的第一个命令")

        url = self.params.get('url')
        if not url:
            raise ValueError("Load命令需要url参数")

        ctx.log(f"加载PDF: {url}")
        pdf = PDF(url)
        ctx.metadata['source_url'] = url
        return Stream(pdf, StreamState.SINGLE)


@registry.register('Select')
class SelectCommand(Transformer):
    """Select命令：从单一文档中选择页面（分流器）"""

    def execute(self, input_stream: Stream, ctx: PipelineContext) -> Stream:
        if input_stream.state != StreamState.SINGLE:
            raise ValueError("Select命令只能应用于SingleStream")

        pdf = input_stream.content

        if 'mode' in self.params:
            if self.params['mode'] == 'each':
                ctx.log("选择每一页")
                pdf_list = pdf.split_pages()
                return Stream(pdf_list, StreamState.MULTI)
            else:
                raise ValueError(f"不支持的mode值: {self.params['mode']}")

        elif 'pages' in self.params:
            pages_str = self.params['pages']
            ctx.log(f"选择指定页面: {pages_str}")
            pages = self._parse_pages_string(pages_str, pdf.get_page_count())
            selected_pdf_list = PDFList([pdf.get_single_page(p) for p in pages])
            return Stream(selected_pdf_list, StreamState.MULTI)

        elif 'where' in self.params:
            condition = self.params['where']
            ctx.log(f"按条件选择页面: {condition}")
            pages = self._evaluate_condition(condition, pdf.get_page_count())
            selected_pdf_list = PDFList([pdf.get_single_page(p) for p in pages])
            return Stream(selected_pdf_list, StreamState.MULTI)

        else:
            raise ValueError("Select命令需要mode、pages或where参数")

    def _parse_pages_string(self, pages_str: str, total_pages: int) -> List[int]:
        """解析页面字符串，支持逗号和空格分隔"""
        pages = []
        parts = re.split(r'[,\s]+', pages_str.strip())
        parts = [p for p in parts if p]

        for part in parts:
            if '..' in part:
                start, end = map(int, part.split('..'))
                pages.extend(range(start - 1, end))
            elif part == '$total':
                pages.append(total_pages - 1)
            else:
                pages.append(int(part) - 1)

        return sorted(list(set(pages)))

    def _evaluate_condition(self, condition: str, total_pages: int) -> List[int]:
        """评估条件表达式"""
        pages = []
        for page_num in range(1, total_pages + 1):
            expr = condition.replace('$page', str(page_num))
            expr = expr.replace('$total', str(total_pages))

            if self._is_safe_expression(expr):
                try:
                    if eval(expr):  # noqa: S307
                        pages.append(page_num - 1)
                except Exception:  # noqa: BLE001
                    continue

        return pages

    def _is_safe_expression(self, expr: str) -> bool:
        """检查表达式是否安全"""
        allowed_chars = set('0123456789+-*/%() ==!=<>&|')
        return all(c in allowed_chars for c in expr)


@registry.register('Concat')
class ConcatCommand(Transformer):
    """Concat命令：将多文档流合并成单一文档（聚合器）"""

    def execute(self, input_stream: Stream, ctx: PipelineContext) -> Stream:
        if input_stream.state != StreamState.MULTI:
            raise ValueError("Concat命令只能应用于MultiStream")

        pdf_list = input_stream.content
        ctx.log(f"合并 {len(pdf_list)} 个文档")
        
        # 使用内容对象的concat方法
        merged_pdf = pdf_list.concat([])  # PDFList自己concat空列表等于合并自身
        
        return Stream(merged_pdf, StreamState.SINGLE)


@registry.register('PNG')
class PNGCommand(Transformer):
    """PNG命令：将流中的每个文档转换为PNG图像格式（一对一）"""

    def execute(self, input_stream: Stream, ctx: PipelineContext) -> Stream:
        dpi = self.params.get('dpi', ctx.default_dpi)

        ctx.log(f"转换为PNG (DPI: {dpi})")
        print(f"转换为PNG (DPI: {dpi})")
        print(input_stream)
        if input_stream.state == StreamState.SINGLE:
            pdf = input_stream.content
            pdf.to_png_enhanced(dpi=dpi)
            return Stream(pdf, StreamState.SINGLE)

        elif input_stream.state == StreamState.MULTI:
            pdf_list = input_stream.content
            pdf_list.to_png_enhanced(dpi=dpi)
            return Stream(pdf_list, StreamState.MULTI)

        else:
            raise ValueError(f"PNG命令不支持流状态: {input_stream.state}")


@registry.register('Save')
class SaveCommand(Consumer):
    """Save命令：将管道处理的最终结果打包成ZIP文件"""

    def execute(self, input_stream: Stream, ctx: PipelineContext) -> Stream:
        name = self.params.get('name', 'output')
        
        ctx.log(f"保存结果: {name}")

        # 使用上下文的临时目录
        temp_dir = ctx.get_temp_dir()
        
        if input_stream.state == StreamState.SINGLE:
            pdf = input_stream.content
            pdf.save_enhanced(temp_dir, name)
        elif input_stream.state == StreamState.MULTI:
            pdf_list = input_stream.content
            pdf_list.save_enhanced(temp_dir, name)

        # 创建ZIP文件
        os.makedirs(ctx.output_dir, exist_ok=True)
        zip_path = os.path.join(ctx.output_dir, f"{name}.zip")

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    zipf.write(file_path, arcname)

        ctx.log(f"结果已保存到: {zip_path}")
        return input_stream


# === 解析器 ===

class PDFLParser:
    """PDF-PL语法解析器"""

    def __init__(self, command_registry: CommandRegistry = None):
        self.registry = command_registry or registry

    def parse(self, pipeline_text: str) -> List[Command]:
        """解析管道文本为命令列表"""
        pipeline_text = pipeline_text.strip()
        if not pipeline_text:
            raise ValueError("管道不能为空")

        command_strings = [cmd.strip() for cmd in pipeline_text.split('|')]
        commands = []

        for cmd_str in command_strings:
            command = self._parse_command(cmd_str)
            commands.append(command)

        self._validate_pipeline(commands)
        return commands

    def _parse_command(self, cmd_str: str) -> Command:
        """解析单个命令"""
        match = re.match(r'(\w+)(?:\{([^}]*)\})?', cmd_str.strip())
        if not match:
            raise ValueError(f"无效的命令格式: {cmd_str}")

        name, params_str = match.groups()
        
        # 使用注册表获取命令类
        command_class = self.registry.get_command(name)
        
        params = self._parse_parameters(params_str) if params_str else {}
        return command_class(name, params)

    def _parse_parameters(self, params_str: str) -> Dict[str, Any]:
        """解析参数字符串"""
        params = {}
        if not params_str:
            return params

        param_pairs = [p.strip() for p in params_str.split(',')]
        for pair in param_pairs:
            if ':' not in pair:
                raise ValueError(f"无效的参数格式: {pair}")

            key, value = pair.split(':', 1)
            key = key.strip()
            value = value.strip()
            params[key] = self._parse_value(value)

        return params

    def _parse_value(self, value_str: str) -> Any:
        """解析参数值"""
        value_str = value_str.strip()

        if (value_str.startswith('"') and value_str.endswith('"')) or \
           (value_str.startswith("'") and value_str.endswith("'")):
            return value_str[1:-1]

        if value_str.lower() == 'true':
            return True
        elif value_str.lower() == 'false':
            return False

        if re.match(r'^-?\d+(\.\d+)?$', value_str):
            try:
                if '.' in value_str:
                    return float(value_str)
                else:
                    return int(value_str)
            except ValueError:
                pass

        return value_str

    def _validate_pipeline(self, commands: List[Command]):
        """验证管道结构"""
        if not commands:
            raise ValueError("管道不能为空")

        if not isinstance(commands[0], Generator):
            raise ValueError("管道的第一个命令必须是生成器（如Load）")

        for cmd in commands[1:]:
            if isinstance(cmd, Generator):
                raise ValueError("生成器命令只能作为管道的第一个命令")


# === 执行引擎 ===

class PDFLExecutor:
    """PDF-PL执行引擎"""

    def __init__(self, ctx: PipelineContext = None):
        self.ctx = ctx or PipelineContext()

    def execute(self, commands: List[Command]) -> Stream:
        """执行命令管道"""
        self.ctx.total_steps = len(commands)
        current_stream = None

        try:
            for i, command in enumerate(commands):
                self.ctx.current_step = i + 1
                self.ctx.log(
                    f"执行命令: {command.name}{command.params}", 
                    "INFO"
                )
                
                current_stream = command.execute(current_stream, self.ctx)
                
                self.ctx.log(
                    f"结果: {current_stream}",
                    "INFO"
                )

            return current_stream
        
        except Exception as e:
            self.ctx.log(f"执行失败: {str(e)}", "ERROR")
            raise
        finally:
            # 清理资源
            self.ctx.cleanup()


# === 主接口 ===

def parse_and_execute(pipeline_text: str, ctx: PipelineContext = None) -> Stream:
    """解析并执行PDF-PL管道"""
    if ctx is None:
        ctx = PipelineContext(debug_mode=os.environ.get("debug") == "true")

    parser = PDFLParser()
    executor = PDFLExecutor(ctx)

    try:
        commands = parser.parse(pipeline_text)
        result = executor.execute(commands)
        return result
    except Exception as e:
        ctx.log(f"管道执行失败: {e}", "ERROR")
        raise


# === 扩展示例 ===

# 添加新命令的示例
@registry.register('Rotate')
class RotateCommand(Transformer):
    """旋转命令示例"""
    
    def execute(self, input_stream: Stream, ctx: PipelineContext) -> Stream:
        angle = self.params.get('angle', 90)
        ctx.log(f"旋转 {angle} 度")
        
        # 这里只是示例，实际需要实现旋转逻辑
        # if hasattr(input_stream.content, 'rotate'):
        #     input_stream.content.rotate(angle)
        
        return input_stream


# 配置文件支持示例
def create_context_from_config(config: Dict[str, Any]) -> PipelineContext:
    """从配置创建上下文"""
    return PipelineContext(
        default_dpi=config.get('default_dpi', 150),
        output_dir=config.get('output_dir', './output'),
        debug_mode=config.get('debug', False)
    )


if __name__ == "__main__":
    # 创建自定义上下文
    context = PipelineContext(
        default_dpi=300,
        debug_mode=True,
        output_dir="./custom_output"
    )
    
    # 测试用例
    test_pipeline = 'Load{url:"test.pdf"} | Select{mode:"each"} | PNG{dpi:200} | Save{name:"test_output"}'
    
    print("可用命令:", registry.list_commands())
    print(f"测试管道: {test_pipeline}")
    
    # 注意：这里需要实际的PDF文件来测试
    # result = parse_and_execute(test_pipeline, context)