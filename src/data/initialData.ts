// Types and initial data for the apartment management system

export interface Apartment {
  daireNo: number;
  sakinAdi: string;
  mulkSahibi: string;
  ownerPhone?: string;
  residentPhone?: string;
  asansorTabi: boolean;
  isManager?: boolean;
  blok?: string;
  accessCode?: string;
}

export interface MonthlyDues {
  daireNo: number;
  sakinAdi: string;
  devredenBorc2024: number;
  odemeler: Record<string, number>;
  extraFees?: Record<string, number>;
  asansorOdemesi: number;
  toplamOdenen: number;
  borc: number;
  gecikmeCezasi: number;
  odenecekToplamBorc: number;
}

export interface LedgerRow {
  id: number;
  tarih: string;
  aciklama: string;
  tutar: number;
  kategori: string;
  tip?: 'gelir' | 'gider';
  ay?: string;
}

export interface LedgerParams {
  [month: string]: {
    giderler: LedgerRow[];
    gelirler: LedgerRow[];
  };
}

export interface StaffRecord {
  ay: string;
  maas: number;
  mesai: number;
  odenen: number;
  avans: number;
  alacak: number;
  toplamOdenen: number;
}

export interface MonthlySummary {
  ay: string;
  gelir: number;
  gider: number;
  asansor: number;
  kasa: number;
  banka: number;
  fark: number;
}

export const MONTHS = [
  'OCAK', 'ŞUBAT', 'MART', 'NİSAN', 'MAYIS', 'HAZİRAN',
  'TEMMUZ', 'AĞUSTOS', 'EYLÜL', 'EKİM', 'KASIM', 'ARALIK'
];

export const MONTHLY_DUES = 0;
export const ELEVATOR_FEE = 0;

export const EXPENSE_CATEGORIES = [
  'Yönetim Huzur Hakkı',
  'Temizlik Malz. ve Su Gideri',
  'Elektrik Gideri',
  'Kapıcı Aylık',
  'Tazminat',
  'Kapıcı Sigorta',
  'Muhasebe',
  'Asansör Bakım-Onarım',
  'Öngörülemeyen Giderler',
  'EFT/Havale Masrafı',
  'ASKİ Su',
  'Diğer'
];

export const INCOME_CATEGORIES = [
  'Aidat Ödemesi',
  'Asansör Demirbaş',
  'Diğer'
];

// Temizlenmiş başlangıç verileri
export const apartments: Apartment[] = [];
export const duesSchedule: MonthlyDues[] = [];
export const staffRecords: StaffRecord[] = MONTHS.map(month => ({
  ay: month,
  maas: 0,
  mesai: 0,
  odenen: 0,
  avans: 0,
  alacak: 0,
  toplamOdenen: 0
}));

export const monthlySummary: MonthlySummary[] = [
  { ay: 'Devir', gelir: 0, gider: 0, asansor: 0, kasa: 0, banka: 0, fark: 0 },
  ...MONTHS.map(month => ({
    ay: month,
    gelir: 0,
    gider: 0,
    asansor: 0,
    kasa: 0,
    banka: 0,
    fark: 0
  }))
];

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const initialLedgerData: LedgerParams = MONTHS.reduce((acc, month) => ({
  ...acc,
  [month]: { giderler: [], gelirler: [] }
}), {});
