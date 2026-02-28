// Utility for exporting table data as CSV (Excel-compatible) with enhanced formatting

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][], options?: {
  title?: string;
  subtitle?: string;
  highlightNegatives?: boolean;
}) {
  // BOM for UTF-8 support in Excel
  const BOM = '\uFEFF';

  const lines: string[] = [];

  if (options?.title) {
    lines.push(options.title);
    lines.push('');
  }

  if (options?.subtitle) {
    lines.push(options.subtitle);
    lines.push('');
  }

  lines.push(headers.join(';'));

  rows.forEach(row => {
    const formattedRow = row.map((cell) => {
      let str = String(cell);
      if (typeof cell === 'number') {
        str = cell.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(formattedRow.join(';'));
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// Export with proper CSV format - Excel opens without format errors
export function exportToExcel(filename: string, data: {
  title?: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  highlightColumns?: number[];
  redIfNegative?: number[];
  coloredCells?: { row: number; col: number; color: 'red' | 'green' | 'yellow' }[];
}) {
  const { title, subtitle, headers, rows } = data;

  // BOM for UTF-8 Excel compatibility
  const BOM = '\uFEFF';
  const lines: string[] = [];

  if (title) lines.push(`"${title}";;;;;;`);
  if (subtitle) lines.push(`"${subtitle}";;;;;;`);
  if (title || subtitle) lines.push('');

  // Headers
  lines.push(headers.map(h => `"${h}"`).join(';'));

  // Data rows
  rows.forEach(row => {
    const formattedRow = row.map(cell => {
      if (typeof cell === 'number') {
        return cell.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      const str = String(cell ?? '');
      // Wrap in quotes if contains special chars
      if (str.includes(';') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    lines.push(formattedRow.join(';'));
  });

  const csvContent = lines.join('\n');
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  // Save as .csv instead of .xlsx to avoid Excel format validation error
  link.download = `${filename}_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
