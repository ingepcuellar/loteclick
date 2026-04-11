/**
 * LoteClick - Camera Utilities
 * Hybrid camera/photo picker: uses @capacitor/camera on iOS/Android,
 * falls back to <input type="file"> on web.
 */
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

/**
 * Check if running on a native platform (iOS/Android)
 */
const isNative = () => Capacitor.isNativePlatform();

/**
 * Convert a base64 data URL to a File object
 */
function dataURLtoFile(dataUrl, filename = 'photo.jpg') {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

/**
 * Pick an image using native camera plugin (iOS/Android) or file input (web).
 * 
 * On native platforms: uses @capacitor/camera which properly handles
 * the camera/photo library on iPad without WKWebView popover crashes.
 * 
 * On web: creates a temporary file input and triggers it.
 * 
 * @param {Object} options
 * @param {string} options.source - 'prompt' (default, ask user), 'camera', or 'photos'
 * @param {boolean} options.allowPdf - If true, also accept PDF files (web only)
 * @returns {Promise<{file: File, preview: string}|null>} - File and preview data URL, or null if cancelled
 */
export async function pickImage({ source = 'prompt', allowPdf = false } = {}) {
    if (isNative()) {
        return pickImageNative(source);
    } else {
        return pickImageWeb(allowPdf);
    }
}

/**
 * Native implementation using @capacitor/camera
 */
async function pickImageNative(source) {
    try {
        const sourceMap = {
            'camera': CameraSource.Camera,
            'photos': CameraSource.Photos,
            'prompt': CameraSource.Prompt,
        };

        const image = await Camera.getPhoto({
            quality: 80,
            allowEditing: false,
            resultType: CameraResultType.DataUrl,
            source: sourceMap[source] || CameraSource.Prompt,
            width: 1920,
            height: 1920,
            correctOrientation: true,
        });

        if (!image || !image.dataUrl) return null;

        const file = dataURLtoFile(image.dataUrl, `photo_${Date.now()}.${image.format || 'jpeg'}`);

        return {
            file,
            preview: image.dataUrl,
        };
    } catch (err) {
        // User cancelled or error
        if (err.message?.includes('cancelled') || err.message?.includes('User cancelled')) {
            return null;
        }
        console.error('Camera error:', err);
        // Fall back to web picker if native fails
        return pickImageWeb(false);
    }
}

/**
 * Web implementation using file input
 */
function pickImageWeb(allowPdf = false) {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = allowPdf ? 'image/*,.pdf' : 'image/*';
        input.style.display = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            document.body.removeChild(input);

            if (!file) {
                resolve(null);
                return;
            }

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    resolve({
                        file,
                        preview: ev.target.result,
                    });
                };
                reader.readAsDataURL(file);
            } else {
                // PDF or other file type — no preview
                resolve({
                    file,
                    preview: null,
                });
            }
        });

        // Handle cancel (no file selected)
        input.addEventListener('cancel', () => {
            document.body.removeChild(input);
            resolve(null);
        });

        input.click();
    });
}
