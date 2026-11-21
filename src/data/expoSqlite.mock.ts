import { Directory, File, Paths } from 'expo-file-system';

import { openTestDatabase } from './testing/betterSqlite';

// Fixed when the module loads, so a test that points `Paths.document` elsewhere
// for a while does not move the index with it.
const folder = new Directory(Paths.document, 'SQLite');

export const databaseFilePath = (name: string) =>
  `${folder.uri.replace(/^file:\/\//, '').replace(/\/$/, '')}/${name}`;

// Jest has no SQLCipher: the adapter hands out an in-memory SQLite instead. It
// leaves a file where the real one would, so the code that lists, copies and
// installs the index finds something on the mocked file system.
export const openEncryptedDatabase = async (name: string) => {
  if (!folder.exists) folder.create({ intermediates: true });
  const file = new File(folder, name);
  if (!file.exists) file.create();
  return openTestDatabase();
};

export const deleteEncryptedDatabase = async (name: string) => {
  const file = new File(`file://${databaseFilePath(name)}`);
  if (file.exists) file.delete();
};
