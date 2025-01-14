import { useCallback, useEffect } from 'react';
import { Alert, Appearance } from 'react-native';
import { SUBSCRIBER_EVENTS } from '@walletconnect/core';
import { ExplorerCtrl } from '../controllers/ExplorerCtrl';
import { OptionsCtrl } from '../controllers/OptionsCtrl';
import { ConfigCtrl } from '../controllers/ConfigCtrl';
import { ClientCtrl } from '../controllers/ClientCtrl';
import { AccountCtrl } from '../controllers/AccountCtrl';
import { WcConnectionCtrl } from '../controllers/WcConnectionCtrl';
import type { IProviderMetadata } from '../types/coreTypes';
import { createUniversalProvider } from '../utils/ProviderUtil';
import { removeDeepLinkWallet } from '../utils/StorageUtil';
import { ThemeCtrl } from '../controllers/ThemeCtrl';

interface Props {
  projectId: string;
  providerMetadata: IProviderMetadata;
  relayUrl?: string;
  themeMode?: 'light' | 'dark';
}

export function useConfigure({
  projectId,
  relayUrl,
  providerMetadata,
  themeMode,
}: Props) {
  const resetApp = useCallback(() => {
    ClientCtrl.resetSession();
    AccountCtrl.resetAccount();
    WcConnectionCtrl.resetConnection();
    ConfigCtrl.resetConfig();
    removeDeepLinkWallet();
  }, []);

  const onSessionDelete = useCallback(
    ({ topic }: { topic: string }) => {
      const sessionTopic = ClientCtrl.sessionTopic();
      if (topic === sessionTopic) {
        resetApp();
      }
    },
    [resetApp]
  );

  const onDisplayUri = useCallback(async (uri: string) => {
    WcConnectionCtrl.setPairingUri(uri);
  }, []);

  /**
   * Set theme mode
   */
  useEffect(() => {
    const themeListener = Appearance.addChangeListener(({ colorScheme }) => {
      if (!themeMode && colorScheme) ThemeCtrl.setThemeMode(colorScheme);
    });

    ThemeCtrl.setThemeMode(themeMode);

    return () => {
      themeListener.remove();
    };
  }, [themeMode]);

  /**
   * Set config
   */
  useEffect(() => {
    ConfigCtrl.setProjectId(projectId);
  }, [projectId]);

  /**
   * Fetch wallet list
   */
  useEffect(() => {
    async function fetchWallets() {
      try {
        if (!ExplorerCtrl.state.wallets.total) {
          await ExplorerCtrl.getMobileWallets({ version: 2 });
          OptionsCtrl.setIsDataLoaded(true);
        }
      } catch (error) {
        Alert.alert('Error', 'Error fetching wallets');
      }
    }
    fetchWallets();
  }, []);

  /**
   * Initialize provider
   */
  useEffect(() => {
    async function initProvider() {
      try {
        const provider = await createUniversalProvider({
          projectId,
          relayUrl,
          metadata: providerMetadata,
        });
        if (provider) {
          ClientCtrl.setProvider(provider);
          provider.on('display_uri', onDisplayUri);
          provider.client.core.relayer.subscriber.on(
            SUBSCRIBER_EVENTS.deleted,
            onSessionDelete
          );

          // Check if there is an active session
          if (provider.session) {
            ClientCtrl.setSessionTopic(provider.session.topic);
            await AccountCtrl.getAccount();
          }
          ClientCtrl.setInitialized(true);
        }
      } catch (error) {
        Alert.alert('Error', 'Error initializing provider');
      }
    }
    if (!ClientCtrl.provider() && projectId && providerMetadata) {
      initProvider();
    }
  }, [projectId, providerMetadata, relayUrl, onDisplayUri, onSessionDelete]);
}
