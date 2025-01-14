import React, { useState, useEffect, useRef } from 'react';
import { Modal, message } from 'antd';
import classnames from 'classnames';
import { CloseOutlined } from '@ant-design/icons';
import { AccountContext } from '@/context/account-context';
import {
  IUser,
  clearCurrentAccount,
  getCurrentAccount,
  setCurrentAccount,
} from '@/core/account';
import Chrome from '@/core/chrome';
import {
  REQUEST_HEADER_VERSION,
  EXTENSION_ID,
  VERSION,
  TRACERT_CONFIG,
  REFERER_URL,
} from '@/config';
import eventManager from '@/core/event/eventManager';
import { AppEvents } from '@/core/event/events';
import { mineProxy } from '@/core/proxy/mine';
import { SERVER_URLS } from '@/isomorphic/constants';
import { useEffectAsync } from '@/hooks/useAsyncEffect';
import { findCookieSettingPage } from '@/core/uitl';
import useClickAway from '@/hooks/useClickAway';
import { onSandboxClose } from '@/pages/sandbox/helper';
import Login from './login';
import styles from './index.module.less';

declare const Tracert: any;

interface IAccountLayoutProps {
  children: React.ReactNode;
  position?: 'rightTop' | 'center';
  close?: () => void;
}

function AccountLayout(props: IAccountLayoutProps) {
  const { position = 'rightTop', close } = props;
  const [user, setUser] = useState<IUser | null>(null);
  const [ready, setAppReady] = useState(false);
  const [forceUpgradeInfo, setForceUpgradeInfo] = useState<string>();
  const ref = useRef<HTMLDivElement>(null);

  useClickAway(ref, () => {
    onSandboxClose();
  });

  const createLoginWindow = (): Promise<number> => {
    return new Promise(resolve => {
      Chrome.windows.create(
        {
          focused: true,
          width: 500,
          height: 680,
          left: 400,
          top: 100,
          type: 'panel',
          url: SERVER_URLS.LOGOUT,
        },
        ({ id: windowId }) => resolve(windowId),
      );
    });
  };

  const waitForWindowLogined = (windowId: number) => {
    return new Promise<void>(resolve => {
      Chrome.webRequest.onCompleted.addListener(
        data => {
          if ([SERVER_URLS.DASHBOARD, SERVER_URLS.LOGIN].includes(data.url)) {
            if (data.statusCode === 200) {
              resolve();
            }
          }
        },
        {
          urls: [],
          windowId,
        },
      );
    });
  };

  const removeWindow = (windowId: number) => {
    return new Promise(resolve => {
      Chrome.windows.remove(windowId, resolve);
    });
  };

  const onLogin = async () => {
    const windowId = await createLoginWindow();
    await waitForWindowLogined(windowId);
    await removeWindow(windowId);
    const accountInfo = await mineProxy.getUserInfo();
    if (!accountInfo) {
      message.error(__i18n('登录失败'));
      return;
    }
    await setCurrentAccount(accountInfo);
    setUser(accountInfo);
  };

  const renderUnLogin = () => {
    return (
      <div
        className={classnames(styles[position], styles.loginWrapper)}
        ref={ref}
      >
        {forceUpgradeInfo ? (
          <div dangerouslySetInnerHTML={{ __html: forceUpgradeInfo }} />
        ) : (
          <Login onConfirm={onLogin} />
        )}
        {close && (
          <div onClick={close} className={styles.closeWrapper}>
            <CloseOutlined />
          </div>
        )}
      </div>
    );
  };

  const onLogout = (data = {}) => {
    clearCurrentAccount().then(() => {
      setUser(undefined);
      if ((data as any).html) {
        setForceUpgradeInfo((data as any)?.html);
      }
    });
  };

  useEffectAsync(async () => {
    const info = await getCurrentAccount();
    try {
      if (!navigator.cookieEnabled) {
        await new Promise(resolve => {
          const pageUrl = findCookieSettingPage();
          Modal.info({
            content: __i18n('请前往「隐私和安全」打开「允许第三方cookies」，避免登录失败'),
            title: __i18n('使用提示'),
            closable: true,
            icon: null,
            okText: pageUrl ? __i18n('打开隐私和安全') : __i18n('确定'),
            autoFocusButton: null,
            onOk: () => {
              if (pageUrl) {
                Chrome.tabs.create({ url: pageUrl });
              }
              resolve(true);
            },
            afterClose: () => {
              resolve(true);
            },
          });
        });
      }
      const accountInfo = await mineProxy.getUserInfo();
      if (accountInfo && accountInfo?.id === info.id) {
        setUser(info);
        const tabInfo = await Chrome.getCurrentTab();
        // 上报埋点
        Tracert.start({
          spmAPos: TRACERT_CONFIG.spmAPos,
          spmBPos: TRACERT_CONFIG.spmBPos,
          role_id: (info as IUser)?.id,
          mdata: {
            [REQUEST_HEADER_VERSION]: VERSION,
            [EXTENSION_ID]: Chrome.runtime.id,
            [REFERER_URL]: tabInfo?.url,
          },
        });
      }
    } catch (error) {
      //
    }
    setAppReady(true);
  }, []);

  useEffect(() => {
    const logout = data => {
      onLogout(data);
    };
    eventManager.listen(AppEvents.FORCE_UPGRADE_VERSION, logout);
    eventManager.listen(AppEvents.LOGIN_EXPIRED, logout);
    return () => {
      eventManager.remove(AppEvents.FORCE_UPGRADE_VERSION, logout);
      eventManager.remove(AppEvents.LOGIN_EXPIRED, logout);
    };
  }, []);

  if (!ready) {
    return null;
  }

  const isLogined = !!user?.id;

  return (
    <AccountContext.Provider value={{ user, onLogout }}>
      {isLogined ? props.children : renderUnLogin()}
    </AccountContext.Provider>
  );
}

export default AccountLayout;
