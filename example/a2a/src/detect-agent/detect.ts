import ort from "onnxruntime-node";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * YOLOv8类别标签数组
 */
const yolo_classes = [
  "person",
  "bicycle",
  "car",
  "motorcycle",
  "airplane",
  "bus",
  "train",
  "truck",
  "boat",
  "traffic light",
  "fire hydrant",
  "stop sign",
  "parking meter",
  "bench",
  "bird",
  "cat",
  "dog",
  "horse",
  "sheep",
  "cow",
  "elephant",
  "bear",
  "zebra",
  "giraffe",
  "backpack",
  "umbrella",
  "handbag",
  "tie",
  "suitcase",
  "frisbee",
  "skis",
  "snowboard",
  "sports ball",
  "kite",
  "baseball bat",
  "baseball glove",
  "skateboard",
  "surfboard",
  "tennis racket",
  "bottle",
  "wine glass",
  "cup",
  "fork",
  "knife",
  "spoon",
  "bowl",
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
  "chair",
  "couch",
  "potted plant",
  "bed",
  "dining table",
  "toilet",
  "tv",
  "laptop",
  "mouse",
  "remote",
  "keyboard",
  "cell phone",
  "microwave",
  "oven",
  "toaster",
  "sink",
  "refrigerator",
  "book",
  "clock",
  "vase",
  "scissors",
  "teddy bear",
  "hair drier",
  "toothbrush",
] as const;

/**
 * 用于将输入图像转换为张量的函数，
 * 作为YOLOv8物体检测网络的输入。
 * @param buf 上传文件的内容
 * @returns 像素数组
 */
async function prepare_input(buf) {
  const img = sharp(buf);
  const md = await img.metadata();
  const [img_width, img_height] = [md.width, md.height];
  const pixels = await img
    .removeAlpha()
    .resize({ width: 640, height: 640, fit: "fill" })
    .raw()
    .toBuffer();
  const red = [],
    green = [],
    blue = [];
  for (let index = 0; index < pixels.length; index += 3) {
    red.push(pixels[index] / 255.0);
    green.push(pixels[index + 1] / 255.0);
    blue.push(pixels[index + 2] / 255.0);
  }
  const input = [...red, ...green, ...blue];
  return [input, img_width, img_height];
}

/**
 * 用于将提供的输入张量传递给YOLOv8神经网络并返回结果的函数
 * @param input 输入像素数组
 * @returns 神经网络的原始输出，作为数字的平面数组
 */
async function run_model(input) {
  const modelPath = path.join(__dirname, "yolov8m.onnx");
  const model = await ort.InferenceSession.create(modelPath);
  input = new ort.Tensor(Float32Array.from(input), [1, 3, 640, 640]);
  const outputs = await model.run({ images: input });
  return outputs["output0"].data;
}
/**
 * 计算两个边界框交集面积的函数
 * @param box1 第一个边界框，格式为 [x1,y1,x2,y2,object_class,probability]
 * @param box2 第二个边界框，格式为 [x1,y1,x2,y2,object_class,probability]
 * @returns 边界框交集面积，浮点数
 */
function intersection(box1, box2) {
  const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
  const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
  const x1 = Math.max(box1_x1, box2_x1);
  const y1 = Math.max(box1_y1, box2_y1);
  const x2 = Math.min(box1_x2, box2_x2);
  const y2 = Math.min(box1_y2, box2_y2);
  return (x2 - x1) * (y2 - y1);
}

/**
 * 计算两个边界框并集面积的函数
 * @param box1 第一个边界框，格式为 [x1,y1,x2,y2,object_class,probability]
 * @param box2 第二个边界框，格式为 [x1,y1,x2,y2,object_class,probability]
 * @returns 边界框并集面积，浮点数
 */
function union(box1, box2) {
  const [box1_x1, box1_y1, box1_x2, box1_y2] = box1;
  const [box2_x1, box2_y1, box2_x2, box2_y2] = box2;
  const box1_area = (box1_x2 - box1_x1) * (box1_y2 - box1_y1);
  const box2_area = (box2_x2 - box2_x1) * (box2_y2 - box2_y1);
  return box1_area + box2_area - intersection(box1, box2);
}

/**
 * 计算指定两个边界框的"交并比"系数的函数
 * https://pyimagesearch.com/2016/11/07/intersection-over-union-iou-for-object-detection/
 * @param box1 第一个边界框，格式为: [x1,y1,x2,y2,object_class,probability]
 * @param box2 第二个边界框，格式为: [x1,y1,x2,y2,object_class,probability]
 * @returns 交并比值，浮点数
 */
function iou(box1, box2) {
  return intersection(box1, box2) / union(box1, box2);
}

/**
 * 用于将YOLOv8的原始输出转换为检测对象数组的函数
 * 每个对象包含该对象的边界框、对象类型和概率
 * @param output YOLOv8网络的原始输出
 * @param img_width 原始图像宽度
 * @param img_height 原始图像高度
 * @param targetClasses 指定要检测的物体类型数组，如果为空则检测所有类型
 * @returns 检测对象数组，格式为 [[x1,y1,x2,y2,object_type,probability],..]
 */
function process_output(
  output,
  img_width,
  img_height,
  targetClasses?: (typeof yolo_classes)[number][]
) {
  let boxes = [];
  for (let index = 0; index < 8400; index++) {
    const [class_id, prob] = [...Array(80).keys()]
      .map((col) => [col, output[8400 * (col + 4) + index]])
      .reduce((accum, item) => (item[1] > accum[1] ? item : accum), [0, 0]);
    if (prob < 0.5) {
      continue;
    }
    const label = yolo_classes[class_id];

    // 如果指定了目标类型，则只保留指定类型的检测结果
    if (
      targetClasses &&
      targetClasses.length > 0 &&
      !targetClasses.includes(label)
    ) {
      continue;
    }

    const xc = output[index];
    const yc = output[8400 + index];
    const w = output[2 * 8400 + index];
    const h = output[3 * 8400 + index];
    const x1 = ((xc - w / 2) / 640) * img_width;
    const y1 = ((yc - h / 2) / 640) * img_height;
    const x2 = ((xc + w / 2) / 640) * img_width;
    const y2 = ((yc + h / 2) / 640) * img_height;
    boxes.push([x1, y1, x2, y2, label, prob]);
  }

  boxes = boxes.sort((box1, box2) => box2[5] - box1[5]);
  const result = [];
  while (boxes.length > 0) {
    result.push(boxes[0]);
    boxes = boxes.filter((box) => iou(boxes[0], box) < 0.7);
  }
  return result;
}

/**
 * 绘制选项类型定义
 */
interface DrawOptions {
  boxColor?: string;
  labelColor?: string;
  fontSize?: number;
  lineWidth?: number;
  showLabels?: boolean;
  showConfidence?: boolean;
  targetClasses?: (typeof yolo_classes)[number][]; // 指定要检测的物体类型，如 ["person", "car", "bicycle"]
}

/**
 * 接收图像，通过YOLOv8神经网络处理
 * 并返回检测到的对象及其边界框数组的函数
 * @param buf 输入图像数据
 * @param targetClasses 指定要检测的物体类型数组，如果为空则检测所有类型
 * @returns 边界框数组，格式为 [[x1,y1,x2,y2,object_type,probability],..]
 */
export async function detect_objects_on_image(
  buf,
  targetClasses?: (typeof yolo_classes)[number][]
) {
  const [input, img_width, img_height] = await prepare_input(buf);
  const output = await run_model(input);
  const boxes = process_output(output, img_width, img_height, targetClasses);
  return boxes;
}

/**
 * 生成边界框的SVG标记
 * @param boxes 检测到的边界框数组
 * @param imageWidth 图像宽度
 * @param imageHeight 图像高度
 * @param options 绘制选项
 * @returns SVG字符串
 */
function generateBoundingBoxSVG(
  boxes: any[],
  imageWidth: number,
  imageHeight: number,
  options: DrawOptions = {}
) {
  const {
    boxColor = "#00ff00",
    labelColor = "#000000",
    fontSize = 18,
    lineWidth = 3,
    showLabels = true,
    showConfidence = true,
  } = options;

  if (boxes.length === 0) {
    return `<svg width="${imageWidth}" height="${imageHeight}"></svg>`;
  }

  const boxElements = boxes
    .map((box, index) => {
      const [x1, y1, x2, y2, className, confidence] = box;
      const width = x2 - x1;
      const height = y2 - y1;

      const label = showLabels
        ? `${className}${
            showConfidence ? ` ${(confidence * 100).toFixed(1)}%` : ""
          }`
        : "";

      const labelWidth = label.length * fontSize * 0.6;
      const labelHeight = fontSize + 4;
      const labelY = Math.max(labelHeight, y1);

      return `
      <!-- 边界框 ${index + 1}: ${className} -->
      <rect x="${x1}" y="${y1}" width="${width}" height="${height}" 
            fill="none" stroke="${boxColor}" stroke-width="${lineWidth}"/>
      ${
        label
          ? `
        <!-- 标签背景 -->
        <rect x="${x1}" y="${labelY - labelHeight}" 
              width="${labelWidth}" height="${labelHeight}" 
              fill="${boxColor}" opacity="0.8"/>
        <!-- 标签文本 -->
        <text x="${x1 + 5}" y="${labelY - 5}" 
              font-family="Arial, sans-serif" font-size="${fontSize}" 
              fill="${labelColor}" font-weight="bold">${label}</text>
      `
          : ""
      }
    `;
    })
    .join("\n");

  return `
    <svg width="${imageWidth}" height="${imageHeight}">
      ${boxElements}
    </svg>
  `;
}

/**
 * 在图像上绘制边界框和标签
 * @param imageBuffer 原始图像数据
 * @param boxes 检测到的边界框数组，格式为 [[x1,y1,x2,y2,object_type,probability],...]
 * @param options 绘制选项
 * @returns 绘制后的图像Buffer
 */
export async function draw_image_and_boxes(
  imageBuffer: Buffer,
  boxes: any[],
  options: DrawOptions = {}
) {
  try {
    // 获取图像信息
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const imageWidth = metadata.width || 0;
    const imageHeight = metadata.height || 0;

    if (boxes.length === 0) {
      console.log("没有检测到物体，返回原始图像");
      return imageBuffer;
    }

    console.log(`正在绘制 ${boxes.length} 个边界框...`);

    // 生成SVG覆盖层
    const svgOverlay = generateBoundingBoxSVG(
      boxes,
      imageWidth,
      imageHeight,
      options
    );
    const svgBuffer = Buffer.from(svgOverlay);

    // 将SVG覆盖层合成到原始图像上
    const result = await image
      .composite([
        {
          input: svgBuffer,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();

    console.log("边界框绘制完成！");
    return result;
  } catch (error) {
    console.error("绘制边界框时出错:", error);
    throw new Error(`图像绘制失败: ${error.message}`);
  }
}

/**
 * 根据URL类型读取文件buffer
 * 支持 HTTP/HTTPS、file://、data: (base64) 等格式
 * @param url 文件URL
 * @returns Promise<ArrayBuffer>
 */
export async function fetchImage(url: string): Promise<ArrayBuffer> {
  try {
    // 处理 HTTP/HTTPS URL
    if (url.startsWith("http://") || url.startsWith("https://")) {
      console.log(`正在获取网络文件: ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `网络请求失败: ${response.status} ${response.statusText}`
        );
      }
      return await response.arrayBuffer();
    }

    // 处理 file:// URL
    if (url.startsWith("file://")) {
      console.log(`正在读取本地文件: ${url}`);
      const filePath = url.replace("file://", "");
      const resolvedPath = path.resolve(filePath);

      // 检查文件是否存在
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`文件不存在: ${resolvedPath}`);
      }

      const buffer = fs.readFileSync(resolvedPath);
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
    }

    // 处理 data: URL (base64)
    if (url.startsWith("data:")) {
      console.log(`正在解析base64数据: ${url.substring(0, 50)}...`);
      const base64Data = url.split(",")[1];
      if (!base64Data) {
        throw new Error("无效的data URL格式");
      }

      const buffer = Buffer.from(base64Data, "base64");
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
    }

    // 处理相对路径或绝对路径 (当作本地文件)
    if (!url.includes("://")) {
      console.log(`正在读取本地文件: ${url}`);
      const resolvedPath = path.resolve(url);

      // 检查文件是否存在
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`文件不存在: ${resolvedPath}`);
      }

      const buffer = fs.readFileSync(resolvedPath);
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
    }

    // 不支持的URL类型
    throw new Error(`不支持的URL类型: ${url}`);
  } catch (error) {
    console.error(`获取图像失败: ${error.message}`);
    throw error;
  }
}

/**
 * 检测物体并绘制边界框
 * @param imageUrl 输入图像URL
 * @param drawOptions 绘制选项
 * @returns 包含检测结果和绘制图像的对象
 */
export async function detect_and_draw(
  imageUrl: string,
  drawOptions: DrawOptions = {}
) {
  try {
    const imageArrayBuffer = await fetchImage(imageUrl);
    const imageBuffer = Buffer.from(imageArrayBuffer);

    // 执行物体检测，使用指定的目标类型
    const boxes = await detect_objects_on_image(
      imageBuffer,
      drawOptions.targetClasses
    );

    // 绘制边界框
    const drawnImage = await draw_image_and_boxes(
      imageBuffer,
      boxes,
      drawOptions
    );

    return {
      boxes,
      drawnImage,
      originalImage: imageBuffer,
    };
  } catch (error) {
    console.error("检测和绘制过程中出错:", error);
    throw error;
  }
}

// 同时导出类别标签数组，供工具使用
export { yolo_classes };
