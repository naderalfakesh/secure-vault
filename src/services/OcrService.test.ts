import { ocrService } from './OcrService';

describe('ocr text cleaning', () => {
  it('keeps line breaks and collapses runs of spaces', () => {
    const raw = 'REPUBLIC   OF EXAMPLE\r\n\r\nPassport No:\tX1234567 \n \n Surname: DOE\n';
    expect(ocrService.cleanText(raw)).toBe(
      'REPUBLIC OF EXAMPLE\nPassport No: X1234567\nSurname: DOE',
    );
  });

  it('leaves document numbers untouched', () => {
    expect(ocrService.cleanText('Card 0A1B-2020')).toBe('Card 0A1B-2020');
  });

  it('treats mostly numeric output as noise', () => {
    expect(ocrService.isTextMeaningful('12 34 56 78')).toBe(false);
    expect(ocrService.isTextMeaningful('Passport No: X1234567')).toBe(true);
  });
});
