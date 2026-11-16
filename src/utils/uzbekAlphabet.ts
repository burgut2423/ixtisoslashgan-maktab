export type AlphabetMode = 'classic' | 'updated';

export function convertUzbekAlphabet(
  text: string | undefined | null,
  mode: AlphabetMode
): string {
  if (!text || mode === 'classic') return text || '';

  return text
    // O' / O‘ / Oʻ -> Ö
    .replace(/O[‘’'ʻʼ`]/g, 'Ö')
    .replace(/o[‘’'ʻʼ`]/g, 'ö')
    // G' / G‘ / Gʻ -> Ğ
    .replace(/G[‘’'ʻʼ`]/g, 'Ğ')
    .replace(/g[‘’'ʻʼ`]/g, 'ğ')
    // Sh -> Ş
    .replace(/SH/g, 'Ş')
    .replace(/Sh/g, 'Ş')
    .replace(/sh/g, 'ş')
    // Ch -> Ç
    .replace(/CH/g, 'Ç')
    .replace(/Ch/g, 'Ç')
    .replace(/ch/g, 'ç');
}
