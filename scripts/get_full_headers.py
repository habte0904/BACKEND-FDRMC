import openpyxl, json, os

EXCEL_PATH = r"C:/Users/Habtesh/Desktop/Woreda Profile.xlsx"
OUTPUT_PATH = "e:/DRM/PDRM/BACKEND/scripts/full_excel_headers.json"

def get_headers():
    if not os.path.exists(EXCEL_PATH):
        return {"error": f"File not found: {EXCEL_PATH}"}
    
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    all_headers = {}
    for sheet in wb.sheetnames:
        s = wb[sheet]
        headers = [str(cell.value).strip() if cell.value is not None else f"Column_{j}" for j, cell in enumerate(s[1])]
        all_headers[sheet] = headers
    return all_headers

if __name__ == "__main__":
    headers = get_headers()
    with open(OUTPUT_PATH, "w") as f:
        json.dump(headers, f, indent=2)
    print(f"Headers exported to {OUTPUT_PATH}")
