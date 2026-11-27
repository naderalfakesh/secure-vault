import { Screen } from '@/components/ui';

import { EmptyLibrary } from '../EmptyLibrary';
import { LibrarySkeleton } from '../LibrarySkeleton';
import { LibraryTitle } from '../LibraryTitle';
import { LoadFailed } from '../LoadFailed';

type LibraryStatusProps =
  | { status: 'failed'; error: string; onRetry: () => void }
  | { status: 'loading'; showSkeleton: boolean }
  | { status: 'empty'; bottomSpace: number; onAdd: () => void };

export function LibraryStatus(props: LibraryStatusProps) {
  return (
    <Screen>
      <LibraryTitle />
      {props.status === 'failed' ? (
        <LoadFailed error={props.error} onRetry={props.onRetry} />
      ) : null}
      {props.status === 'loading' && props.showSkeleton ? <LibrarySkeleton /> : null}
      {props.status === 'empty' ? (
        <EmptyLibrary bottomSpace={props.bottomSpace} onAdd={props.onAdd} />
      ) : null}
    </Screen>
  );
}
