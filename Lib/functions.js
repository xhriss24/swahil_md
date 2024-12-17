const axios = require("axios");
const { jidDecode, delay, generateWAMessageFromContent, proto } = require("baileys");
const id3 = require("browser-id3-writer");
const { Readable } = require("stream");
const { fromBuffer } = require("file-type");
const path = require("path");
const FormData = require("form-data");
const { spawn } = require("child_process");
const { default: fetch } = require("node-fetch");
let { JSDOM } = require("jsdom");
const { commands } = require("./plugins");
const config = require("../config");
const jsQR = require("jsqr");
const fs = require("fs");
const jimp = require("jimp");
const { loadMessage } = require("./database/StoreDb");
const { tmpdir } = require("os");
const { exec } = require("child_process");
const streamBuffers = require("stream-buffers");
async function m3u82Mp4(m3u8Url) {
 return new Promise((resolve, reject) => {
  const writableStreamBuffer = new streamBuffers.WritableStreamBuffer({
   initialSize: 100 * 1024,
   incrementAmount: 10 * 1024,
  });
  const tempOutputFile = "output.mp4";
  const command = `"${ffmpegPath}" -i "${m3u8Url}" -c copy "${tempOutputFile}"`;
  const ffmpegProcess = exec(command, (error, stdout, stderr) => {
   if (error) {
    console.error(`Error occurred: ${error.message}`);
    return reject(error);
   }

   fs.readFile(tempOutputFile, (err, data) => {
    if (err) {
     return reject(err);
    }
    writableStreamBuffer.write(data);
    writableStreamBuffer.end();
    fs.unlinkSync(tempOutputFile);
    resolve(writableStreamBuffer.getContents());
   });
  });
  ffmpegProcess.stderr.on("data", data => {
   const progressLine = data.toString();
   const timeMatch = progressLine.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
   if (timeMatch) {
    const elapsedTime = timeMatch[1];
    console.log(`Conversion progress: ${elapsedTime}`);
   }
  });
 });
}
/**
 * Convert a buffer to a file and save it
 * @param {Buffer} buffer The buffer to convert
 * @param {String} filename The name of the file
 * @returns {String} The path to the saved file
 * @example
 * const path = await bufferToFile(buffer, 'file.txt')
 * console.log(path)
 */

async function buffToFile(buffer, filename) {
 if (!filename) filename = Date.now();
 let { ext } = await fromBuffer(buffer);
 let filePath = path.join(tmpdir(), `${filename}.${ext}`);
 await fs.promises.writeFile(filePath, buffer);
 return filePath;
}

/**
 *
 * @param {Buffer} imageBuffer
 * @returns {Buffer|null} [Buffer|null
 */

const removeBg = async imageBuffer => {
 const formData = new FormData();
 const inputPath = await buffToFile(imageBuffer);
 formData.append("size", "auto");
 formData.append("image_file", fs.createReadStream(inputPath), path.basename(inputPath));
 try {
  const response = await axios({
   method: "post",
   url: "https://api.remove.bg/v1.0/removebg",
   data: formData,
   responseType: "arraybuffer",
   headers: {
    ...formData.getHeaders(),
    "X-Api-Key": config.REMOVEBG,
   },
   encoding: null,
  });

  if (response.status !== 200) {
   console.error("Error:", response.status, response.statusText);
   return null;
  }

  return response.data;
 } catch (error) {
  console.error("Request failed:", error);
  return null;
 }
};

async function validatAndSaveDeleted(client, msg) {
 if (msg.type === "protocolMessage") {
  if (msg.message.protocolMessage.type === "REVOKE") {
   await client.sendMessage(msg.key.remoteJid, { text: "Message Deleted" });
   let jid = config.DELETED_LOG_CHAT;
   let message = await loadMessage(msg.message.protocolMessage.key.id);
   const m = generateWAMessageFromContent(jid, message.message, {
    userJid: client.user.id,
   });
   await client.relayMessage(jid, m.message, {
    messageId: m.key.id,
   });
   return m;
  }
 }
}
async function textToImg(text) {
 try {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  words.forEach(word => {
   if (line.length + word.length < 30) {
    line += word + " ";
   } else {
    lines.push(line);
    line = word + " ";
   }
  });
  lines.push(line);
  text = lines.join("\n");
  const font = await jimp.loadFont(jimp.FONT_SANS_64_WHITE);
  const textWidth = jimp.measureText(font, text.substring(0, 35));
  const textHeight = jimp.measureTextHeight(font, text);
  const canvasWidth = textWidth;
  const canvasHeight = textHeight + -(textHeight * 0.8);
  const image = new jimp(canvasWidth, canvasHeight, 0x075e54ff);
  const x = 5;
  const y = 5;
  image.print(font, x, y, text, textWidth, textHeight);
  image.shadow({ blur: 3, x: 6, y: 5, color: "#000000" });
  const buffer = await image.getBufferAsync(jimp.MIME_PNG);
  return buffer;
 } catch (err) {
  throw new Error(err);
 }
}

/**
 * Reads a QR code from an image buffer.
 * @param {Buffer} imageBuffer - The image buffer containing the QR code.
 * @returns {string|null} The decoded QR code data, or null if no QR code was found.
 */
async function readQr(imageBuffer) {
 try {
  const image = await jimp.read(imageBuffer);
  const { data, width, height } = image.bitmap;
  const code = jsQR(data, width, height);
  if (code) {
   return code.data;
  }
 } catch (err) {
  throw new Error(`Error reading QR code: ${err.message}`);
 }
 return null;
}

function createInteractiveMessage(data, options = {}) {
 const { jid, button, header, footer, body } = data;
 let buttons = [];
 for (let i = 0; i < button.length; i++) {
  let btn = button[i];
  let Button = {};
  Button.buttonParamsJson = JSON.stringify(btn.params);
  switch (btn.type) {
   case "copy":
    Button.name = "cta_copy";
    break;
   case "url":
    Button.name = "cta_url";
    break;
   case "location":
    Button.name = "send_location";
    break;
   case "address":
    Button.name = "address_message";
    break;
   case "call":
    Button.name = "cta_call";
    break;
   case "reply":
    Button.name = "quick_reply";
    break;
   case "list":
    Button.name = "single_select";
    break;
   default:
    Button.name = "quick_reply";
    break;
  }
  buttons.push(Button);
 }
 const mess = {
  viewOnceMessage: {
   message: {
    messageContextInfo: {
     deviceListMetadata: {},
     deviceListMetadataVersion: 2,
    },
    interactiveMessage: proto.Message.InteractiveMessage.create({
     body: proto.Message.InteractiveMessage.Body.create({ ...body }),
     footer: proto.Message.InteractiveMessage.Footer.create({ ...footer }),
     header: proto.Message.InteractiveMessage.Header.create({ ...header }),
     nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
      buttons: buttons,
     }),
    }),
   },
  },
 };
 let optional = generateWAMessageFromContent(jid, mess, options);
 return optional;
}

function ffmpeg(buffer, args = [], ext = "", ext2 = "") {
 return new Promise(async (resolve, reject) => {
  try {
   let tmp = path.join(tmpdir() + "/" + new Date() + "." + ext);
   let out = tmp + "." + ext2;
   await fs.promises.writeFile(tmp, buffer);
   const ffmpegProcess = spawn("ffmpeg", ["-y", "-i", tmp, ...args, out])
    .on("error", reject)
    .on("close", async code => {
     try {
      await fs.promises.unlink(tmp);
      if (code !== 0) {
       reject(new Error(`FFmpeg process exited with code ${code}`));
       return;
      }
      const processedData = await fs.promises.readFile(out);
      await fs.promises.unlink(out);
      resolve(processedData);
     } catch (e) {
      reject(e);
     }
    });
  } catch (e) {
   reject(e);
  }
 });
}

/**
 * Convert Audio to Playable WhatsApp Audio
 * @param {Buffer} buffer Audio Buffer
 * @param {String} ext File Extension
 */
function toAudio(buffer, ext) {
 return ffmpeg(buffer, ["-vn", "-ac", "2", "-b:a", "128k", "-ar", "44100", "-f", "mp3"], ext, "mp3");
}

/**
 * Convert Audio to Playable WhatsApp PTT
 * @param {Buffer} buffer Audio Buffer
 * @param {String} ext File Extension
 */
function toPTT(buffer, ext) {
 return ffmpeg(buffer, ["-vn", "-c:a", "libopus", "-b:a", "128k", "-vbr", "on", "-compression_level", "10"], ext, "opus");
}

/**
 * Convert Audio to Playable WhatsApp Video
 * @param {Buffer} buffer Video Buffer
 * @param {String} ext File Extension
 */
function toVideo(buffer, ext) {
 return ffmpeg(buffer, ["-c:v", "libx264", "-c:a", "aac", "-ab", "128k", "-ar", "44100", "-crf", "32", "-preset", "slow"], ext, "mp4");
}

async function getBuffer(url, options = {}) {
 try {
  const res = await axios({
   method: "get",
   url,
   headers: {
    DNT: 1,
    "Upgrade-Insecure-Request": 1,
   },
   ...options,
   responseType: "arraybuffer",
  });
  return res.data;
 } catch (error) {
  throw new Error(`Error: ${error.message}`);
 }
}
const decodeJid = jid => {
 if (!jid) return jid;
 if (/:\d+@/gi.test(jid)) {
  const decode = jidDecode(jid) || {};
  return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid;
 } else {
  return jid;
 }
};
async function FiletypeFromUrl(url) {
 const buffer = await getBuffer(url);
 const out = await fromBuffer(buffer);
 let type;
 if (out) {
  type = out.mime.split("/")[0];
 }
 return { type, buffer };
}
function extractUrlFromMessage(message) {
 const urlRegex = /(https?:\/\/[^\s]+)/gi;
 const match = urlRegex.exec(message);
 return match ? match[0] : null;
}

const removeCommand = async name => {
 return new Promise((resolve, reject) => {
  commands.map(async (command, index) => {
   if (command.pattern !== undefined && command.pattern.test(new RegExp(`${config.HANDLERS}( ?${name})`, "is"))) {
    commands.splice(index, 1);
    return resolve(true);
   }
  });
  resolve(false);
 });
};

async function getJson(url, options) {
 try {
  options ? options : {};
  const res = await axios({
   method: "GET",
   url: url,
   headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36",
   },
   ...options,
  });
  return res.data;
 } catch (err) {
  return err;
 }
}

/**
 * Processes audio with the specified effect using ffmpeg.
 * @param {Buffer} audioBuffer - The input audio as a buffer.
 * @param {string} effect - The audio effect to apply.
 * @returns {Promise<Buffer>} - The processed audio as a buffer.
 */
async function editAudio(audioBuffer, effect = "bass") {
 return new Promise((resolve, reject) => {
  let filter = "-af equalizer=f=54:width_type=o:width=2:g=20";
  switch (effect) {
   case "bass":
    filter = "-af equalizer=f=54:width_type=o:width=2:g=20";
    break;
   case "blown":
    filter = "-af acrusher=.1:1:64:0:log";
    break;
   case "deep":
    filter = "-af atempo=4/4,asetrate=44500*2/3";
    break;
   case "earrape":
    filter = "-af volume=12";
    break;
   case "fast":
    filter = '-filter:a "atempo=1.63,asetrate=44100"';
    break;
   case "fat":
    filter = '-filter:a "atempo=1.6,asetrate=22100"';
    break;
   case "nightcore":
    filter = "-filter:a atempo=1.06,asetrate=44100*1.25";
    break;
   case "reverse":
    filter = '-filter_complex "areverse"';
    break;
   case "robot":
    filter = "-filter_complex \"afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75\"";
    break;
   case "slow":
    filter = '-filter:a "atempo=0.7,asetrate=44100"';
    break;
   case "smooth":
    filter = "-filter:v \"minterpolate='mi_mode=mci:mc_mode=aobmc:vsbmc=1:fps=120'\"";
    break;
   case "tupai":
    filter = '-filter:a "atempo=0.5,asetrate=65100"';
    break;
   default:
    filter = "-af equalizer=f=54:width_type=o:width=2:g=20";
    break;
  }

  const outputBuffers = [];
  const inputStream = Readable.from(audioBuffer);

  // Run ffmpeg processing
  ffmpeg(inputStream)
   .inputFormat("mp3") // Ensure input format
   .audioFilters(filter)
   .format("mp3") // Set output format
   .on("data", chunk => {
    outputBuffers.push(chunk);
   })
   .on("end", () => {
    resolve(Buffer.concat(outputBuffers));
   })
   .on("error", err => {
    reject(new Error(`FFmpeg processing failed: ${err.message}`));
   })
   .run();
 });
}

module.exports = {
 parseTimeToSeconds: timeString => {
  const [minutes, seconds] = timeString.split(":").map(Number);
  return minutes * 60 + seconds;
 },
 toAudio,
 toPTT,
 toVideo,
 ffmpeg,
 removeBg,
 FiletypeFromUrl,
 removeCommand,
 getBuffer,
 extractUrlFromMessage,
 decodeJid,
 isAdmin: async (jid, user, client) => {
  const groupMetadata = await client.groupMetadata(jid);
  const groupAdmins = groupMetadata.participants.filter(participant => participant.admin !== null).map(participant => participant.id);

  return groupAdmins.includes(decodeJid(user));
 },
 webp2mp4: async source => {
  let form = new FormData();
  let isUrl = typeof source === "string" && /https?:\/\//.test(source);
  form.append("new-image-url", isUrl ? source : "");
  form.append("new-image", isUrl ? "" : source, "image.webp");
  let res = await fetch("https://ezgif.com/webp-to-mp4", {
   method: "POST",
   body: form,
  });
  let html = await res.text();
  let { document } = new JSDOM(html).window;
  let form2 = new FormData();
  let obj = {};
  for (let input of document.querySelectorAll("form input[name]")) {
   obj[input.name] = input.value;
   form2.append(input.name, input.value);
  }
  let res2 = await fetch("https://ezgif.com/webp-to-mp4/" + obj.file, {
   method: "POST",
   body: form2,
  });
  let html2 = await res2.text();
  let { document: document2 } = new JSDOM(html2).window;
  return new URL(document2.querySelector("div#output > p.outfile > video > source").src, res2.url).toString();
 },
 validatAndSaveDeleted,
 webp2png: async source => {
  let form = new FormData();
  let isUrl = typeof source === "string" && /https?:\/\//.test(source);
  form.append("new-image-url", isUrl ? source : "");
  form.append("new-image", isUrl ? "" : source, "image.webp");
  let res = await fetch("https://s6.ezgif.com/webp-to-png", {
   method: "POST",
   body: form,
  });
  let html = await res.text();
  let { document } = new JSDOM(html).window;
  let form2 = new FormData();
  let obj = {};
  for (let input of document.querySelectorAll("form input[name]")) {
   obj[input.name] = input.value;
   form2.append(input.name, input.value);
  }
  let res2 = await fetch("https://ezgif.com/webp-to-png/" + obj.file, {
   method: "POST",
   body: form2,
  });
  let html2 = await res2.text();
  console.log(html2);
  let { document: document2 } = new JSDOM(html2).window;
  return new URL(document2.querySelector("div#output > p.outfile > img").src, res2.url).toString();
 },
 parseJid(text = "") {
  return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + "@s.whatsapp.net");
 },
 parsedJid(text = "") {
  return [...text.matchAll(/([0-9]{5,16}|0)/g)].map(v => v[1] + "@s.whatsapp.net");
 },
 getJson,
 isIgUrl: url => {
  return /(?:(?:http|https):\/\/)?(?:www.)?(?:instagram.com|instagr.am|instagr.com)\/(\w+)/gim.test(url);
 },
 isUrl: (isUrl = url => {
  return new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, "gi").test(url);
 }),
 getUrl: (getUrl = url => {
  return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, "gi"));
 }),
 qrcode: async string => {
  const { toBuffer } = require("qrcode");
  let buff = await toBuffer(string);
  return buff;
 },
 secondsToDHMS: seconds => {
  seconds = Number(seconds);

  const days = Math.floor(seconds / (3600 * 24));
  seconds %= 3600 * 24;

  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);
  seconds %= 60;

  seconds = Math.floor(seconds);

  const parts = [];

  if (days) parts.push(`${days} Days`);
  if (hours) parts.push(`${hours} Hours`);
  if (minutes) parts.push(`${minutes} Minutes`);
  if (seconds) parts.push(`${seconds} Seconds`);
  return parts.join(" ");
 },
 formatBytes: (bytes, decimals = 2) => {
  if (!+bytes) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
 },
 sleep: delay,
 clockString: duration => {
  (seconds = Math.floor((duration / 1000) % 60)), (minutes = Math.floor((duration / (1000 * 60)) % 60)), (hours = Math.floor((duration / (1000 * 60 * 60)) % 24));

  hours = hours < 10 ? "0" + hours : hours;
  minutes = minutes < 10 ? "0" + minutes : minutes;
  seconds = seconds < 10 ? "0" + seconds : seconds;

  return hours + ":" + minutes + ":" + seconds;
 },
 validateQuality: quality => {
  let valid = ["144p", "240p", "360p", "480p", "720p", "1080p"];
  return valid.includes(quality);
 },
 AddMp3Meta: async (songbuffer, coverBuffer, options = { title: "ғxᴏᴘ-ᴍᴅ Whatsapp bot", artist: ["ᴀsᴛʀᴏ"] }) => {
  if (!Buffer.isBuffer(songbuffer)) {
   songbuffer = await getBuffer(songbuffer);
  }
  if (!Buffer.isBuffer(coverBuffer)) {
   coverBuffer = await getBuffer(coverBuffer);
  }

  const writer = new id3(songbuffer);
  writer.setFrame("TIT2", options.title).setFrame("TPE1", ["ғxᴏᴘ-ᴍᴅ"]).setFrame("APIC", {
   type: 3,
   data: coverBuffer,
   description: "ᴀsᴛʀᴏ",
  });

  writer.addTag();
  return Buffer.from(writer.arrayBuffer);
 },
 isNumber: function isNumber() {
  const int = parseInt(this);
  return typeof int === "number" && !isNaN(int);
 },
 getRandom: function getRandom() {
  if (Array.isArray(this) || this instanceof String) return this[Math.floor(Math.random() * this.length)];
  return Math.floor(Math.random() * this);
 },
 createInteractiveMessage,
 textToImg,
 readQr,
 m3u82Mp4,
 editAudio,
};
