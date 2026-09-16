/* catalogs — everything the builder can offer */

const TRIGGERS = [
  { value: 'message',         label: 'message',         desc: 'fires on a matching message' },
  { value: 'member_join',     label: 'member join',     desc: 'someone joins the server' },
  { value: 'member_leave',    label: 'member leave',    desc: 'someone leaves the server' },
  { value: 'reaction_add',    label: 'reaction add',    desc: 'someone adds a reaction' },
  { value: 'reaction_remove', label: 'reaction remove', desc: 'someone removes a reaction' },
  { value: 'voice_join',      label: 'voice join',      desc: 'someone joins voice' },
  { value: 'voice_leave',     label: 'voice leave',     desc: 'someone leaves voice' },
  { value: 'role_added',      label: 'role added',      desc: 'a role is added to a member' },
  { value: 'role_removed',    label: 'role removed',    desc: 'a role is removed from a member' },
  { value: 'button_click',    label: 'button click',    desc: 'a component button is clicked' },
  { value: 'scheduled',       label: 'scheduled',       desc: 'runs on a timer' },
];

const CONDITIONS = [
  { value: 'channel',           label: 'channel',           desc: 'is / is not a channel',              input: 'channel' },
  { value: 'category',          label: 'category',          desc: 'channel is in / not in a category',   input: 'category' },
  { value: 'has_role',          label: 'has role',          desc: 'member has / does not have role',     input: 'role' },
  { value: 'has_any_role',      label: 'has any role',      desc: 'member has / does not have any of',   input: 'roles_multi' },
  { value: 'message_contains',  label: 'message contains',  desc: 'message includes a string',           input: 'text' },
  { value: 'message_length',    label: 'message length',    desc: 'length >= / < a number',              input: 'number' },
  { value: 'username_contains', label: 'username contains', desc: 'author name includes a string',       input: 'text' },
  { value: 'nickname_contains', label: 'nickname contains', desc: 'author nickname includes a string',   input: 'text' },
  { value: 'is_bot',            label: 'is bot',            desc: 'author is / is not a bot',            input: 'bool' },
  { value: 'is_booster',        label: 'is booster',        desc: 'member is / is not boosting',         input: 'bool' },
  { value: 'has_attachment',    label: 'has attachment',    desc: 'message has / has no attachment',     input: 'bool' },
  { value: 'account_age',       label: 'account age',       desc: 'account >= / < N days old',           input: 'number' },
  { value: 'member_count',      label: 'member count',      desc: 'server >= / < N members',             input: 'number' },
  { value: 'user_id',           label: 'user id',           desc: 'author is / is not a user',           input: 'user' },
  { value: 'time_of_day',       label: 'time of day',       desc: 'between / not between two hours',     input: 'hour_range' },
  { value: 'day_of_week',       label: 'day of week',       desc: 'is / is not one of the days',         input: 'days_multi' },
];

const ACTIONS = [
  { value: 'send_message',      label: 'send message',       desc: 'send a message to a channel',       input: 'channel+text' },
  { value: 'reply_to_message',  label: 'reply to message',   desc: 'reply to the triggering message',    input: 'text' },
  { value: 'send_dm',           label: 'send dm',            desc: 'dm the triggering user',             input: 'text' },
  { value: 'dm_user',           label: 'dm a user',          desc: 'dm a specific user id',              input: 'user_id+text' },
  { value: 'dm_role_holders',   label: 'dm role holders',    desc: 'dm everyone with a role',            input: 'role+text' },
  { value: 'add_role',          label: 'add role',           desc: 'grant a role',                       input: 'role' },
  { value: 'remove_role',       label: 'remove role',        desc: 'remove a role',                      input: 'role' },
  { value: 'toggle_role',       label: 'toggle role',        desc: 'add or remove based on current',     input: 'role' },
  { value: 'delete_message',    label: 'delete message',     desc: 'delete the triggering message',      input: 'none' },
  { value: 'add_reaction',      label: 'add reaction',       desc: 'react to the triggering message',    input: 'emoji' },
  { value: 'log_to_channel',    label: 'log to channel',     desc: 'send a log line to a channel',       input: 'channel+text' },
  { value: 'send_container',    label: 'send container',     desc: 'send a v2 container',                input: 'channel+container' },
  { value: 'send_embed',        label: 'send embed',         desc: 'send a classic embed',               input: 'channel+embed' },
  { value: 'webhook_post',      label: 'webhook post',       desc: 'post to a webhook url',              input: 'webhook+text' },
  { value: 'timeout_user',      label: 'timeout user',       desc: 'timeout the triggering user',        input: 'minutes' },
  { value: 'kick_user',         label: 'kick user',          desc: 'kick the triggering user',           input: 'text_reason' },
  { value: 'ban_user',          label: 'ban user',           desc: 'ban the triggering user',            input: 'text_reason' },
  { value: 'pin_message',       label: 'pin message',        desc: 'pin the triggering message',         input: 'none' },
  { value: 'unpin_message',     label: 'unpin message',      desc: 'unpin the triggering message',       input: 'none' },
  { value: 'set_nickname',      label: 'set nickname',       desc: 'change the member nickname',         input: 'text' },
  { value: 'create_thread',     label: 'create thread',      desc: 'open a thread on the message',       input: 'text' },
  { value: 'run_automation',    label: 'run automation',     desc: 'chain into another automation',      input: 'automation' },
  { value: 'wait',              label: 'wait',               desc: 'pause before the next action',       input: 'seconds' },
];

module.exports = { TRIGGERS, CONDITIONS, ACTIONS };
