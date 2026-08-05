from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path(r"G:\景区资料包\示范景区公开资料包")
OUTPUT_FILE = PROJECT_ROOT / "memory" / "scenic_kb" / "imported_chunks.json"


def read_docx(path: Path) -> list[str]:
    if path.stat().st_size == 0:
        return []
    chunks: list[str] = []
    with zipfile.ZipFile(path) as archive:
        with archive.open("word/document.xml") as document:
            root = ElementTree.parse(document).getroot()
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    for paragraph in root.findall(".//w:p", ns):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", ns)).strip()
        if text:
            chunks.append(normalize_text(text))
    return chunks


def read_xlsx(path: Path) -> list[str]:
    if path.stat().st_size == 0:
        return []
    rows: list[str] = []
    with zipfile.ZipFile(path) as archive:
        shared_strings = read_shared_strings(archive)
        sheet_names = [name for name in archive.namelist() if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")]
        for sheet_name in sheet_names:
            with archive.open(sheet_name) as sheet_file:
                root = ElementTree.parse(sheet_file).getroot()
            ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
            for row in root.findall(".//m:row", ns):
                values = [cell_value(cell, shared_strings, ns) for cell in row.findall("m:c", ns)]
                values = [value for value in values if value]
                if values:
                    rows.append(normalize_text(" | ".join(values)))
    return rows


def read_shared_strings(archive: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with archive.open("xl/sharedStrings.xml") as strings_file:
        root = ElementTree.parse(strings_file).getroot()
    strings: list[str] = []
    for item in root.findall(".//m:si", ns):
        strings.append("".join(text.text or "" for text in item.findall(".//m:t", ns)))
    return strings


def cell_value(cell: ElementTree.Element, shared_strings: list[str], ns: dict[str, str]) -> str:
    value = cell.find("m:v", ns)
    if value is None or value.text is None:
        return ""
    if cell.attrib.get("t") == "s":
        index = int(value.text)
        return shared_strings[index] if 0 <= index < len(shared_strings) else ""
    return value.text


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    documents = []
    for path in SOURCE_DIR.glob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() == ".docx":
            chunks = read_docx(path)
        elif path.suffix.lower() == ".xlsx":
            chunks = read_xlsx(path)
        else:
            chunks = []
        documents.append(
            {
                "source": str(path),
                "sizeBytes": path.stat().st_size,
                "chunks": [{"id": f"{path.stem}-{index + 1}", "content": chunk} for index, chunk in enumerate(chunks)],
            }
        )

    OUTPUT_FILE.write_text(
        json.dumps({"generatedFrom": str(SOURCE_DIR), "documents": documents}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    total_chunks = sum(len(document["chunks"]) for document in documents)
    print(f"Wrote {OUTPUT_FILE} with {total_chunks} chunks.")


if __name__ == "__main__":
    main()