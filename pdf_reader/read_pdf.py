from pypdf import PdfReader
import sys

def extract_text(pdf_path):
    reader = PdfReader(pdf_path)
    for page in reader.pages:
        print("--- PAGE ---")
        print(page.extract_text())

extract_text(sys.argv[1])
