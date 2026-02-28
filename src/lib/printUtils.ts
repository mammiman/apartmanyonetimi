import { numberToTurkishWords } from "./formatUtils";

interface ReceiptData {
    type: 'gelir' | 'gider';
    amount: number;
    desc: string;
    date: string;
    name: string;
    apartmentName: string;
    kime?: string; // Gider pusulasında "KİME" satırı için
}

// Otomatik artan sıra numarası - localStorage'da saklanır
const getNextReceiptNo = (type: 'gelir' | 'gider'): number => {
    const key = type === 'gelir' ? 'receipt_seq_gelir' : 'receipt_seq_gider';
    const current = parseInt(localStorage.getItem(key) || '0', 10);
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return next;
};

export const printReceipt = (data: ReceiptData) => {
    const title = data.type === 'gelir' ? 'PARA MAKBUZU' : 'GİDER PUSULASI';
    const amountText = numberToTurkishWords(data.amount);
    const fullTextAmount = `# ${amountText} #`;
    const receiptNo = getNextReceiptNo(data.type);
    const seriCode = data.type === 'gelir' ? 'A' : 'B';

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
        <html>
        <head>
            <title>${title}</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px; }
                .receipt-container {
                    width: 19cm;
                    height: 13cm;
                    border: 3px solid #000;
                    border-radius: 20px;
                    padding: 30px;
                    position: relative;
                    margin: 0 auto;
                    box-sizing: border-box;
                }
                
                /* Crop marks (L shapes) simulation if needed, but border-radius is requested */
                
                .header-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 40px;
                }

                .logo-box {
                    width: 45%;
                    text-align: center;
                    position: relative;
                }
                
                .logo-border {
                    border: 2px solid #000;
                    padding: 15px;
                    border-radius: 10px;
                    display: inline-block;
                }
                
                .apt-name {
                    font-weight: bold;
                    font-size: 16px;
                    color: #000080; /* Navy blue like stamp */
                    text-transform: uppercase;
                    line-height: 1.4;
                }
                
                .address {
                    margin-top: 5px;
                    font-size: 12px;
                    color: #000080;
                }
                
                .crop-tl { position: absolute; top: -10px; left: -10px; width: 20px; height: 20px; border-top: 2px solid #000; border-left: 2px solid #000; }
                .crop-br { position: absolute; bottom: -10px; right: -10px; width: 20px; height: 20px; border-bottom: 2px solid #000; border-right: 2px solid #000; }

                .meta-box {
                    width: 45%;
                    text-align: right;
                }
                
                .receipt-title {
                    font-size: 22px;
                    font-weight: bold;
                    text-decoration: underline;
                    margin-bottom: 15px;
                    text-align: center;
                }
                
                .meta-row {
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                
                .amount-display {
                    margin-top: 15px;
                    border-bottom: 2px solid #000;
                    display: inline-block;
                    font-weight: bold;
                    font-size: 18px;
                    padding: 0 10px 5px 30px;
                    min-width: 150px;
                    text-align: center;
                }

                .body-section {
                    margin-top: 20px;
                    line-height: 2;
                    font-size: 16px;
                }
                
                .line-row {
                    display: flex;
                    align-items: baseline;
                    margin-bottom: 10px;
                }
                
                .label {
                    font-weight: bold;
                    margin-right: 10px;
                    min-width: 80px;
                }
                
                .dots {
                    flex-grow: 1;
                    border-bottom: 1px dotted #000;
                    padding-left: 10px;
                }

                .footer-section {
                    margin-top: 50px;
                    display: flex;
                    justify-content: space-between;
                    padding: 0 20px;
                }
                
                .signature-box {
                    text-align: center;
                    width: 150px;
                }
                
                .signature-title {
                    font-size: 14px;
                    font-weight: normal;
                    margin-bottom: 40px;
                }
                
                @media print {
                    body { margin: 0; padding: 0; }
                    .receipt-container { margin: 0; border: 3px solid #000; }
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="header-section">
                    <div class="logo-box">
                         <div class="logo-border">
                            <div class="crop-tl"></div>
                            <div class="apt-name">
                                ${data.apartmentName}<br/>
                                YÖNETİCİLİĞİ
                            </div>
                            <div class="address">
                                Serhat Mah. Serhat Cad. No: 28<br/>
                                Yenimahalle/ANKARA
                            </div>
                            <div class="crop-br"></div>
                         </div>
                    </div>
                    
                    <div class="meta-box">
                        <div class="receipt-title">${title}</div>
                        <div class="meta-row">SERİ: <span style="text-decoration: underline;">&nbsp;&nbsp;${seriCode}&nbsp;&nbsp;</span> &nbsp;&nbsp; SIRA NO: <span style="border-bottom: 2px solid #000; display: inline-block; min-width: 60px; font-weight: bold; text-align:center;">${String(receiptNo).padStart(4, '0')}</span></div>
                        <div class="meta-row">Tarih : <span style="border-bottom: 1px dotted #000;">${new Date(data.date).toLocaleDateString('tr-TR')}</span></div>
                        <div class="meta-row">
                            LİRA <span class="amount-display">₺ ${data.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>

                <div class="body-section">
                    <div class="line-row">
                        <span class="label">${data.type === 'gelir' ? 'SAYIN' : 'KİME'}</span>
                        <span class="dots">${data.type === 'gider' ? (data.kime || data.name || '') : (data.name || '')}</span>
                        <span style="white-space: nowrap; margin-left: 10px;">'${data.type === 'gelir' ? 'dan' : 'ye'}</span>
                    </div>
                    
                    <div class="line-row">
                        <span class="label">YALNIZ</span>
                        <span class="dots" style="font-weight: bold; font-style: italic;">${fullTextAmount}</span>
                        <span style="white-space: nowrap; margin-left: 10px;">${data.type === 'gelir' ? 'Aldım.' : 'Ödedim.'}</span>
                    </div>
                     <div class="line-row">
                        <span class="label">Alan : </span>
                        <span class="dots">${data.desc}</span>
                    </div>
                </div>

                <div class="footer-section">
                    <div class="signature-box">
                         <div class="signature-title">${data.type === 'gelir' ? 'Teslim Eden' : 'Teslim Alan'}</div>
                    </div>
                    
                    <div class="signature-box">
                         <div class="signature-title">${data.type === 'gelir' ? 'Teslim Alan' : 'Ödeyen'}</div>
                         <div style="font-weight: bold;">YÖNETİM</div>
                         <div style="font-size: 10px;">(İmza)</div>
                    </div>
                </div>
                
                <div style="position: absolute; bottom: 20px; left: -30px; transform: rotate(-90deg); font-size: 10px; color: #999;">
                    Makbuz No: ${seriCode}-${String(receiptNo).padStart(4, '0')} | ${new Date().toLocaleDateString('tr-TR')}
                </div>
            </div>
            
            <script>
                window.onload = () => { window.print(); }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};
