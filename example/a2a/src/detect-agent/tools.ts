/**
 * 物体检测工具定义模块
 *
 * 此模块定义了用于图像物体检测和分析的 Genkit 工具。
 * 这些工具可以被 AI 模型调用，以分析图像中的物体并提供检测结果。
 *
 * 包含的工具：
 * - detectObjects：检测图像中的物体
 *
 * 工具特性：
 * - 使用YOLOv8神经网络进行物体检测
 * - 自动格式化输出，便于 AI 理解和处理
 * - 完整的错误处理
 * - 提供边界框、置信度和物体类别信息
 * - 支持80种常见物体类别的检测
 *
 * 技术架构：基于 ONNX Runtime 和 YOLOv8 模型
 * 使用前需要确保模型文件：yolov8m.onnx 在正确位置
 */

import { ai, z } from "./genkit.js";
import { detect_and_draw, yolo_classes } from "./detect.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 保存base64图像数据到指定目录
 * @param base64Data 图像的base64数据（不含data:image前缀）
 * @param filePrefix 文件名前缀，默认为'image'
 * @param outputDir 输出目录路径，默认为项目根目录下的assets/images
 * @returns 保存的文件路径，如果保存失败则返回null
 */
function saveImageToAssets(
  base64Data: string,
  filePrefix: string = "image",
  outputDir?: string
): string | null {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `${filePrefix}-${timestamp}.png`;

    // 如果没有指定输出目录，使用默认的assets/images目录
    const defaultOutputDir =
      outputDir ||
      path.join(path.resolve(__dirname, "../../"), "assets/images");
    const outputPath = path.join(defaultOutputDir, filename);

    // 确保目录存在
    fs.mkdirSync(defaultOutputDir, { recursive: true });

    // 从base64解码并保存图片
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(outputPath, buffer);

    console.log(`图片已保存到: ${outputPath}`);
    return outputPath;
  } catch (saveError) {
    console.error("保存图片失败:", saveError);
    return null;
  }
}

/**
 * 检测结果接口定义
 * 描述单个检测到的物体的信息
 */
interface DetectionResult {
  x1: number; // 边界框左上角x坐标
  y1: number; // 边界框左上角y坐标
  x2: number; // 边界框右下角x坐标
  y2: number; // 边界框右下角y坐标
  class: string; // 物体类别
  confidence: number; // 置信度 (0-1)
}

/**
 * 格式化检测结果为易读的文本描述
 * @param detections 检测结果数组
 * @param imageInfo 图像基本信息
 * @returns 格式化的文本描述
 */
function formatDetectionResults(
  detections: Array<[number, number, number, number, string, number]>,
  imageInfo?: { width?: number; height?: number }
): string {
  if (detections.length === 0) {
    return "在这张图像中没有检测到任何物体。";
  }

  const totalObjects = detections.length;
  const objectCounts = detections.reduce((counts, detection) => {
    const className = detection[4];
    counts[className] = (counts[className] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  let result = `图像分析完成！检测到 ${totalObjects} 个物体：\n\n`;

  // 物体统计摘要
  result += "检测摘要：\n";
  Object.entries(objectCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([className, count]) => {
      result += `- ${className}: ${count} 个\n`;
    });

  result += "\n详细检测结果：\n";

  // 详细检测信息
  detections
    .sort((a, b) => b[5] - a[5]) // 按置信度排序
    .forEach((detection, index) => {
      const [x1, y1, x2, y2, className, confidence] = detection;
      const width = Math.round(x2 - x1);
      const height = Math.round(y2 - y1);
      const centerX = Math.round((x1 + x2) / 2);
      const centerY = Math.round((y1 + y2) / 2);

      result += `${index + 1}. ${className}\n`;
      result += `   置信度: ${(confidence * 100).toFixed(1)}%\n`;
      result += `   位置: (${Math.round(x1)}, ${Math.round(
        y1
      )}) 到 (${Math.round(x2)}, ${Math.round(y2)})\n`;
      result += `   尺寸: ${width} × ${height} 像素\n`;
      result += `   中心点: (${centerX}, ${centerY})\n\n`;
    });

  // 支持的物体类别信息
  result += `\n系统支持检测以下 ${yolo_classes.length} 种物体类别：\n`;
  result += yolo_classes.join(", ");

  return result;
}

/**
 * 物体检测工具
 *
 * 此工具允许 AI 模型对上传的图像进行物体检测分析。
 * 它会使用YOLOv8模型识别图像中的物体，并返回详细的检测结果。
 *
 * 功能特点：
 * - 支持80种常见物体类别的检测
 * - 提供精确的边界框坐标
 * - 返回每个检测物体的置信度
 * - 自动格式化结果，便于AI理解和描述
 * - 包含物体的空间位置和尺寸信息
 */
export const detectObjects = ai.defineTool(
  {
    name: "detectObjects",
    description: "对图像进行物体检测，识别图像中的各种物体并返回其位置和类别",
    inputSchema: z.object({
      imageUrl: z
        .string()
        .describe(
          "图像URL，支持HTTP/HTTPS URL、file://本地文件、data:base64数据、相对路径或绝对路径"
        ),
      targetClasses: z
        .array(z.enum(yolo_classes))
        .optional()
        .describe("指定要检测的物体类型，如果为空则检测所有类型"),
      includeDetails: z
        .boolean()
        .optional()
        .describe("是否包含详细的检测信息，默认为true"),
      drawBoundingBoxes: z
        .boolean()
        .optional()
        .describe("是否在图像上绘制边界框，默认为false"),
    }),
  },
  async ({
    imageUrl,
    targetClasses,
    includeDetails = true,
    drawBoundingBoxes = true,
  }) => {
    console.log("\n正在调用[detect:detectObjects]，开始物体检测分析...\n");
    console.log(`图像URL: ${imageUrl}`);
    if (targetClasses && targetClasses.length > 0) {
      console.log(`指定检测类型: ${targetClasses.join(", ")}`);
    } else {
      console.log("检测所有类型");
    }

    try {
      // 调用detect_and_draw方法获取检测结果
      const result = await detect_and_draw(imageUrl, { targetClasses });
      const { boxes, drawnImage, originalImage } = result;

      console.log(`检测完成！发现 ${boxes.length} 个物体`);

      // 格式化检测结果
      let formattedResult = formatDetectionResults(boxes);

      // 如果需要绘制边界框，返回带边界框的图像
      if (drawBoundingBoxes) {
        const drawnImageBase64 = drawnImage.toString("base64");
        // const drawnImageDataUrl = `data:image/png;base64,${drawnImageBase64}`;

        // 保存图片到assets/images目录
        const outputPath = saveImageToAssets(
          drawnImageBase64,
          "detection-result"
        );

        if (outputPath) {
          formattedResult += `\n\n📸 已生成带边界框的图像：
- 图像格式: PNG
- 图像尺寸: 已标注所有检测到的物体
- 边界框颜色: 绿色 (#00ff00)
- 包含置信度和类别标签
- 保存路径: ${outputPath}`;
        }
      }

      // 如果需要详细信息，添加技术细节
      if (includeDetails && boxes.length > 0) {
        const maxConfidence = Math.max(...boxes.map((d) => d[5]));
        const minConfidence = Math.min(...boxes.map((d) => d[5]));
        const avgConfidence =
          boxes.reduce((sum, d) => sum + d[5], 0) / boxes.length;

        const technicalInfo = `\n技术分析信息：
- 检测模型: YOLOv8 (Medium)
- 处理图像尺寸: 640×640 (模型输入尺寸)
- 最高置信度: ${(maxConfidence * 100).toFixed(1)}%
- 最低置信度: ${(minConfidence * 100).toFixed(1)}%
- 平均置信度: ${(avgConfidence * 100).toFixed(1)}%
- 置信度阈值: 50%
- NMS阈值: 70%`;

        formattedResult += technicalInfo;
      }

      return formattedResult;
    } catch (error) {
      console.error("物体检测过程中出错:", error);

      // 返回友好的错误信息
      if (error.message.includes("模型文件")) {
        return "检测失败：找不到YOLOv8模型文件 (yolov8m.onnx)。请确保模型文件位于正确的目录中。";
      } else if (error.message.includes("图像格式")) {
        return "检测失败：图像格式不支持。请提供有效的图像数据。";
      } else {
        return `检测失败：${error.message}。请检查图像数据是否正确，或稍后重试。`;
      }
    }
  }
);
