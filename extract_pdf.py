import sys
from pypdf import PdfReader
import os

def extract_text(pdf_path):
    print(f"--- Extracting {os.path.basename(pdf_path)} ---")
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        print(text[:1500]) # Print first 1500 characters to get the gist
        if len(text) > 1500:
            print(f"... (and {len(text) - 1500} more characters)")
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    base_dir = "/Users/seong-younsoo/source/DOORE/참고자료"
    files = [
        "DOORE 와이어프레임.pdf",
        "아키텍처 1차 보고서.pdf",
        "아키텍처 2차 보고서.pdf"
    ]
    for f in files:
        extract_text(os.path.join(base_dir, f))
