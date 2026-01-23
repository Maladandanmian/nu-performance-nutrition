/**
 * DEXA PDF Image Extraction Module
 * 
 * Extracts specific images from DEXA scan PDFs:
 * - Body scan images (colorized fat distribution + grayscale skeletal)
 * - Fracture Risk chart (BMD zones with age)
 * - Total Body % Fat chart (body fat percentage zones with age)
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { randomBytes } from 'crypto';
import { storagePut } from './storage';
import { invokeLLM } from './_core/llm';

const execAsync = promisify(exec);

interface ExtractedImage {
  type: 'body_scan_colorized' | 'body_scan_grayscale' | 'fracture_risk_chart' | 'body_fat_chart';
  imageUrl: string;
  imageKey: string;
  pageNumber: number;
}

/**
 * Convert PDF to images (one image per page)
 */
async function pdfToImages(pdfPath: string): Promise<string[]> {
  const outputDir = `/tmp/dexa-${randomBytes(8).toString('hex')}`;
  
  // Use pdf2image (poppler-utils) to convert PDF pages to PNG
  // -png: output format
  // -r 150: resolution (DPI)
  await execAsync(`mkdir -p ${outputDir}`);
  await execAsync(`pdftoppm -png -r 150 "${pdfPath}" "${outputDir}/page"`);
  
  // List generated images
  const { stdout } = await execAsync(`ls ${outputDir}/*.png`);
  const imagePaths = stdout.trim().split('\n');
  
  return imagePaths;
}

/**
 * Use AI vision to identify and extract specific image sections
 */
async function identifyImageSections(imagePath: string, pageNum: number): Promise<ExtractedImage[]> {
  // Read image as base64
  const imageBuffer = await readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const imageDataUrl = `data:image/png;base64,${base64Image}`;
  
  // Ask AI to identify which sections are present in this page
  const response = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `You are analyzing a DEXA scan report page. Identify which of these image types are present:
- body_scan_colorized: Colorized body scan showing fat distribution (usually red/blue/pink colors)
- body_scan_grayscale: Grayscale skeletal body scan
- fracture_risk_chart: Chart showing BMD/bone density zones with age (usually has green/yellow/red zones labeled "Fracture Risk")
- body_fat_chart: Chart showing body fat percentage zones with age (usually labeled "Total Body % Fat")

Return ONLY a JSON array of objects with this structure:
[
  { "type": "body_scan_colorized", "present": true },
  { "type": "body_scan_grayscale", "present": false },
  { "type": "fracture_risk_chart", "present": true },
  { "type": "body_fat_chart", "present": false }
]

Do not include any other text or explanation.`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this DEXA report page and identify which image types are present:' },
          { type: 'image_url', image_url: { url: imageDataUrl } }
        ]
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'image_identification',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: {
                    type: 'string',
                    enum: ['body_scan_colorized', 'body_scan_grayscale', 'fracture_risk_chart', 'body_fat_chart']
                  },
                  present: { type: 'boolean' }
                },
                required: ['type', 'present'],
                additionalProperties: false
              }
            }
          },
          required: ['images'],
          additionalProperties: false
        }
      }
    }
  });
  
  const content = response.choices[0].message.content;
  const contentText = typeof content === 'string' ? content : content?.[0]?.type === 'text' ? content[0].text : '{}';
  const identified = JSON.parse(contentText);
  
  // Upload full page image to S3 for each identified type
  const results: ExtractedImage[] = [];
  
  for (const img of identified.images) {
    if (img.present) {
      // Upload the full page image (we're not cropping for MVP)
      const imageKey = `dexa-images/${randomBytes(16).toString('hex')}.png`;
      const { url } = await storagePut(imageKey, imageBuffer, 'image/png');
      
      results.push({
        type: img.type,
        imageUrl: url,
        imageKey,
        pageNumber: pageNum
      });
    }
  }
  
  return results;
}

/**
 * Extract images from DEXA PDF
 */
export async function extractDexaImages(pdfPath: string): Promise<ExtractedImage[]> {
  const allExtractedImages: ExtractedImage[] = [];
  
  try {
    // Convert PDF to images
    const pageImages = await pdfToImages(pdfPath);
    
    // Process each page
    for (let i = 0; i < pageImages.length; i++) {
      const pagePath = pageImages[i];
      const pageNum = i + 1;
      
      // Identify and extract sections from this page
      const extracted = await identifyImageSections(pagePath, pageNum);
      allExtractedImages.push(...extracted);
      
      // Clean up temporary page image
      await unlink(pagePath);
    }
    
    // Clean up temporary directory
    const outputDir = pageImages[0].substring(0, pageImages[0].lastIndexOf('/'));
    await execAsync(`rm -rf "${outputDir}"`);
    
    return allExtractedImages;
    
  } catch (error) {
    console.error('Error extracting DEXA images:', error);
    throw new Error(`Failed to extract images from DEXA PDF: ${error}`);
  }
}
