
export function numberToTurkishWords(num: number): string {
    if (num === 0) return "SIFIR";

    const birler = ["", "BİR", "İKİ", "ÜÇ", "DÖRT", "BEŞ", "ALTI", "YEDİ", "SEKİZ", "DOKUZ"];
    const onlar = ["", "ON", "YİRMİ", "OTUZ", "KIRK", "ELLİ", "ALTMIŞ", "YETMİŞ", "SEKSEN", "DOKSAN"];
    const binler = ["", "BİN", "MİLYON", "MİLYAR"];

    // Sayıyı string'e çevirip kuruşu ayır
    const parts = num.toFixed(2).split('.');
    let integerPart = parseInt(parts[0]);
    const decimalPart = parseInt(parts[1]);

    if (integerPart === 0) return "SIFIR";

    let words = "";
    let i = 0;

    while (integerPart > 0) {
        const ucHane = integerPart % 1000;
        if (ucHane !== 0) {
            let chunkWords = "";
            if (ucHane === 1 && i === 1) {
                chunkWords = "BİN"; // "Bir Bin" denmez, sadece "Bin"
            } else {
                const yuzlerBasamagı = Math.floor(ucHane / 100);
                const onlarBasamagı = Math.floor((ucHane % 100) / 10);
                const birlerBasamagı = ucHane % 10;

                if (yuzlerBasamagı > 0) {
                    chunkWords += (yuzlerBasamagı > 1 ? birler[yuzlerBasamagı] : "") + "YÜZ";
                }
                if (onlarBasamagı > 0) {
                    chunkWords += onlar[onlarBasamagı];
                }
                if (birlerBasamagı > 0) {
                    chunkWords += birler[birlerBasamagı];
                }
                chunkWords += binler[i];
            }
            words = chunkWords + words;
        }
        integerPart = Math.floor(integerPart / 1000);
        i++;
    }

    let result = words;
    if (decimalPart > 0) {
        // Kuruş hesabı basitçe rakamla veya yazı ile eklenebilir. Makbuz standardı genelde kuruşu rakamla yazar veya yazıya döker.
        result += ` NOKTA ${decimalPart} KURUŞ`;
    }

    return result;
}
