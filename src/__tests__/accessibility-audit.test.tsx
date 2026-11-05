import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { type ComponentType, useEffect } from 'react';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { closeDocumentStore } from '@/data/database';
import { auditAccessibility, countControls } from '@/testing/accessibilityAudit';

import LibraryScreen from '../../app/(tabs)/index';
import SettingsScreen from '../../app/(tabs)/settings';
import AddDocumentScreen from '../../app/documents/add';
import DocumentViewerScreen from '../../app/documents/[id]';
import LockScreen from '../../app/lock';
import AutoLockScreen from '../../app/settings/auto-lock';
import BackupScreen from '../../app/settings/backup';
import ChangePinScreen from '../../app/settings/change-pin';
import ProtectionScreen from '../../app/settings/protection';
import BiometricsScreen from '../../app/setup/biometrics';
import OnboardingScreen from '../../app/setup/index';
import SetupPinScreen from '../../app/setup/pin';
import vault from '../../modules/expo-vault';
import { ToastProvider } from '../components/ui';
import { hashPasscode } from '@/testing/passcode';
import { SessionProvider, useSession } from '../features/session/SessionProvider';
import { documentService } from '../services/DocumentService';
import { DocumentCategory } from '../types';

jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => {}) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));
jest.mock('expo-router', () => {
  const params: { id?: string } = {};
  return {
    __params: params,
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
    useLocalSearchParams: () => params,
    Redirect: () => null,
    Stack: { Screen: () => null },
  };
});

const routeParams = (jest.requireMock('expo-router') as { __params: { id?: string } }).__params;
const secureStoreMock = SecureStore as unknown as { __reset(): void };
const vaultMock = vault as unknown as { reset(): void };

/** An Arabic title, so every list and sentence is walked with it. */
const ARABIC_TITLE = 'عقد الإيجار 2026.pdf';

let session: ReturnType<typeof useSession>;

function Gate({ Screen, status }: { Screen: ComponentType; status: string }) {
  const value = useSession();
  useEffect(() => {
    session = value;
  });
  return value.status === status ? <Screen /> : <Text>{value.status}</Text>;
}

async function renderAt(Screen: ComponentType, status: 'unlocked' | 'setup' = 'unlocked') {
  const view = await render(
    <GestureHandlerRootView>
      <SessionProvider>
        <ToastProvider>
          <Gate Screen={Screen} status={status} />
        </ToastProvider>
      </SessionProvider>
    </GestureHandlerRootView>,
  );
  if (status === 'unlocked') {
    await waitFor(() => expect(view.getByText('setup')).toBeOnTheScreen());
    await act(async () => {
      await session.setUp('123456');
      await session.updateSettings({ autoLockSeconds: -1 });
    });
  }
  return view;
}

async function addLease() {
  return documentService.addDocument(
    { uri: '/tmp/lease.jpg', name: 'lease.jpg', type: 'image/jpeg', size: 2048 },
    { title: ARABIC_TITLE, category: DocumentCategory.LEGAL },
  );
}

function expectAccessible(view: Awaited<ReturnType<typeof render>>) {
  const json = view.toJSON();
  expect(countControls(json)).toBeGreaterThan(0);
  expect(auditAccessibility(json)).toEqual([]);
}

describe('accessibility audit of the main screens', () => {
  beforeEach(async () => {
    vaultMock.reset();
    secureStoreMock.__reset();
    await closeDocumentStore();
  });

  afterEach(() => jest.restoreAllMocks());

  const unlockedScreens: [string, ComponentType][] = [
    ['Settings', SettingsScreen],
    ['Auto-lock', AutoLockScreen],
    ['How your data is protected', ProtectionScreen],
    ['Backup hub', BackupScreen],
    ['Change PIN', ChangePinScreen],
    ['Add a document', AddDocumentScreen],
  ];

  it.each(unlockedScreens)('%s labels every control and keeps 44 pt targets', async (_, Screen) => {
    const view = await renderAt(Screen);
    await waitFor(() => expect(countControls(view.toJSON())).toBeGreaterThan(0));
    expectAccessible(view);
  });

  it('Library labels every control and keeps 44 pt targets, with an Arabic title', async () => {
    const view = await renderAt(LibraryScreen);
    await act(async () => {
      await addLease();
    });
    await waitFor(() => expect(view.getAllByText(/عقد الإيجار/).length).toBeGreaterThan(0));
    expectAccessible(view);
  });

  it('Viewer labels every control and keeps 44 pt targets, with an Arabic title', async () => {
    const view = await renderAt(DocumentViewerScreen);
    let id = '';
    await act(async () => {
      id = (await addLease()).id;
    });
    routeParams.id = id;
    await view.rerender(
      <GestureHandlerRootView>
        <SessionProvider>
          <ToastProvider>
            <Gate Screen={DocumentViewerScreen} status="unlocked" />
          </ToastProvider>
        </SessionProvider>
      </GestureHandlerRootView>,
    );
    await waitFor(() => expect(view.getByLabelText(/^Page 1 of 1/)).toBeOnTheScreen());
    expectAccessible(view);
  });

  it.each([
    ['Intro', OnboardingScreen],
    ['Choose a PIN', SetupPinScreen],
  ] as [string, ComponentType][])(
    '%s labels every control and keeps 44 pt targets',
    async (_, Screen) => {
      const view = await renderAt(Screen, 'setup');
      await waitFor(() => expect(countControls(view.toJSON())).toBeGreaterThan(0));
      expectAccessible(view);
    },
  );

  it('Biometrics step labels every control and keeps 44 pt targets', async () => {
    const view = await renderAt(BiometricsScreen, 'setup');
    await act(async () => {
      await session.setUp('123456', { holdForOnboarding: true });
    });
    await waitFor(() => expect(countControls(view.toJSON())).toBeGreaterThan(0));
    expectAccessible(view);
  });

  it('Lock labels every control and keeps 44 pt targets', async () => {
    await vault.createVault();
    await SecureStore.setItemAsync('securevault.pin', hashPasscode('123456', { iterations: 64 }));
    const view = await render(
      <SessionProvider>
        <LockScreen />
      </SessionProvider>,
    );
    await waitFor(() => expect(view.getByText('SecureVault is locked')).toBeOnTheScreen());
    expectAccessible(view);
  });
});
