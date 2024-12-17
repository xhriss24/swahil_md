const fs = require("fs-extra");
const path = require("path");
const { createCanvas, loadImage } = require("canvas");
const { sleep, command, mode } = require("../lib");
const { buffThumb } = require("../media");

function getAbsolutePath(relativePath) {
 const projectRoot = path.resolve(__dirname, "..");
 const absolutePath = path.join(projectRoot, relativePath);
 return absolutePath;
}

async function checkFileExists(filePath) {
 await fs.access(filePath, fs.constants.F_OK);
 return true;
}

async function generateImageWithText(imagePath, outputPath, text, x, y, maxWidth, maxLines, fontSize = "30") {
 await fs.ensureDir(path.dirname(outputPath));
 if (!(await checkFileExists(imagePath))) {
  throw new Error(`Input image not found: ${imagePath}`);
 }
 const image = await loadImage(imagePath);
 const canvas = createCanvas(image.width, image.height);
 const ctx = canvas.getContext("2d");

 ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
 ctx.font = `${fontSize}px Arial`;
 ctx.fillStyle = "black";
 ctx.textAlign = "left";
 ctx.textBaseline = "top";

 const lines = splitTextIntoLines(text, ctx, maxWidth);

 if (lines.length > maxLines) {
  lines.splice(maxLines);
  const lastLine = lines[maxLines - 1];
  const truncatedLine = lastLine.slice(0, lastLine.length - 10) + "...Read More";
  lines[maxLines - 1] = truncatedLine;
 }

 lines.forEach((line, index) => {
  ctx.fillText(line, x, y + index * 25);
 });

 const buffer = canvas.toBuffer("image/png");
 await fs.writeFile(outputPath, buffer);

 return outputPath;
}

function splitTextIntoLines(text, ctx, maxWidth) {
 const words = text.split(" ");
 const lines = [];
 let currentLine = "";

 for (const word of words) {
  const testLine = currentLine === "" ? word : `${currentLine} ${word}`;
  const lineWidth = ctx.measureText(testLine).width;

  if (lineWidth <= maxWidth) {
   currentLine = testLine;
  } else {
   lines.push(currentLine);
   currentLine = word;
  }
 }

 if (currentLine !== "") {
  lines.push(currentLine);
 }

 return lines;
}

const memeCommands = [
 { pattern: "trump", image: "media/meme/trump.png", x: 70, y: 150, maxWidth: 700, maxLines: 4 },
 { pattern: "elon", image: "media/meme/elon.jpg", x: 60, y: 130, maxWidth: 900, maxLines: 5 },
 { pattern: "mark", image: "media/meme/mark.png", x: 30, y: 80, maxWidth: 500, maxLines: 3 },
 { pattern: "ronaldo", image: "media/meme/ronaldo.png", x: 50, y: 140, maxWidth: 600, maxLines: 4 },
];

memeCommands.forEach(({ pattern, image, x, y, maxWidth, maxLines }) => {
 command(
  {
   pattern,
   fromMe: mode,
   desc: "Generates a meme with provided text",
   type: "memies",
  },
  async (message, match) => {
   if (!match) return await message.send("_Provide Text_");
   const imagePath = getAbsolutePath(image);
   const tempImage = getAbsolutePath(`temp/${pattern}.png`);
   const generatedImage = await generateImageWithText(imagePath, tempImage, ` ${match}`, x, y, maxWidth, maxLines, "35");
   const capMsg = `*_GENERATED BY FXOP_BOT_*`;
   await sleep(1500);
   const buff = await buffThumb(generatedImage);
   await message.send(buff, { caption: capMsg });
  }
 );
});