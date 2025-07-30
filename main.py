import os
import io
from pathlib import Path
from typing import List, Union, Self, Optional

from pydantic import HttpUrl, FilePath, DirectoryPath
from pydantic.types import Any
from requests import get
from pypdf import PdfReader, PdfWriter, PdfMerger
from pdf2image import convert_from_bytes, convert_from_path
from PIL import Image


def debug(something: Any):
    if os.environ.get("debug") == "true":
        print(something)


class PDFList:
    """PDF列表包装类，支持链式调用"""

    def __init__(self, pdf_list: List['PDF']):
        self._pdf_list = pdf_list

    def __len__(self) -> int:
        return len(self._pdf_list)

    def __getitem__(self, index) -> 'PDF':
        return self._pdf_list[index]

    def __iter__(self):
        return iter(self._pdf_list)

    def to_list(self) -> List['PDF']:
        """转换为普通列表"""
        return self._pdf_list.copy()

    def to_png(self, dpi: int = 200) -> Self:  # Modified return type
        """
        将PDF列表中的所有PDF转换为内存中的图像并返回PDFList自身
        :param dpi: 图片分辨率
        :return: PDFList自身，支持链式调用
        """
        for pdf in self._pdf_list:
            pdf.to_png(dpi=dpi)
        debug(
            f"PDFList已转换为 {sum(len(pdf._images) for pdf in self._pdf_list)} 个内存中的图像")
        return self  # Return self for chaining

    def save_all(self, output_dir: str, filename_prefix: str = "pdf") -> Self:
        """
        保存列表中的所有PDF
        :param output_dir: 输出目录
        :param filename_prefix: 文件名前缀
        :return: 当前对象（支持链式调用）
        """
        for i, pdf in enumerate(self._pdf_list):
            filename = f"{filename_prefix}_{i+1}.pdf"
            pdf.save(output_dir, filename)

        debug(f"已保存 {len(self._pdf_list)} 个PDF文件")
        return self

    def merge(self) -> 'PDF':
        """
        合并列表中的所有PDF
        :return: 合并后的PDF对象
        """
        return PDF.merge_pdfs(self._pdf_list)

    def filter_by_page_count(self, min_pages: int = 1, max_pages: Optional[int] = None) -> Self:
        """
        根据页数过滤PDF
        :param min_pages: 最小页数
        :param max_pages: 最大页数（可选）
        :return: 过滤后的PDFList
        """
        filtered = []
        for pdf in self._pdf_list:
            page_count = pdf.get_selected_page_count()
            if page_count >= min_pages:
                if max_pages is None or page_count <= max_pages:
                    filtered.append(pdf)

        debug(f"根据页数过滤：{len(self._pdf_list)} -> {len(filtered)} 个PDF")
        return PDFList(filtered)

    def split_by_range(self, pages_per_split: int) -> Self:
        """
        对列表中的每个PDF按范围分割
        :param pages_per_split: 每个分割包含的页数
        :return: 包含所有分割结果的新PDFList
        """
        all_splits = []
        for pdf in self._pdf_list:
            splits = pdf.split_by_range(pages_per_split)
            all_splits.extend(splits.to_list() if isinstance(
                splits, PDFList) else splits)

        debug(
            f"对 {len(self._pdf_list)} 个PDF按 {pages_per_split} 页/组分割，得到 {len(all_splits)} 个PDF")
        return PDFList(all_splits)

    def save_images(self, output_dir: str = "./", filename_prefix: str = "page") -> Self:
        """保存所有PDF中的图像"""
        for _, pdf in enumerate(self._pdf_list):
            pdf.save_images(output_dir, filename_prefix)
        return self


class PDF:
    def __init__(self, src: Union[str, FilePath, HttpUrl, Self, bytes]):
        """
        初始化PDF对象
        :param src: PDF源，可以是文件路径、URL、另一个PDF对象或字节数据
        """
        self._data: Optional[bytes] = None
        self._pages: Optional[List[int]] = None  # 用于记录选中的页面
        self._images: Optional[List[Image.Image]] = None  # 用于存储转换后的图像数据

        if isinstance(src, str):
            if src.startswith(('http://', 'https://')):
                # URL
                response = get(src, timeout=30000)
                self._data = response.content
            else:
                # 文件路径
                with open(src, 'rb') as f:
                    self._data = f.read()
        elif isinstance(src, PDF):
            # 复制另一个PDF对象
            self._data = src._data
            self._pages = src._pages
        elif isinstance(src, bytes):
            # 直接使用字节数据
            self._data = src
        else:
            raise ValueError(f"不支持的源类型: {type(src)}")

    def _get_pdf_reader(self) -> PdfReader:
        """获取PdfReader对象"""
        return PdfReader(io.BytesIO(self._data))

    def _get_selected_pages(self, reader: PdfReader) -> List[int]:
        """获取选中的页面列表，如果没有选中则返回全部页面"""
        if self._pages is not None:
            return self._pages
        return list(range(len(reader.pages)))

    def save(self, dest: str, filename: str) -> Self:
        """
        保存PDF文件
        :param dest: 目标目录
        :param filename: 文件名
        :return: 当前对象（支持链式调用）
        """
        os.makedirs(dest, exist_ok=True)
        filepath = os.path.join(dest, filename)

        if self._pages is not None:
            # 如果选择了特定页面，需要创建新的PDF
            reader = self._get_pdf_reader()
            writer = PdfWriter()

            for page_num in self._pages:
                if 0 <= page_num < len(reader.pages):
                    writer.add_page(reader.pages[page_num])

            with open(filepath, 'wb') as output_file:
                writer.write(output_file)
        else:
            # 保存原始PDF
            with open(filepath, 'wb') as output_file:
                output_file.write(self._data)

        debug(f"PDF已保存到: {filepath}")
        return self

    def get_single_page(self, page_number: int) -> Self:
        """
        提取单个页面
        :param page_number: 页面号（从0开始）
        :return: 新的PDF对象
        """
        new_pdf = PDF(self)
        new_pdf._pages = [page_number]
        debug(f"提取第 {page_number + 1} 页")
        return new_pdf

    def get_pages(self, pages: List[int]) -> Self:
        """
        提取多个页面
        :param pages: 页面号列表（从0开始）
        :return: 新的PDF对象
        """
        new_pdf = PDF(self)
        new_pdf._pages = pages.copy()
        debug(f"提取页面: {[p + 1 for p in pages]}")
        return new_pdf

    def get_page_range(self, start: int, end: int) -> Self:
        """
        按范围提取页面
        :param start: 起始页面（从0开始，包含）
        :param end: 结束页面（从0开始，不包含）
        :return: 新的PDF对象
        """
        pages = list(range(start, end))
        return self.get_pages(pages)

    def split_pages(self) -> PDFList:
        """
        将PDF分割成单页PDF列表
        :return: PDFList对象
        """
        reader = self._get_pdf_reader()
        selected_pages = self._get_selected_pages(reader)

        result = []
        for page_num in selected_pages:
            if 0 <= page_num < len(reader.pages):
                single_page_pdf = self.get_single_page(page_num)
                result.append(single_page_pdf)

        debug(f"PDF已分割为 {len(result)} 个单页PDF")
        return PDFList(result)

    def split_by_range(self, pages_per_split: int) -> PDFList:
        """
        按指定页数范围分割PDF
        :param pages_per_split: 每个分割包含的页数
        :return: PDFList对象
        """
        reader = self._get_pdf_reader()
        selected_pages = self._get_selected_pages(reader)

        result = []
        for i in range(0, len(selected_pages), pages_per_split):
            end_idx = min(i + pages_per_split, len(selected_pages))
            range_pages = selected_pages[i:end_idx]
            range_pdf = self.get_pages(range_pages)
            result.append(range_pdf)

        debug(f"PDF已按 {pages_per_split} 页/组分割为 {len(result)} 个PDF")
        return PDFList(result)

    def to_png(self, dpi: int = 200) -> List[Image.Image]:
        """
        将PDF转换为PIL图像对象（内存中）
        :param dpi: 图片分辨率
        :return: PIL图像对象列表
        """
        images = []

        if self._pages is not None:
            # 如果选择了特定页面，先创建临时PDF
            reader = self._get_pdf_reader()
            writer = PdfWriter()

            for page_num in self._pages:
                if 0 <= page_num < len(reader.pages):
                    writer.add_page(reader.pages[page_num])

            # 将选中页面写入字节流
            temp_bytes = io.BytesIO()
            writer.write(temp_bytes)
            temp_bytes.seek(0)

            images = convert_from_bytes(temp_bytes.getvalue(), dpi=dpi)
        else:
            # 转换全部页面
            images = convert_from_bytes(self._data, dpi=dpi)

        self._images = images  # 将图像存储在实例变量中
        debug(f"PDF已转换为 {len(images)} 个内存中的图像")
        return images

    def to_single_png(self, dpi: int = 200) -> Image.Image:
        """
        将PDF转换为单个合并的PNG图像
        :param dpi: 图片分辨率
        :return: 合并后的PIL图像对象
        """
        # 首先转换为图像列表
        images = self.to_png(dpi=dpi)

        if len(images) == 1:
            return images[0]

        # 计算合并后图像的尺寸
        max_width = max(img.width for img in images)
        total_height = sum(img.height for img in images)

        # 创建新的空白图像
        merged_image = Image.new('RGB', (max_width, total_height), 'white')

        # 将所有图像垂直拼接
        y_offset = 0
        for img in images:
            merged_image.paste(img, (0, y_offset))
            y_offset += img.height

        # 更新实例变量为单个图像
        self._images = [merged_image]
        debug(
            f"PDF已转换为单个合并的PNG图像 ({merged_image.width}x{merged_image.height})")
        return merged_image

    def save_images(self, output_dir: str = "./", filename_prefix: str = "page") -> List[str]:
        """
        将内存中的图像保存为PNG文件
        :param output_dir: 输出目录
        :param filename_prefix: 文件名前缀
        :return: 生成的PNG文件路径列表
        """
        if not hasattr(self, '_images') or not self._images:
            raise ValueError("请先调用to_png()生成图像")

        os.makedirs(output_dir, exist_ok=True)
        png_files = []

        for i, image in enumerate(self._images):
            if self._pages is not None and len(self._pages) == 1:
                # 单页情况使用原始页码
                page_num = self._pages[0] + 1
                filename = f"{filename_prefix}_page_{page_num}.png"
            else:
                # 多页情况使用顺序号
                filename = f"{filename_prefix}_page_{i + 1}.png"

            filepath = os.path.join(output_dir, filename)
            image.save(filepath, 'PNG')
            png_files.append(filepath)

        debug(f"已保存 {len(png_files)} 个PNG文件到目录: {output_dir}")
        return png_files

    def get_page_count(self) -> int:
        """获取PDF总页数"""
        reader = self._get_pdf_reader()
        return len(reader.pages)

    def get_selected_page_count(self) -> int:
        """获取当前选中的页数"""
        if self._pages is not None:
            return len(self._pages)
        return self.get_page_count()

    @staticmethod
    def merge_pdfs(pdf_list: Union[List[Self], PDFList]) -> Self:
        """
        合并多个PDF
        :param pdf_list: PDF对象列表或PDFList对象
        :return: 合并后的PDF对象
        """
        # 如果是PDFList，转换为普通列表
        if isinstance(pdf_list, PDFList):
            pdf_list = pdf_list.to_list()

        writer = PdfWriter()

        for pdf in pdf_list:
            if pdf._pages is not None:
                # 如果PDF选择了特定页面，只添加这些页面
                reader = pdf._get_pdf_reader()
                for page_num in pdf._pages:
                    if 0 <= page_num < len(reader.pages):
                        writer.add_page(reader.pages[page_num])
            else:
                # 添加整个PDF的所有页面
                reader = pdf._get_pdf_reader()
                for page in reader.pages:
                    writer.add_page(page)

        # 获取合并后的字节数据
        output_bytes = io.BytesIO()
        writer.write(output_bytes)

        result_pdf = PDF(output_bytes.getvalue())
        debug(f"已合并 {len(pdf_list)} 个PDF")
        return result_pdf

    @staticmethod
    def pdfs_to_pngs(pdf_list: Union[List[Self], PDFList], dpi: int = 200, output_dir: str = "./") -> List[List[str]]:
        """
        将PDF列表转换为PNG列表
        :param pdf_list: PDF对象列表或PDFList对象
        :param dpi: 图片分辨率
        :param output_dir: 输出目录
        :return: 每个PDF对应的PNG文件路径列表的列表
        """
        # 如果是PDFList，转换为普通列表
        if isinstance(pdf_list, PDFList):
            pdf_list = pdf_list.to_list()

        result = []
        for i, pdf in enumerate(pdf_list):
            filename_prefix = f"pdf_{i + 1}"
            png_files = pdf.to_png(dpi=dpi)  # Changed to call to_png directly
            # Changed to collect filenames
            result.append([img.filename for img in png_files])

        debug(f"已将 {len(pdf_list)} 个PDF转换为PNG")
        return result


if __name__ == "__main__":
    os.environ["debug"] = "true"
    pdf = PDF("./a.pdf").split_pages().to_png(dpi=200).save_images(
        output_dir="./output/images", filename_prefix="prefix")
