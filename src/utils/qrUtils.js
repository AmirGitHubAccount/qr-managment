import QRCode from 'qrcode';

const QR_BASE_URL = 'https://psrar.github.io/tal_web_app/#/home/items/';

export function getQrUrl(productId) {
  return QR_BASE_URL + encodeURIComponent(productId);
}

export async function generateQrDataUrl(productId) {
  const url = getQrUrl(productId);
  return await QRCode.toDataURL(url, {
    width: 300,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}

export async function generateQrDataUrlSmall(productId) {
  const url = getQrUrl(productId);
  return await QRCode.toDataURL(url, {
    width: 160,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'M',
  });
}
