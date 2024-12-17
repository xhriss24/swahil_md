const { command, mode, toAudio } = require("../lib");
const ScrapeDl = require("../lib/scraper");
command(
 {
  pattern: "fb",
  fromMe: mode,
  desc: "Downloads Facebook Media",
  type: "download",
 },
 async (message, match) => {
  if (!match) return message.reply("_provide vaild facebook link_");
  await message.reply("_Downloading_");
  const buff = await ScrapeDl.facebook(match);
  return message.sendFile(buff);
 }
);

command(
 {
  pattern: "insta",
  fromMe: mode,
  desc: "Downloads Instagram Media",
  type: "download",
 },
 async (message, match) => {
  if (!match) return message.reply("_provide vaild instagram link_");
  await message.reply("_Downloading_");
  const buff = await ScrapeDl.instagram(match);
  return message.sendFile(buff);
 }
);

command(
 {
  pattern: "twitter",
  fromMe: mode,
  desc: "Downloads Twitter Media",
  type: "download",
 },
 async (message, match) => {
  if (!match) return message.reply("_provide vaild twitter url_");
  await message.reply("_Downloading_");
  const buff = await ScrapeDl.twitter(match);
  return await message.sendFile(buff);
 }
);

command(
 {
  pattern: "tiktok",
  fromMe: mode,
  desc: "Downloads Tiktok Media",
  type: "download",
 },
 async (message, match) => {
  if (!match) return await message.reply("_provide tiktok url_");
  await message.reply("_Downloading_");
  const buff = await ScrapeDl.tiktok(match);
  return await message.sendFile(buff);
 }
);

command(
 {
  pattern: "pinterest",
  fromMe: mode,
  desc: "Downloads Pinterest Images",
  type: "download",
 },
 async (message, match) => {
  if (!match) return message.reply("_provide me a searching option_");
  await message.reply("_Searching_");
  const buff = await ScrapeDl.pinterest(match);
  return await message.sendFile(buff);
 }
);

command(
 {
  pattern: "spotify",
  fromMe: mode,
  desc: "Downloads Spotify Music",
  type: "download",
 },
 async (message, match) => {
  if (!match) return message.reply("_provide me spotify url_");
  await message.reply("_Downloading_");
  const buff = await ScrapeDl.spotify(match);
  const audio = await toAudio(buff);
  return await message.sendFile(audio);
 }
);

command(
 {
  pattern: "ytv",
  fromeMe: mode,
  desc: "Downloads Youtube Videos",
  type: "download",
 },
 async (message, match) => {
  if (!match) return message.reply("_provide youtube url_");
  await message.reply("_Downloading_");
  const buff = await ScrapeDl.youtube(match);
  return await message.sendFile(buff);
 }
);

command(
 {
  pattern: "yta",
  fromMe: mode,
  desc: "Download Youtube Music Audio",
  type: "download",
 },
 async (message, match) => {
  if (!match) return await message.reply("_provide youtube music_");
  await message.reply("_Downloading_");
  const buff = await ScrapeDl.ytmp3(match);
  return await message.sendFile(buff);
 }
);
