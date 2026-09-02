/**
 * Notification Channel Registry (mventor-ticket-052 / STEP 9).
 *
 * Abstraction for notification channels: dashboard (in-app), email, webhook
 * today; push / sms / whatsapp slots ready for future integrations.
 * Each channel can be enabled/disabled via settings `notify_channel_<name>`.
 */

const settingsService = require('./settingsService');

const DEFAULT_ENABLED = {
  dashboard: true,
  email: true,
  webhook: true,
  push: true,      // Expo push service â†’ customer device tokens
  sms: false,      // future: Twilio / Vonage
  whatsapp: false, // future: WhatsApp Business API
};

const senders = new Map();

/** Register (or override) a channel sender */
function registerChannel(name, sendFn) {
  senders.set(name, sendFn);
}

/** Is the channel enabled by configuration? */
function isChannelEnabled(name) {
  const key = `notify_channel_${name}`;
  const configured = settingsService.get(key, undefined);
  if (configured === undefined || configured === null) {
    return !!DEFAULT_ENABLED[name];
  }
  return !!configured;
}

/** Dispatch through a channel if it is registered AND enabled */
async function dispatch(name, payload) {
  const sender = senders.get(name);
  if (!sender) {
    return { channel: name, sent: false, reason: 'not_registered' };
  }
  if (!isChannelEnabled(name)) {
    return { channel: name, sent: false, reason: 'disabled' };
  }
  try {
    await sender(payload);
    return { channel: name, sent: true };
  } catch (err) {
    console.error(`[notification] ${name} channel failed:`, err.message);
    return { channel: name, sent: false, reason: err.message };
  }
}

function listChannels() {
  return Object.keys(DEFAULT_ENABLED).map(name => ({
    name,
    enabled: isChannelEnabled(name),
    registered: senders.has(name),
    future: !senders.has(name),
  }));
}

module.exports = {
  registerChannel,
  isChannelEnabled,
  dispatch,
  listChannels,
  DEFAULT_ENABLED,
};
