import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Platform } from 'react-native';

import type { RecognizedLine, RecognizedText } from '../../../../modules/expo-document-ai';
import { ocrService } from '../OcrService';

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  __esModule: true,
  default: { recognize: jest.fn() },
}));

const vision = jest.requireMock('../../../../modules/expo-document-ai') as {
  setRecognizedText(next: RecognizedText | Error): void;
  recognizedPaths(): string[];
  resetModel(): void;
};
const mlKit = TextRecognition.recognize as jest.Mock;

const line = (text: string, left: number, top: number, width = 200): RecognizedLine => ({
  text,
  frame: { left, top, width, height: 20 },
});

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

describe('platform text readers', () => {
  beforeEach(() => {
    vision.resetModel();
    mlKit.mockReset();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('on iOS', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'ios');
    });

    it('reads with Apple Vision and never calls ML Kit', async () => {
      vision.setRecognizedText({
        width: 1000,
        height: 600,
        lines: [
          line('REPUBLIC OF EXAMPLE', 300, 20, 400),
          line('Date of issue', 40, 300),
          line('Date of expiry', 500, 302),
          line('12 MAR 2020', 40, 330),
          line('12 MAR 2030', 500, 331),
        ],
      });

      const result = await ocrService.extractText('/tmp/passport.jpg');

      expect(vision.recognizedPaths()).toEqual(['file:///tmp/passport.jpg']);
      expect(mlKit).not.toHaveBeenCalled();
      expect(result.text).toBe(
        'REPUBLIC OF EXAMPLE\n\nDate of issue\n12 MAR 2020\n\nDate of expiry\n12 MAR 2030',
      );
      expect(result.blocks[1]).toEqual({
        text: 'Date of issue\n12 MAR 2020',
        lines: ['Date of issue', '12 MAR 2020'],
        boundingBox: { left: 40, top: 300, right: 240, bottom: 350 },
      });
    });

    it('keeps a file URI as it is', async () => {
      await ocrService.extractText('file:///tmp/scan.jpg');
      expect(vision.recognizedPaths()).toEqual(['file:///tmp/scan.jpg']);
    });

    it('returns an empty result when Vision fails, so the import goes on', async () => {
      vision.setRecognizedText(new Error('Could not read text from the image: unreadable-image.'));
      await expect(ocrService.extractText('/tmp/broken.jpg')).resolves.toEqual({
        text: '',
        blocks: [],
      });
    });
  });

  describe('on Android', () => {
    beforeEach(() => {
      jest.replaceProperty(Platform, 'OS', 'android');
    });

    it('reads with ML Kit and never calls Vision', async () => {
      mlKit.mockResolvedValue({
        text: 'Passport\nNo X1234567',
        blocks: [
          {
            text: 'Passport\nNo X1234567',
            frame: { left: 10, top: 20, width: 100, height: 40 },
            lines: [{ text: 'Passport' }, { text: 'No X1234567' }],
          },
          { text: 'Surname DOE', lines: [{ text: 'Surname DOE' }] },
        ],
      });

      const result = await ocrService.extractText('/data/scan.jpg');

      expect(mlKit).toHaveBeenCalledWith('file:///data/scan.jpg');
      expect(vision.recognizedPaths()).toEqual([]);
      expect(result).toEqual({
        text: 'Passport\nNo X1234567\n\nSurname DOE',
        blocks: [
          {
            text: 'Passport\nNo X1234567',
            lines: ['Passport', 'No X1234567'],
            boundingBox: { left: 10, top: 20, right: 110, bottom: 60 },
          },
          { text: 'Surname DOE', lines: ['Surname DOE'], boundingBox: undefined },
        ],
      });
    });

    it('returns an empty result when ML Kit fails', async () => {
      mlKit.mockRejectedValue(new Error('ML Kit failed'));
      await expect(ocrService.extractText('/data/scan.jpg')).resolves.toEqual({
        text: '',
        blocks: [],
      });
    });
  });
});
