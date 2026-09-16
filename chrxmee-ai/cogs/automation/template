/* pre-made automations */

module.exports = [
  {
    id: 'welcome-dm',
    name: 'welcome dm',
    desc: 'dms a new member when they join',
    trigger: { type: 'member_join' },
    conditions: [],
    conditionMode: 'all',
    actions: [
      { type: 'send_dm', content: 'hey {user}, welcome to **{server}**! glad to have you.' },
    ],
    cooldownSeconds: 30,
  },
  {
    id: 'ping-responder',
    name: 'ping responder',
    desc: 'replies when someone says "ping"',
    trigger: { type: 'message', keyword: 'ping', matchMode: 'exact' },
    conditions: [],
    conditionMode: 'all',
    actions: [
      { type: 'reply_to_message', content: 'pong {user}' },
    ],
    cooldownSeconds: 10,
  },
  {
    id: 'auto-role-on-boost',
    name: 'auto role on boost',
    desc: 'gives a role when someone boosts',
    trigger: { type: 'member_join' }, // placeholder — user should swap for a boost trigger later
    conditions: [{ type: 'is_booster', op: 'is', value: null }],
    conditionMode: 'all',
    actions: [
      { type: 'add_role', roleId: '' },
      { type: 'send_message', channelId: '', content: 'thanks for boosting {user}!' },
    ],
    cooldownSeconds: 5,
  },
  {
    id: 'log-joins',
    name: 'log joins',
    desc: 'logs new members in a channel',
    trigger: { type: 'member_join' },
    conditions: [],
    conditionMode: 'all',
    actions: [
      { type: 'log_to_channel', channelId: '', content: '{user} joined · now {server.count} members' },
    ],
    cooldownSeconds: 0,
  },
  {
    id: 'keyword-alert',
    name: 'keyword alert',
    desc: 'pings you when someone says a bad word',
    trigger: { type: 'message', keyword: '', matchMode: 'contains' },
    conditions: [],
    conditionMode: 'all',
    actions: [
      { type: 'delete_message', summary: 'delete' },
      { type: 'log_to_channel', channelId: '', content: '{user} said a flag word: `{message}`' },
    ],
    cooldownSeconds: 2,
  },
  {
    id: 'daily-reminder',
    name: 'daily reminder',
    desc: 'sends a reminder message every day',
    trigger: { type: 'scheduled', mode: 'daily', hour: 9, minute: 0 },
    conditions: [],
    conditionMode: 'all',
    actions: [
      { type: 'send_message', channelId: '', content: 'daily reminder — check the rules and stay hydrated.' },
    ],
    cooldownSeconds: 0,
  },
];
