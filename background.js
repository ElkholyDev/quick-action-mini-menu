chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'QAMM_SEARCH') {
    chrome.tabs.create({ url: 'https://www.google.com/search?q=' + encodeURIComponent(message.query) });
  }
  if (message.type === 'QAMM_URL' && message.url) {
    chrome.tabs.create({ url: message.url });
  }
});
