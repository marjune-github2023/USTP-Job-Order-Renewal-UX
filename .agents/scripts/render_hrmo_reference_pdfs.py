from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / ".agents" / "outputs"
FILES = [
    ROOT / "attached_assets" / "HrmoApplications_1791427909220.pdf",
    ROOT / "attached_assets" / "PersonnelTOR_1791427909220.pdf",
]

for pdf_path in FILES:
    document = fitz.open(pdf_path)
    stem = pdf_path.stem
    print(f"{pdf_path.name}: {len(document)} pages")
    for index, page in enumerate(document, start=1):
        image_path = OUTPUT / f"{stem}-page-{index}.png"
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        pixmap.save(image_path)
        print(f"  page {index}: {page.rect.width:.0f}x{page.rect.height:.0f} pt -> {image_path.relative_to(ROOT)}")
