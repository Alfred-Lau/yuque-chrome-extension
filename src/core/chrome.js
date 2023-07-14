const _globalThis = typeof window !== 'undefined' ? window : global;

const {
  action,
  cookies,
  contextMenus,
  runtime,
  storage,
  tabs,
  webRequest,
  declarativeNetRequest,
  windows,
} = _globalThis.chrome;

export default {
  action,
  cookies,
  contextMenus,
  runtime,
  storage,
  tabs,
  webRequest,
  declarativeNetRequest,
  windows,
  getCurrentTab: () => new Promise(resolve => {
    tabs.getCurrent(resolve);
  }),
  sendMessageToCurrentTab: (message) => new Promise(resolve => {
    tabs.getCurrent((tab) => {
      tabs.sendMessage(tab.id, message, resolve);
    });
  }),
};