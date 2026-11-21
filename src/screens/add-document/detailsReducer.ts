import { formatTags } from '@/features/documents/tags';
import type { DocumentSuggestion } from '@/features/intelligence';
import type { ExtractedField } from '@/types';
import { DocumentCategory } from '@/types';

/** The details form: what reading suggested, as the user corrected it. */
export type DetailsState = {
  title: string;
  titleMissing: boolean;
  category: DocumentCategory;
  categorySuggested: boolean;
  tags: string;
  fields: ExtractedField[];
  ocrText: string | undefined;
};

export type DetailsAction =
  | { type: 'reset'; title: string }
  | { type: 'read'; ocrText: string | undefined }
  | { type: 'suggest'; suggestion: DocumentSuggestion }
  | { type: 'title'; title: string }
  | { type: 'titleMissing' }
  | { type: 'category'; category: DocumentCategory }
  | { type: 'tags'; tags: string }
  | { type: 'removeField'; key: string };

/** Empty details, with the title the source suggests. */
export function initialDetails(title = ''): DetailsState {
  return {
    title,
    titleMissing: false,
    category: DocumentCategory.OTHER,
    categorySuggested: false,
    tags: '',
    fields: [],
    ocrText: undefined,
  };
}

export function detailsReducer(state: DetailsState, action: DetailsAction): DetailsState {
  switch (action.type) {
    case 'reset':
      return initialDetails(action.title);
    case 'read':
      return { ...state, ocrText: action.ocrText };
    case 'suggest': {
      // Only what the suggestion found replaces what is there.
      const { suggestion } = action;
      return {
        ...state,
        title: suggestion.title ? suggestion.title : state.title,
        category: suggestion.category ? suggestion.category : state.category,
        categorySuggested: suggestion.category ? true : state.categorySuggested,
        tags: suggestion.tags.length ? formatTags(suggestion.tags) : state.tags,
        fields: suggestion.fields,
      };
    }
    case 'title':
      // Typing a title clears the error; clearing it again waits for the next save.
      return {
        ...state,
        title: action.title,
        titleMissing: action.title.trim() ? false : state.titleMissing,
      };
    case 'titleMissing':
      return { ...state, titleMissing: true };
    case 'category':
      return { ...state, category: action.category };
    case 'tags':
      return { ...state, tags: action.tags };
    case 'removeField':
      return { ...state, fields: state.fields.filter((field) => field.key !== action.key) };
  }
}
