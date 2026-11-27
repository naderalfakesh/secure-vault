import { Component, type ErrorInfo } from 'react';
import { View } from 'react-native';

import { t } from '@/i18n';

import { Button, EmptyState } from '../ui';
import { styles } from './ErrorBoundary.styles';
import type { ErrorBoundaryProps, ErrorBoundaryState } from './types';

// Never log the error object: it may contain document titles or OCR text.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
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
