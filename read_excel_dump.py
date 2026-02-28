
import pandas as pd
import json

file_path = r"c:\Users\Mammi\Desktop\SAFFET SABANCI APRT. 2026.xlsx"
out_path = r"c:\Users\Mammi\Desktop\apartmanyonetim\excel_dump.json"

try:
    xl = pd.ExcelFile(file_path)
    sheet_names = xl.sheet_names
    
    # Read the first sheet assuming it's the apartments
    df1 = pd.read_excel(file_path, sheet_name=0)
    
    # Check if there is a ledger sheet
    ledger_sheet = next((s for s in sheet_names if 'işletme' in s.lower() or 'ledger' in s.lower()), None)
    df_ledger = None
    if ledger_sheet:
        df_ledger = pd.read_excel(file_path, sheet_name=ledger_sheet)
    
    result = {
        "sheets": sheet_names,
        "first_sheet_cols": list(df1.columns),
        "first_sheet_head": df1.head(5).to_dict(orient='records'),
        "ledger_sheet": ledger_sheet,
        "ledger_preview": df_ledger.head(5).to_dict(orient='records') if df_ledger is not None else None
    }
    
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=4, default=str)

except Exception as e:
    with open(out_path, 'w') as f:
        json.dump({"error": str(e)}, f)
