
import pandas as pd
import json

try:
    file_path = r"c:\Users\Mammi\Desktop\SAFFET SABANCI APRT. 2026.xlsx"
    df = pd.read_excel(file_path, sheet_name=0, header=1)
    
    # Clean up column names and rows
    # Rename columns based on content if possible
    # We found 'DAİRE NO' in the dump.
    
    result = "import { Apartment } from './initialData';\n\nexport const importedApartments: Apartment[] = [\n"
    
    for _, row in df.iterrows():
        # Try to find Daire No by column name or position
        # Column 0 is usually Daire No.
        try:
            daire = row.iloc[0] # Try index 0
            if pd.isna(daire): continue
            
            # Skip if header repetition or title
            if str(daire).upper() in ['DAİRE NO', 'SAFFET SABANCI APARTMANI']: continue
            
            # Parse Int
            try:
                daire_no = int(daire)
            except:
                continue # Skip if not a number
                
            mulk = str(row.iloc[1]).strip() if not pd.isna(row.iloc[1]) else ""
            sakin = str(row.iloc[2]).strip() if not pd.isna(row.iloc[2]) else ""
            
            # Create object
            result += f"  {{ daireNo: {daire_no}, sakinAdi: \"{sakin}\", mulkSahibi: \"{mulk}\", asansorTabi: true }},\n"
        except:
            continue
            
    result += "];\n"
    
    with open(r"c:\Users\Mammi\Desktop\apartmanyonetim\src\data\importedData.ts", "w", encoding="utf-8") as f:
        f.write(result)
        
    print("Exported data successfully.")

except Exception as e:
    print(f"Error: {e}")
