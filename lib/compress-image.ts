const compressibleTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ImageOptimizationResult = {
  file: File;
  optimized: boolean;
  originalSize: number;
};

export async function optimizeImage(
  file: File,
  options: { maxDimension: number; quality: number },
): Promise<ImageOptimizationResult> {
  if (!compressibleTypes.has(file.type)) {
    return { file, optimized: false, originalSize: file.size };
  }

  try {
    const Compressor = (await import("compressorjs")).default;
    const compressed = await new Promise<Blob>((resolve, reject) => {
      new Compressor(file, {
        quality: options.quality,
        maxWidth: options.maxDimension,
        maxHeight: options.maxDimension,
        strict: false,
        retainExif: false,
        success: resolve,
        error: reject,
      });
    });

    if (!compressed.size) {
      return { file, optimized: false, originalSize: file.size };
    }

    return {
      file: new File([compressed], file.name, {
        type: compressed.type || file.type,
        lastModified: file.lastModified,
      }),
      optimized: compressed.size < file.size,
      originalSize: file.size,
    };
  } catch {
    return { file, optimized: false, originalSize: file.size };
  }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
