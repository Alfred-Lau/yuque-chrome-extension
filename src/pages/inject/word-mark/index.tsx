import React, { useEffect, useState } from 'react';
import { Root, createRoot } from 'react-dom/client';
import { message } from 'antd';
import { __i18n } from '@/isomorphic/i18n';
import { YUQUE_DOMAIN } from '@/config';
import { YQ_INJECT_WORD_MARK_CONTAINER } from '@/isomorphic/constants';
import Chrome from '@/core/chrome';
import { BACKGROUND_EVENTS, PAGE_EVENTS } from '@/events';
import { IWordMarkConfig, isEnableWordMark } from '@/isomorphic/word-mark';
import { WordMarkContext } from '@/context/word-mark-context';
import App from './app';

interface RequestMessage {
  action: string;
  data: any;
}

let root: Root | null;

function AppContext() {
  const [ defaultConfig, setDefaultConfig ] = useState<IWordMarkConfig>(null);
  useEffect(() => {
    Chrome.runtime.sendMessage(
      {
        action: BACKGROUND_EVENTS.GET_WORD_MARK_CONFIG,
      },
      (res: IWordMarkConfig) => {
        setDefaultConfig(res);
      },
    );
  }, []);

  useEffect(() => {
    const listener = (
      request: RequestMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: boolean) => void,
    ) => {
      switch (request.action) {
        case PAGE_EVENTS.ENABLE_WORD_MARK_STATUE_CHANGE: {
          const config = request?.data || {};
          const isEnable = isEnableWordMark(config);
          if (isEnable) {
            initWordMark();
          } else {
            destroyWordMark();
          }
          setDefaultConfig(config);
          sendResponse(true);
          break;
        }
        case PAGE_EVENTS.FORCE_UPGRADE_VERSION:
          message.error({
            content: (
              <span>
                {__i18n('当前浏览器插件版本过低')}
                <a
                  href={`${YUQUE_DOMAIN}/download`}
                  target={'_blank'}
                  style={{
                    color: '#00B96B',
                    marginLeft: '8px',
                  }}
                >
                  {__i18n('前往升级')}
                </a>
              </span>
            ),
          });
          break;
        default:
          sendResponse(true);
      }
      return true;
    };
    Chrome.runtime.onMessage.addListener(listener);
    return () => Chrome.runtime.onMessage.removeListener(listener);
  }, []);

  if (!isEnableWordMark(defaultConfig)) {
    return <div className='disable' data-config={JSON.stringify(defaultConfig)} />;
  }

  return (
    <WordMarkContext.Provider
      value={{
        ...defaultConfig,
        destroyWordMark,
      }}
    >
      <App />
    </WordMarkContext.Provider>
  );
}

export function initWordMark() {
  let wrapper = document.querySelector(`.${YQ_INJECT_WORD_MARK_CONTAINER}`);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.className = YQ_INJECT_WORD_MARK_CONTAINER;
    document.documentElement.appendChild(wrapper);
  }
  root = createRoot(wrapper);
  root.render(<AppContext />);
}

export function destroyWordMark() {
  if (!root) {
    return;
  }
  const wrapper = document.querySelector(`.${YQ_INJECT_WORD_MARK_CONTAINER}`);
  root.unmount();
  root = null;
  wrapper?.remove();
}

