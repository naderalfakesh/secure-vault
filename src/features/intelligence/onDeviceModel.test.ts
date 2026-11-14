import { DocumentCategory } from '@/types';

import {
  downloadOnDeviceModel,
  resetIntelligenceSelection,
  selectIntelligence,
  suggestForText,
} from './index';
import {
  checkModelAnswer,
  MAX_TEXT_LENGTH,
  MODEL_INSTRUCTIONS,
  MODEL_TIMEOUT_MS,
} from './onDeviceModel';

const model = jest.requireMock('../../../modules/expo-document-ai') as {
  setModelInfo(info: { engine: string; status: string }): void;
  setModelAnswer(answer: string | Error | ((text: string) => Promise<string>)): void;
  modelCalls(): { instructions: string; text: string }[];
  downloadCount(): number;
  resetModel(): void;
};

const passport = `REPUBLIC OF EXAMPLE
PASSPORT
Passport No. X0000000
Surname EXAMPLE
Date of issue 15 NOV 2021
Date of expiry 14 NOV 2031`;

const answer = (fields: Record<string, unknown>) =>
  JSON.stringify({
    title: 'Republic of Example passport',
    category: 'id',
    expires: '2031-11-14',
    issued: '2021-11-15',
    number: 'X0000000',
    tags: ['passport', 'travel'],
    ...fields,
  });

beforeEach(() => {
  model.resetModel();
  resetIntelligenceSelection();
});

describe('checking a model answer against the text', () => {
  it('keeps every value the text supports', () => {
    expect(checkModelAnswer(answer({}), passport)).toEqual({
      title: 'Republic of Example passport',
      category: DocumentCategory.ID,
      expires: '2031-11-14',
      issued: '2021-11-15',
      number: 'X0000000',
      tags: ['passport', 'travel'],
    });
  });

  it('drops dates and numbers the text does not contain', () => {
    const checked = checkModelAnswer(
      answer({ expires: '2032-01-01', issued: '15 Nov 2021', number: 'X9999999' }),
      passport,
    );
    expect(checked.expires).toBeUndefined();
    expect(checked.issued).toBeUndefined();
    expect(checked.number).toBeUndefined();
  });

  it('drops a number without digits, a category the app does not have, and a runaway title', () => {
    const checked = checkModelAnswer(
      answer({ number: 'Policyholder', category: 'travel', title: 'x'.repeat(61) }),
      `${passport}\nPolicyholder`,
    );
    expect(checked.number).toBeUndefined();
    expect(checked.category).toBeUndefined();
    expect(checked.title).toBeUndefined();
  });

  it('matches a number however its spaces and dashes are printed', () => {
    const text = 'Policy number EXM 2026 004217';
    expect(checkModelAnswer(answer({ number: 'exm-2026-004217' }), text).number).toBe(
      'EXM-2026-004217',
    );
  });

  it('cleans tags and keeps at most three', () => {
    const checked = checkModelAnswer(
      answer({ tags: ['Passport', 'passport', '', 42, 'a{b', 'travel', 'id card', 'extra'] }),
      passport,
    );
    expect(checked.tags).toEqual(['passport', 'travel', 'id card']);
  });

  it('reads the object out of prose or a code fence, and refuses anything that is not JSON', () => {
    expect(checkModelAnswer('```json\n' + answer({}) + '\n```', passport).number).toBe('X0000000');
    expect(() => checkModelAnswer('I cannot help with that.', passport)).toThrow();
    expect(() => checkModelAnswer('[1, 2]', passport)).toThrow();
  });
});

describe('suggestions from the on-device model', () => {
  it('uses the model when it is ready, with the shared instructions and capped text', async () => {
    model.setModelInfo({ engine: 'apple-foundation-models', status: 'available' });
    model.setModelAnswer(answer({}));
    const long = passport + '\n' + 'filler '.repeat(1000);

    const suggestion = await suggestForText(long);

    expect(suggestion.engine).toBe('apple-foundation-models');
    expect(suggestion.title).toBe('Republic of Example passport');
    expect(suggestion.category).toBe(DocumentCategory.ID);
    expect(suggestion.tags).toEqual(['id', 'passport', 'travel']);
    expect(suggestion.fields).toEqual([
      { key: 'expires', value: '2031-11-14', kind: 'date' },
      { key: 'issued', value: '2021-11-15', kind: 'date' },
      { key: 'number', value: 'X0000000', kind: 'text' },
    ]);
    const [call] = model.modelCalls();
    expect(call.instructions).toBe(MODEL_INSTRUCTIONS);
    expect(call.text.length).toBe(MAX_TEXT_LENGTH);
  });

  it('fills what the model left out or got wrong from the text patterns', async () => {
    model.setModelInfo({ engine: 'apple-foundation-models', status: 'available' });
    model.setModelAnswer(answer({ expires: '', number: 'X9999999', title: '' }));

    const suggestion = await suggestForText(passport);

    expect(suggestion.engine).toBe('apple-foundation-models');
    expect(suggestion.title).toBe('Republic Of Example');
    expect(suggestion.fields).toContainEqual({ key: 'expires', value: '2031-11-14', kind: 'date' });
    expect(suggestion.fields).toContainEqual({ key: 'number', value: 'X0000000', kind: 'text' });
  });

  it('falls back to the text patterns when the model fails or answers nonsense', async () => {
    model.setModelInfo({ engine: 'apple-foundation-models', status: 'available' });
    model.setModelAnswer(new Error('Guardrail violation'));
    expect((await suggestForText(passport)).engine).toBe('heuristic');

    model.setModelAnswer('Sure! Here is a poem about passports.');
    const suggestion = await suggestForText(passport);
    expect(suggestion.engine).toBe('heuristic');
    expect(suggestion.category).toBe(DocumentCategory.ID);
  });

  it('falls back to the text patterns when the model takes too long', async () => {
    jest.useFakeTimers();
    try {
      model.setModelInfo({ engine: 'apple-foundation-models', status: 'available' });
      model.setModelAnswer(() => new Promise(() => {}));

      const pending = suggestForText(passport);
      await jest.advanceTimersByTimeAsync(MODEL_TIMEOUT_MS + 1);

      expect((await pending).engine).toBe('heuristic');
    } finally {
      jest.useRealTimers();
    }
  });

  it('is not picked while the model is missing or still downloading', async () => {
    for (const status of ['unavailable', 'downloadable', 'downloading']) {
      resetIntelligenceSelection();
      model.setModelInfo({ engine: 'gemini-nano', status });
      expect((await selectIntelligence()).engine).toBe('heuristic');
    }
    expect(model.modelCalls()).toEqual([]);
  });

  it('picks the model up after the owner downloads it', async () => {
    model.setModelInfo({ engine: 'apple-foundation-models', status: 'downloadable' });
    expect((await selectIntelligence()).engine).toBe('heuristic');

    model.setModelInfo({ engine: 'apple-foundation-models', status: 'available' });
    await downloadOnDeviceModel();

    expect(model.downloadCount()).toBe(1);
    expect((await selectIntelligence()).engine).toBe('apple-foundation-models');
  });
});
