import { LOCK_ALARM, lock } from './store.js';

export default {
  id: 'vault',
  init() {
    chrome.alarms.onAlarm.addListener((alarm) => alarm.name === LOCK_ALARM && lock());
    chrome.idle.onStateChanged.addListener((state) => state === 'locked' && lock()); // screen locked
  },
};
