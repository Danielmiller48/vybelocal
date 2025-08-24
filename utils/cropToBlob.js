// utils/cropToBlob.js
export async function getCroppedImg(src, areaPixels) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = areaPixels.width;
      canvas.height = areaPixels.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        image,
        areaPixels.x,
        areaPixels.y,
        areaPixels.width,
        areaPixels.height,
        0,
        0,
        areaPixels.width,
        areaPixels.height
      );
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
    };
    image.src = src;
  });
} 