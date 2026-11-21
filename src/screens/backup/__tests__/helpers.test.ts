import { pickerBusy } from '../helpers';

describe('backup hub helpers', () => {
  it('recognises a picker that is still closing the last pick', () => {
    expect(pickerBusy({ code: 'ERR_PICKING_IN_PROGRESS' })).toBe(true);
    expect(pickerBusy(new Error('Different document picking in progress'))).toBe(true);
    expect(pickerBusy(new Error('No permission'))).toBe(false);
    expect(pickerBusy({ code: 'ERR_OTHER', message: 42 })).toBe(false);
    expect(pickerBusy(null)).toBe(false);
    expect(pickerBusy(undefined)).toBe(false);
  });
});
