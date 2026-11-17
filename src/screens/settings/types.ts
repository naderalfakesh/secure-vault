/** The Delete everything sheet, with the number of documents it erases (null while counting). */
export type EraseRequest = { count: number | null };

/** Work this screen runs itself. */
export type SettingsBusy = 'clear' | null;
