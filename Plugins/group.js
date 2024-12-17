const { command, mode, parsedJid, isAdmin } = require("../lib/");
const { setMessage, getMessage, delMessage, getStatus, toggleStatus } = require("../lib/database").Greetings;
const { banUser, unbanUser, isBanned } = require("../lib/database/ban");
command(
 {
  pattern: "add",
  fromMe: mode,
  desc: "add a person to group",
  type: "group",
 },
 async (message, match) => {
  if (!message.isGroup) return await message.reply("_This command is for groups_");

  match = match || message.reply_message.jid;
  if (!match) return await message.reply("_Mention user to add");

  const isadmin = await isAdmin(message.jid, message.user, message.client);

  if (!isadmin) return await message.reply("_I'm not admin_");
  const jid = parsedJid(match);

  await message.client.groupParticipantsUpdate(message.jid, jid, "add");

  return await message.reply(`_@${jid[0].split("@")[0]} added_`, {
   mentions: [jid],
  });
 }
);

command(
 {
  pattern: "kick",
  fromMe: mode,
  desc: "kicks a person from group",
  type: "group",
 },
 async (message, match) => {
  if (!message.isGroup) return await message.reply("_This command is for groups_");

  match = match || message.reply_message.jid;
  if (!match) return await message.reply("_Mention user to kick_");

  const isadmin = await isAdmin(message.jid, message.user, message.client);

  if (!isadmin) return await message.reply("_I'm not admin_");
  const jid = parsedJid(match);

  await message.client.groupParticipantsUpdate(message.jid, jid, "remove");

  return await message.reply(`_@${jid[0].split("@")[0]} kicked_`, {
   mentions: [jid],
  });
 }
);
command(
 {
  pattern: "promote",
  fromMe: mode,
  desc: "promote to admin",
  type: "group",
 },
 async (message, match) => {
  if (!message.isGroup) return await message.reply("_This command is for groups_");

  match = match || message.reply_message.jid;
  if (!match) return await message.reply("_Mention user to promote_");

  const isadmin = await isAdmin(message.jid, message.user, message.client);

  if (!isadmin) return await message.reply("_I'm not admin_");
  const jid = parsedJid(match);

  await message.client.groupParticipantsUpdate(message.jid, jid, "promote");

  return await message.reply(`_@${jid[0].split("@")[0]} promoted as admin_`, {
   mentions: [jid],
  });
 }
);
command(
 {
  pattern: "demote",
  fromMe: mode,
  desc: "demote from admin",
  type: "group",
 },
 async (message, match) => {
  if (!message.isGroup) return await message.reply("_This command is for groups_");

  match = match || message.reply_message.jid;
  if (!match) return await message.reply("_Mention user to demote_");

  const isadmin = await isAdmin(message.jid, message.user, message.client);

  if (!isadmin) return await message.reply("_I'm not admin_");
  const jid = parsedJid(match);

  await message.client.groupParticipantsUpdate(message.jid, jid, "demote");

  return await message.reply(`_@${jid[0].split("@")[0]} demoted from admin_`, {
   mentions: [jid],
  });
 }
);

command(
 {
  pattern: "mute",
  fromMe: mode,
  desc: "nute group",
  type: "group",
 },
 async (message, match, m, client) => {
  if (!message.isGroup) return await message.reply("_This command is for groups_");
  if (!isAdmin(message.jid, message.user, message.client)) return await message.reply("_I'm not admin_");
  await message.reply("_Muting_");
  return await client.groupSettingUpdate(message.jid, "announcement");
 }
);

command(
 {
  pattern: "unmute",
  fromMe: mode,
  desc: "unmute group",
  type: "group",
 },
 async (message, match, m, client) => {
  if (!message.isGroup) return await message.reply("_This command is for groups_");
  if (!isAdmin(message.jid, message.user, message.client)) return await message.reply("_I'm not admin_");
  await message.reply("_Unmuting_");
  return await client.groupSettingUpdate(message.jid, "not_announcement");
 }
);

command(
 {
  pattern: "gjid",
  fromMe: mode,
  desc: "gets jid of all group members",
  type: "group",
 },
 async (message, match, m, client) => {
  if (!message.isGroup) return await message.reply("_This command is for groups_");
  let { participants } = await client.groupMetadata(message.jid);
  let participant = participants.map(u => u.id);
  let str = "╭──〔 *Group Jids* 〕\n";
  participant.forEach(result => {
   str += `├ *${result}*\n`;
  });
  str += `╰──────────────`;
  message.reply(str);
 }
);

command(
 {
  pattern: "tagall",
  fromMe: mode,
  desc: "mention all users in group",
  type: "group",
 },
 async (message, match) => {
  if (!message.isGroup) return;
  const { participants } = await message.client.groupMetadata(message.jid);
  let teks = "";
  for (let mem of participants) {
   teks += ` @${mem.id.split("@")[0]}\n`;
  }
  message.sendMessage(message.jid, teks.trim(), {
   mentions: participants.map(a => a.id),
  });
 }
);

command(
 {
  pattern: "tag",
  fromMe: mode,
  desc: "mention all users in group",
  type: "group",
 },
 async (message, match) => {
  console.log("match");
  match = match || message.reply_message.text;
  if (!match) return message.reply("_Enter or reply to a text to tag_");
  if (!message.isGroup) return;
  const { participants } = await message.client.groupMetadata(message.jid);
  message.sendMessage(message.jid, match, {
   mentions: participants.map(a => a.id),
  });
 }
);

command(
 {
  pattern: "welcome",
  fromMe: mode,
  desc: "description",
  type: "group",
 },
 async (message, match) => {
  if (!message.isGroup) return;
  let { prefix } = message;
  let status = await getStatus(message.jid, "welcome");
  let stat = status ? "on" : "off";

  if (!match) {
   let replyMsg = `Welcome manager\n\nGroup: ${(await message.client.groupMetadata(message.jid)).subject}\nStatus: ${stat}\n\nAvailable Actions:\n\n- ${prefix}welcome get: Get the welcome message\n- ${prefix}welcome on: Enable welcome message\n- ${prefix}welcome off: Disable welcome message\n- ${prefix}welcome delete: Delete the welcome message`;

   return await message.reply(replyMsg);
  }

  if (match === "get") {
   let msg = await getMessage(message.jid, "welcome");
   if (!msg) return await message.reply("_There is no welcome set_");
   return message.reply(msg.message);
  }

  if (match === "on") {
   let msg = await getMessage(message.jid, "welcome");
   if (!msg) return await message.reply("_There is no welcome message to enable_");
   if (status) return await message.reply("_Welcome already enabled_");
   await toggleStatus(message.jid);
   return await message.reply("_Welcome enabled_");
  }

  if (match === "off") {
   if (!status) return await message.reply("_Welcome already disabled_");
   await toggleStatus(message.jid, "welcome");
   return await message.reply("_Welcome disabled_");
  }

  if (match == "delete") {
   await delMessage(message.jid, "welcome");
   return await message.reply("_Welcome deleted successfully_");
  }
  await setMessage(message.jid, "welcome", match);
  return await message.reply("_Welcome set successfully_");
 }
);

command(
 {
  pattern: "goodbye",
  fromMe: mode,
  desc: "description",
  type: "group",
 },
 async (message, match) => {
  if (!message.isGroup) return;
  let status = await getStatus(message.jid, "goodbye");
  let stat = status ? "on" : "off";
  let replyMsg = `Goodbye manager\n\nGroup: ${(await message.client.groupMetadata(message.jid)).subject}\nStatus: ${stat}\n\nAvailable Actions:\n\n- goodbye get: Get the goodbye message\n- goodbye on: Enable goodbye message\n- goodbye off: Disable goodbye message\n- goodbye delete: Delete the goodbye message`;

  if (!match) {
   return await message.reply(replyMsg);
  }

  if (match === "get") {
   let msg = await getMessage(message.jid, "goodbye");
   if (!msg) return await message.reply("_There is no goodbye set_");
   return message.reply(msg.message);
  }

  if (match === "on") {
   await toggleStatus(message.jid, "goodbye");
   return await message.reply("_Goodbye enabled_");
  }

  if (match === "off") {
   await toggleStatus(message.jid);
   return await message.reply("_Goodbye disabled_");
  }

  if (match === "delete") {
   await delMessage(message.jid, "goodbye");
   return await message.reply("_Goodbye deleted successfully_");
  }

  await setMessage(message.jid, "goodbye", match);
  return await message.reply("_Goodbye set successfully_");
 }
);

command(
 {
  on: "message",
  fromMe: mode,
  dontAddCommandList: true,
 },
 async (message, match) => {
  if (!message.isBaileys) return;
  const isban = await isBanned(message.jid);
  if (!isban) return;
  await message.reply("_Bot is banned in this chat_");
  const jid = parsedJid(message.participant);
  return await message.client.groupParticipantsUpdate(message.jid, jid, "remove");
 }
);

command(
 {
  pattern: "banbot",
  fromMe: mode,
  desc: "ban bot from a chat",
  type: "",
 },
 async (message, match) => {
  const chatid = message.jid;
  const isban = await isBanned(chatid);
  if (isban) {
   return await message.sendMessage(message.jid, "Bot is already banned");
  }
  await banUser(chatid);
  return await message.sendMessage(message.jid, "Bot banned");
 }
);

command(
 {
  pattern: "unbanbot",
  fromMe: mode,
  desc: "Unban bot from a chat",
  type: "user",
 },
 async (message, match) => {
  const chatid = message.jid;
  const isban = await isBanned(chatid);
  if (!isban) {
   return await message.sendMessage(message.jid, "Bot is not banned");
  }
  await unbanUser(chatid);
  return await message.sendMessage(message.jid, "Bot unbanned");
 }
);

command(
 {
  pattern: "ginfo",
  fromMe: mode,
  desc: "Get Group Data",
  type: "group",
 },
 async (message, match) => {
  match = match ? match : message.reply_text;
  if (!match) return await message.reply("_Group Link?_");
  let groupId = match[1].trim();
  const groupInfo = await message.client.groupGetInviteInfo(groupId);

  if (groupInfo) {
   const creationDate = new Date(groupInfo.creation * 1000);
   const createdAt = `${creationDate.getFullYear()}-${(creationDate.getMonth() + 1).toString().padStart(2, "0")}-${creationDate.getDate().toString().padStart(2, "0")}`;

   let participants = groupInfo.size > 3 ? `${groupInfo.size} members` : `${groupInfo.size} members`;

   let message = `${groupInfo.subject}\n\n`;
   message += `  Creator: wa.me/${groupInfo.owner.split("@")[0]}\n`;
   message += `  Group ID: \`\`\`${groupInfo.id}\`\`\`\n`;
   message += `  *Muted:* ${groupInfo.announce ? "yes" : "no"}\n`;
   message += `  *Locked:* ${groupInfo.restrict ? "yes" : "no"}\n`;
   message += `  *Created at:* ${createdAt}\n`;
   message += `  *Participants:* ${participants}\n`;

   if (groupInfo.desc) {
    message += `  *Description:* ${groupInfo.desc}\n`;
   }

   return await send(message, message.trim(), {
    mentions: [groupInfo.owner],
   });
  } else {
   await message.send("_Group Not Found!_");
  }
 }
);
