const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const E = {
  success: "<:Verified_Icon:1527194184841167010>",
  error: "<:no:1530373946795364362>",
  ai: "<:Chrxmaticc_AI:1480094799292928132>",
  angry: "<:angry_cry:1526029511882440744>",
  sneaky: "<:sneaky:1527401423690792970>",
  money_cry: "<:Money_Cry_Son:1526538340264841257>",
  cringe_laugh: "<:Cringe_Laughing_Son:1526539082564374710>",
  point_laugh: "<:PointAndLaughingEmoji:1525657154567016469>",
};

const FLASH_COLORS = {
  white: { r: 255, g: 255, b: 255 },
  black: { r: 0, g: 0, b: 0 },
  red: { r: 255, g: 0, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("image")
    .setDescription("image manipulation chaos")
    // subcommands
    .addSubcommand(sub =>
      sub.setName("invert").setDescription("invert colors")
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("grayscale").setDescription("grayscale an image")
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("sepia").setDescription("sepia tone")
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("blur").setDescription("blur an image")
        .addIntegerOption(opt => opt.setName("strength").setDescription("blur radius (1-10)").setRequired(false).setMinValue(1).setMaxValue(10))
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("pixelate").setDescription("pixelate an image")
        .addIntegerOption(opt => opt.setName("size").setDescription("pixel size (2-50)").setRequired(false).setMinValue(2).setMaxValue(50))
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("flip").setDescription("flip an image")
        .addStringOption(opt => opt.setName("direction").setDescription("horizontal or vertical").setRequired(true).addChoices({ name: "horizontal", value: "h" }, { name: "vertical", value: "v" }))
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("rotate").setDescription("rotate an image")
        .addIntegerOption(opt => opt.setName("degrees").setDescription("degrees (0-360)").setRequired(true).setMinValue(0).setMaxValue(360))
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("flash").setDescription("flash an image with a color overlay")
        .addStringOption(opt => opt.setName("mode").setDescription("flash color").setRequired(true)
          .addChoices(
            { name: "white", value: "white" },
            { name: "black", value: "black" },
            { name: "red", value: "red" },
            { name: "blue", value: "blue" }
          ))
        .addIntegerOption(opt => opt.setName("intensity").setDescription("intensity 1-10").setRequired(false).setMinValue(1).setMaxValue(10))
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("brightness").setDescription("adjust brightness")
        .addIntegerOption(opt => opt.setName("value").setDescription("-100 to 100").setRequired(true).setMinValue(-100).setMaxValue(100))
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("contrast").setDescription("adjust contrast")
        .addIntegerOption(opt => opt.setName("value").setDescription("-100 to 100").setRequired(true).setMinValue(-100).setMaxValue(100))
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("posterize").setDescription("posterize an image")
        .addIntegerOption(opt => opt.setName("levels").setDescription("2-16").setRequired(true).setMinValue(2).setMaxValue(16))
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("threshold").setDescription("black & white threshold")
        .addIntegerOption(opt => opt.setName("value").setDescription("0-255").setRequired(true).setMinValue(0).setMaxValue(255))
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("edge").setDescription("edge detection")
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("emboss").setDescription("emboss effect")
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("sharpen").setDescription("sharpen an image")
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName("deepfry").setDescription("deepfry an image")
        .addUserOption(opt => opt.setName("user").setDescription("user avatar").setRequired(false))
        .addStringOption(opt => opt.setName("url").setDescription("image url").setRequired(false))
        .addAttachmentOption(opt => opt.setName("file").setDescription("image file").setRequired(false))
    ),

  async execute(interaction) {
    const isButtonSim = interaction.isButton && interaction.isButton();
    if (!isButtonSim) {
      try { await interaction.deferReply(); } catch {}
    }

    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user");
    const url = interaction.options.getString("url");
    const attachment = interaction.options.getAttachment("file");

    // function to get image URL from various sources
    let imageUrl = null;

    if (attachment) {
      imageUrl = attachment.url;
    } else if (url) {
      imageUrl = url;
    } else if (user) {
      imageUrl = user.displayAvatarURL({ extension: "png", size: 512 });
    } else if (isButtonSim && interaction.message?.attachments?.size > 0) {
      // prefix: message attachment
      imageUrl = interaction.message.attachments.first().url;
    } else if (interaction.reference) {
      // replied message attachment fallback
      try {
        const replied = await interaction.channel.messages.fetch(interaction.reference.messageId);
        if (replied.attachments.size > 0) imageUrl = replied.attachments.first().url;
      } catch {}
    }

    if (!imageUrl) {
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle(`${E.error} no image provided`)
          .setDescription(`${E.angry} provide a file, url, user, or reply to an image.`)
        ]
      });
    }

    try {
      // load image
      const img = await loadImage(imageUrl);

      // create canvas
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // apply effect based on subcommand
      switch (sub) {
        case "invert":
          applyInvert(ctx, img.width, img.height);
          break;
        case "grayscale":
          applyGrayscale(ctx, img.width, img.height);
          break;
        case "sepia":
          applySepia(ctx, img.width, img.height);
          break;
        case "blur":
          const strength = interaction.options.getInteger("strength") || 5;
          ctx.filter = `blur(${strength}px)`;
          ctx.drawImage(canvas, 0, 0);
          ctx.filter = "none";
          break;
        case "pixelate":
          const pixelSize = interaction.options.getInteger("size") || 10;
          applyPixelate(canvas, ctx, img.width, img.height, pixelSize);
          break;
        case "flip":
          const dir = interaction.options.getString("direction");
          applyFlip(ctx, canvas, dir);
          break;
        case "rotate":
          const deg = interaction.options.getInteger("degrees");
          applyRotate(canvas, ctx, deg);
          break;
        case "flash":
          const mode = interaction.options.getString("mode");
          const intensity = interaction.options.getInteger("intensity") || 5;
          applyFlash(ctx, img.width, img.height, FLASH_COLORS[mode], intensity / 10);
          break;
        case "brightness":
          const bVal = interaction.options.getInteger("value");
          applyBrightness(ctx, img.width, img.height, bVal);
          break;
        case "contrast":
          const cVal = interaction.options.getInteger("value");
          applyContrast(ctx, img.width, img.height, cVal);
          break;
        case "posterize":
          const levels = interaction.options.getInteger("levels");
          applyPosterize(ctx, img.width, img.height, levels);
          break;
        case "threshold":
          const thresh = interaction.options.getInteger("value");
          applyThreshold(ctx, img.width, img.height, thresh);
          break;
        case "edge":
          applyEdge(ctx, img.width, img.height);
          break;
        case "emboss":
          applyEmboss(ctx, img.width, img.height);
          break;
        case "sharpen":
          applySharpen(ctx, img.width, img.height);
          break;
        case "deepfry":
          applyDeepfry(ctx, img.width, img.height);
          break;
        default:
          break;
      }

      const buffer = canvas.toBuffer("image/png");
      const attachmentFile = new AttachmentBuilder(buffer, { name: "image.png" });

      const embed = new EmbedBuilder()
        .setColor(0x7c7ce0)
        .setTitle(`${E.ai} image ${sub}`)
        .setImage("attachment://image.png")
        .setFooter({ text: "processed by chromed" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed], files: [attachmentFile] });
    } catch (err) {
      console.error("image command error:", err);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle(`${E.error} processing failed`)
          .setDescription(`${E.angry} ${err.message}`)
        ]
      });
    }
  },
};

// ─── pixel manipulation helpers ────────────────────────────

function getImageData(ctx, width, height) {
  return ctx.getImageData(0, 0, width, height);
}

function putImageData(ctx, imageData) {
  ctx.putImageData(imageData, 0, 0);
}

function applyInvert(ctx, width, height) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i+1] = 255 - data[i+1];
    data[i+2] = 255 - data[i+2];
  }
  putImageData(ctx, imageData);
}

function applyGrayscale(ctx, width, height) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    data[i] = gray;
    data[i+1] = gray;
    data[i+2] = gray;
  }
  putImageData(ctx, imageData);
}

function applySepia(ctx, width, height) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    data[i] = Math.min(255, (r * 0.393 + g * 0.769 + b * 0.189));
    data[i+1] = Math.min(255, (r * 0.349 + g * 0.686 + b * 0.168));
    data[i+2] = Math.min(255, (r * 0.272 + g * 0.534 + b * 0.131));
  }
  putImageData(ctx, imageData);
}

function applyBrightness(ctx, width, height, value) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  const adjust = value; // -100 to 100
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, data[i] + adjust));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + adjust));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + adjust));
  }
  putImageData(ctx, imageData);
}

function applyContrast(ctx, width, height, value) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  const factor = (259 * (value + 255)) / (255 * (259 - value));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
    data[i+1] = Math.max(0, Math.min(255, factor * (data[i+1] - 128) + 128));
    data[i+2] = Math.max(0, Math.min(255, factor * (data[i+2] - 128) + 128));
  }
  putImageData(ctx, imageData);
}

function applyPosterize(ctx, width, height, levels) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.round(data[i] / step) * step;
    data[i+1] = Math.round(data[i+1] / step) * step;
    data[i+2] = Math.round(data[i+2] / step) * step;
  }
  putImageData(ctx, imageData);
}

function applyThreshold(ctx, width, height, thresh) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    const val = gray > thresh ? 255 : 0;
    data[i] = val;
    data[i+1] = val;
    data[i+2] = val;
  }
  putImageData(ctx, imageData);
}

function applyPixelate(canvas, ctx, width, height, pixelSize) {
  const tempCanvas = createCanvas(width, height);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(canvas, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  // draw scaled down then up
  ctx.drawImage(tempCanvas, 0, 0, width, height, 0, 0, width / pixelSize, height / pixelSize);
  ctx.drawImage(tempCanvas, 0, 0, width / pixelSize, height / pixelSize, 0, 0, width, height);
  ctx.restore();
}

function applyFlip(ctx, canvas, direction) {
  const tempCanvas = createCanvas(canvas.width, canvas.height);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(canvas, 0, 0);
  ctx.save();
  ctx.translate(direction === "h" ? canvas.width : 0, direction === "v" ? canvas.height : 0);
  ctx.scale(direction === "h" ? -1 : 1, direction === "v" ? -1 : 1);
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.restore();
}

function applyRotate(canvas, ctx, degrees) {
  const radians = degrees * Math.PI / 180;
  const tempCanvas = createCanvas(canvas.width, canvas.height);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.drawImage(canvas, 0, 0);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
  ctx.restore();
}

function applyFlash(ctx, width, height, color, opacity) {
  ctx.save();
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function applyEdge(ctx, width, height) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  const grayscale = new Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    grayscale[i/4] = gray;
  }
  const newData = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const gx = grayscale[(y-1)*width + x+1] + 2*grayscale[y*width + x+1] + grayscale[(y+1)*width + x+1] -
                 (grayscale[(y-1)*width + x-1] + 2*grayscale[y*width + x-1] + grayscale[(y+1)*width + x-1]);
      const gy = grayscale[(y-1)*width + x-1] + 2*grayscale[(y-1)*width + x] + grayscale[(y-1)*width + x+1] -
                 (grayscale[(y+1)*width + x-1] + 2*grayscale[(y+1)*width + x] + grayscale[(y+1)*width + x+1]);
      const magnitude = Math.sqrt(gx*gx + gy*gy);
      const val = Math.min(255, magnitude);
      newData[idx] = val;
      newData[idx+1] = val;
      newData[idx+2] = val;
    }
  }
  putImageData(ctx, new ImageData(newData, width, height));
}

function applyEmboss(ctx, width, height) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  const grayscale = new Array(width * height);
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
    grayscale[i/4] = gray;
  }
  const newData = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const gx = grayscale[(y-1)*width + x-1] - grayscale[(y+1)*width + x+1];
      const gy = grayscale[(y+1)*width + x-1] - grayscale[(y-1)*width + x+1];
      const magnitude = Math.sqrt(gx*gx + gy*gy);
      const val = Math.min(255, 128 + magnitude);
      newData[idx] = val;
      newData[idx+1] = val;
      newData[idx+2] = val;
    }
  }
  putImageData(ctx, new ImageData(newData, width, height));
}

function applySharpen(ctx, width, height) {
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  const original = new Uint8ClampedArray(data);
  const newData = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const i = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += original[i] * kernel[(ky+1)*3 + (kx+1)];
          }
        }
        const idx = (y * width + x) * 4 + c;
        newData[idx] = Math.max(0, Math.min(255, sum));
      }
    }
  }
  putImageData(ctx, new ImageData(newData, width, height));
}

function applyDeepfry(ctx, width, height) {
  // increase contrast and saturation, add noise
  applyContrast(ctx, width, height, 50);
  // saturation boost
  const imageData = getImageData(ctx, width, height);
  const data = imageData.data;
  const factor = 1.5;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const s = max === min ? 0 : (max - min) / (1 - Math.abs(2*l - 1));
    if (s > 0) {
      const hue = (() => {
        const d = max - min;
        let h;
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
        if (h < 0) h += 360;
        return h;
      })();
      // adjust saturation
      const newS = Math.min(1, s * factor);
      const c = (1 - Math.abs(2*l - 1)) * newS;
      const x = c * (1 - Math.abs((h / 60) % 2 - 1));
      const m = l - c / 2;
      let rp, gp, bp;
      if (h < 60) { rp = c; gp = x; bp = 0; }
      else if (h < 120) { rp = x; gp = c; bp = 0; }
      else if (h < 180) { rp = 0; gp = c; bp = x; }
      else if (h < 240) { rp = 0; gp = x; bp = c; }
      else if (h < 300) { rp = x; gp = 0; bp = c; }
      else { rp = c; gp = 0; bp = x; }
      data[i] = Math.min(255, (rp + m) * 255);
      data[i+1] = Math.min(255, (gp + m) * 255);
      data[i+2] = Math.min(255, (bp + m) * 255);
    }
  }
  putImageData(ctx, imageData);
  // add noise
  const noiseData = getImageData(ctx, width, height);
  for (let i = 0; i < noiseData.data.length; i += 4) {
    if (Math.random() < 0.1) {
      const noise = Math.random() * 50 - 25;
      noiseData.data[i] = Math.max(0, Math.min(255, noiseData.data[i] + noise));
      noiseData.data[i+1] = Math.max(0, Math.min(255, noiseData.data[i+1] + noise));
      noiseData.data[i+2] = Math.max(0, Math.min(255, noiseData.data[i+2] + noise));
    }
  }
  putImageData(ctx, noiseData);
}
