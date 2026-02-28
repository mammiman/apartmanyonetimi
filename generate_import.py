
import json
import os

try:
    with open(r"c:\Users\Mammi\Desktop\apartmanyonetim\excel_dump.json", 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Transform to TS format
    # We mainly need lists for Apartments and Dues.
    # The dump has "first_sheet_head" which is apartments.
    
    apartments = []
    # Mapping based on "first_sheet_head" keys seen in Step 165
    # Unnamed: 0 -> Daire No
    # Unnamed: 1 -> Mülk Sahibi
    # Unnamed: 2 -> Sakin Adı
    # Unnamed: 4/5/6/7 -> Asansör?
    
    # We need to skip the first 2-3 rows which are headers.
    # The dump shows rows. Row 0: Title. Row 1: Headers. Row 2+: Data.
    # Actually, Step 165 shows:
    # Row 0: "SAFFET SABANCI APARTMANI"
    # Row 1: "DAİRE NO", "MÜLK SAHİBİ", etc.
    # Row 2: "1", "İHSAN KUBAT", "MAHMUT AYDOĞAN"...
    
    raw_rows = data.get("first_sheet_head", [])
    # We need ALL rows, but the dump only had head(5).
    # I need to read the FULL file again to get all rows.
    
    # Re-read full excel using pandas
    import pandas as pd
    df = pd.read_excel(r"c:\Users\Mammi\Desktop\SAFFET SABANCI APRT. 2026.xlsx", sheet_name=0, header=1) 
    # header=1 implies row 1 is header (0-indexed, so second row).
    # Let's inspect the dataframe columns from the previous dump visual:
    # Row 1 had "DAİRE NO", "MÜLK SAHİBİ".
    
    # Normalize columns
    df.columns = [str(c).upper().strip() for c in df.columns]
    
    # Found columns like 'DAİRE NO', 'ADI SOYADI', 'MÜLK SAHİBİ', 'ASANSÖR'
    
    ts_content = "import { Apartment } from './initialData';\n\n"
    ts_content += "export const importedApartments: Apartment[] = [\n"
    
    for index, row in df.iterrows():
        try:
            daire_no = int(row.get('DAİRE NO', 0))
            if daire_no == 0: continue
            
            sakin = str(row.get('ADI SOYADI', '')).strip()
            mulk = str(row.get('MÜLK SAHİBİ', '')).strip()
            if mulk.lower() == 'nan': mulk = ''
            if sakin.lower() == 'nan': sakin = ''
            
            # Logic for asansorTabi: If 'ASANSÖR' col has valuable data?
            # Sample data showed 600, 650.
            # Assume true if value > 0.
            asansor_val = row.get('ASANSÖR', 0)
            asansor_tabi = True # Default true
            try:
                if float(asansor_val) == 0: asansor_tabi = False
            except: pass
            
            ts_content += f"  {{ daireNo: {daire_no}, sakinAdi: '{sakin}', mulkSahibi: '{mulk}', asansorTabi: {str(asansor_tabi).lower()} }},\n"
        except:
            continue

    ts_content += "];\n"
    
    with open(r"c:\Users\Mammi\Desktop\apartmanyonetim\src\data\importedData.ts", 'w', encoding='utf-8') as f:
        f.write(ts_content)
        
    print("Success")

except Exception as e:
    print(str(e))
