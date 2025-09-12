import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import VaultLockedScreen from '@screens/VaultLocked';
import VaultUnlockedScreen from '@screens/VaultUnlocked';
import NoteListScreen from '@screens/NoteList';
import NoteDetailScreen from '@screens/NoteDetail';
import SettingsScreen from '@screens/Settings';

export type RootStackParamList = {
  VaultLocked: undefined;
  VaultUnlocked: undefined;
  NoteList: undefined;
  NoteDetail: { noteId: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="VaultLocked">
        <Stack.Screen name="VaultLocked" component={VaultLockedScreen} />
        <Stack.Screen name="VaultUnlocked" component={VaultUnlockedScreen} />
        <Stack.Screen name="NoteList" component={NoteListScreen} />
        <Stack.Screen name="NoteDetail" component={NoteDetailScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
