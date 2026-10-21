import { Component, type ErrorInfo, type ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { t } from '../i18n';
import { Button, EmptyState } from './ui';

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null };

/**
 * Last line of defense above every provider. It never logs the error object
 * itself, because a document title or OCR text could be inside it.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error:', error.name, { componentStack: info.componentStack });
  }

  private reset = () => {
    this.setState({ error: null });
  };

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }
    if (this.props.fallback) {
      return this.props.fallback;
    }
    return (
      <View style={styles.root}>
        <EmptyState
          icon="warning"
          title={t('errors.boundary.title')}
          description={t('errors.boundary.body')}
        />
        <Button label={t('common.tryAgain')} onPress={this.reset} size="md" variant="secondary" />
      </View>
    );
  }
}

const styles = StyleSheet.create((theme) => ({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
}));
