import type { FlowAction, FlowState } from '../flowReducer';
import { flowReducer, initialFlowState } from '../flowReducer';

const run = (actions: FlowAction[], from: FlowState = initialFlowState) =>
  actions.reduce(flowReducer, from);

const failed = { kind: 'failed', message: 'No luck' } as const;

describe('flowReducer', () => {
  it('starts on the sources with nothing held', () => {
    expect(initialFlowState).toEqual({
      phase: 'sources',
      origin: 'single',
      problem: null,
      step: 'ocr',
      saveError: null,
      savedId: null,
    });
  });

  it('pagesScanned clears the problem and shows the review of a scan', () => {
    const state = flowReducer({ ...initialFlowState, problem: failed }, { type: 'pagesScanned' });
    expect(state).toEqual({ ...initialFlowState, origin: 'scan', phase: 'review' });
  });

  it('singlePicked clears the problem and marks a single origin', () => {
    const start: FlowState = { ...initialFlowState, origin: 'scan', problem: failed };
    expect(flowReducer(start, { type: 'singlePicked' })).toEqual({
      ...initialFlowState,
      origin: 'single',
    });
  });

  it('sourceFailed keeps the problem and leaves the phase', () => {
    const state = flowReducer(initialFlowState, { type: 'sourceFailed', problem: failed });
    expect(state).toEqual({ ...initialFlowState, problem: failed });
  });

  it('readingStarted shows the reading phase at the first step', () => {
    const start: FlowState = { ...initialFlowState, step: 'index' };
    expect(flowReducer(start, { type: 'readingStarted' })).toEqual({
      ...initialFlowState,
      step: 'ocr',
      phase: 'reading',
    });
  });

  it('readingAdvanced moves the step only', () => {
    const start: FlowState = { ...initialFlowState, phase: 'reading' };
    expect(flowReducer(start, { type: 'readingAdvanced', step: 'suggest' })).toEqual({
      ...start,
      step: 'suggest',
    });
  });

  it('detailsReady shows the details', () => {
    const start: FlowState = { ...initialFlowState, phase: 'reading' };
    expect(flowReducer(start, { type: 'detailsReady' }).phase).toBe('details');
  });

  it('saveStarted clears the error and shows the encrypting step', () => {
    const start: FlowState = { ...initialFlowState, phase: 'details', saveError: 'Nope' };
    expect(flowReducer(start, { type: 'saveStarted' })).toEqual({
      ...start,
      saveError: null,
      step: 'encrypt',
      phase: 'saving',
    });
  });

  it('saveAdvanced moves the step only', () => {
    const start: FlowState = { ...initialFlowState, phase: 'saving', step: 'encrypt' };
    expect(flowReducer(start, { type: 'saveAdvanced', step: 'index' })).toEqual({
      ...start,
      step: 'index',
    });
  });

  it('saved keeps the document id', () => {
    expect(flowReducer(initialFlowState, { type: 'saved', id: 'doc-1' }).savedId).toBe('doc-1');
  });

  it('saveFailed keeps the message and stays on the saving phase', () => {
    const start: FlowState = { ...initialFlowState, phase: 'saving' };
    expect(flowReducer(start, { type: 'saveFailed', message: 'Nope' })).toEqual({
      ...start,
      saveError: 'Nope',
    });
  });

  it('saveReset clears the error and the saved id only', () => {
    const start: FlowState = {
      ...initialFlowState,
      phase: 'details',
      saveError: 'Nope',
      savedId: 'doc-1',
    };
    expect(flowReducer(start, { type: 'saveReset' })).toEqual({
      ...start,
      saveError: null,
      savedId: null,
    });
  });

  it('returnedToSources, returnedToReview and returnedToDetails set the phase only', () => {
    const start: FlowState = { ...initialFlowState, origin: 'scan', problem: failed };
    expect(flowReducer(start, { type: 'returnedToSources' })).toEqual({
      ...start,
      phase: 'sources',
    });
    expect(flowReducer(start, { type: 'returnedToReview' })).toEqual({ ...start, phase: 'review' });
    expect(flowReducer(start, { type: 'returnedToDetails' })).toEqual({
      ...start,
      phase: 'details',
    });
  });

  it('walks a scan from the sources to a saved document', () => {
    const states = [
      { type: 'pagesScanned' },
      { type: 'readingStarted' },
      { type: 'readingAdvanced', step: 'suggest' },
      { type: 'detailsReady' },
      { type: 'saveStarted' },
      { type: 'saved', id: 'doc-1' },
      { type: 'saveAdvanced', step: 'index' },
    ] satisfies FlowAction[];
    expect(run(states)).toEqual({
      phase: 'saving',
      origin: 'scan',
      problem: null,
      step: 'index',
      saveError: null,
      savedId: 'doc-1',
    });
  });

  it('retries a failed save from the details', () => {
    const failedSave = run([
      { type: 'singlePicked' },
      { type: 'saveReset' },
      { type: 'readingStarted' },
      { type: 'detailsReady' },
      { type: 'saveStarted' },
      { type: 'saveFailed', message: 'Nope' },
    ]);
    expect(failedSave).toMatchObject({ phase: 'saving', step: 'encrypt', saveError: 'Nope' });

    const retried = run([{ type: 'saveStarted' }, { type: 'saved', id: 'doc-2' }], failedSave);
    expect(retried).toMatchObject({ phase: 'saving', saveError: null, savedId: 'doc-2' });
  });
});
