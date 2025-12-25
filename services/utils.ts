
// Shared constant for default wallpaper
export const DEFAULT_WALLPAPER = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=2000";

/**
 * Chuyển đổi link chia sẻ Google Drive thành link tải trực tiếp.
 */
export const getGoogleDriveDirectLink = (url: string): string => {
  if (!url) return '';
  const driveRegex = /(?:https?:\/\/)?(?:drive\.google\.com\/(?:file\/d\/|open\?id=)|docs\.google\.com\/uc\?id=)([a-zA-Z0-9_-]+)/;
  const match = url.match(driveRegex);
  if (match && match[1]) {
    return `https://docs.google.com/uc?export=download&id=${match[1]}`;
  }
  return url;
};

/**
 * Hệ thống Proxy kháng CORS mạnh mẽ với cơ chế xoay vòng.
 * Được tinh chỉnh để vượt qua các rào cản 'Failed to fetch' từ các server IPTV.
 */
export const getProxyUrls = (url: string): {url: string, type: 'raw' | 'json'}[] => {
  const encodedUrl = encodeURIComponent(url);
  return [
    { url: `https://api.allorigins.win/raw?url=${encodedUrl}`, type: 'raw' },
    { url: `https://corsproxy.io/?${encodedUrl}`, type: 'raw' },
    { url: `https://api.codetabs.com/v1/proxy?quest=${encodedUrl}`, type: 'raw' },
    { url: `https://api.allorigins.win/get?url=${encodedUrl}`, type: 'json' }, // AllOrigins JSON mode (Rất ổn định cho link phim)
    { url: `https://thingproxy.freeboard.io/fetch/${url}`, type: 'raw' },
    { url: url, type: 'raw' }
  ];
};

/**
 * Hàm bóc tách link m3u8 từ mã nguồn HTML (Chỉ dùng dự phòng nếu cần).
 */
export const extractM3U8FromHTML = (html: string): string | null => {
  if (!html) return null;
  const m3u8Regex = /(https?:\/\/[^"']+\.(?:m3u8|ts|mp4|m4s)[^"']*)/i;
  const match = html.match(m3u8Regex);
  return match ? match[1] : null;
};

/**
 * Kiểm tra xem nội dung có phải là thông báo chặn truy cập từ server hay không.
 */
export const isIPTVBlockedResponse = (data: string): boolean => {
  if (!data || typeof data !== 'string') return false;
  if (data.length < 20) return false; 
  
  const keywords = [
    'Televizo', 'Ott navigator', 'Tivimate', 'IPTV player', 
    'truy cập bằng ứng dụng', 'Client not allowed', 'Forbidden', '403 Forbidden',
    'chặn truy cập', 'vui lòng dùng link', 'không hỗ trợ web', 'chặn trình duyệt'
  ];
  const lowercaseData = data.toLowerCase();
  return keywords.some(keyword => lowercaseData.includes(keyword.toLowerCase()));
};

/**
 * Bộ phân giải M3U8 hiệu suất cao.
 * Tối ưu hóa Regex để xử lý danh sách hàng nghìn kênh mà không gây giật lag.
 */
export const parseM3U = (data: string): any[] => {
  if (!data || typeof data !== 'string') return [];
  
  const cleanData = data.replace(/^\uFEFF/, '');
  const lines = cleanData.split(/\r?\n/);
  const items: any[] = [];
  let currentMetadata: any = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#EXTM3U')) continue;

    if (line.startsWith('#EXTINF:')) {
      const nameMatch = line.match(/,(.*)$/);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      
      currentMetadata = {
        name: nameMatch ? nameMatch[1].trim() : 'Nguồn chưa đặt tên',
        logo: logoMatch ? logoMatch[1] : '',
        group: groupMatch ? groupMatch[1] : ''
      };
    } else if (line.startsWith('#EXTGRP:')) {
      if (currentMetadata) {
        currentMetadata.group = line.replace('#EXTGRP:', '').trim();
      }
    } else if (line.startsWith('http') || line.includes('.m3u8') || line.includes('.ts') || line.includes('.mp4') || line.includes('.php')) {
      const url = getGoogleDriveDirectLink(line);
      if (currentMetadata) {
        items.push({
          ...currentMetadata,
          group: currentMetadata.group || 'Khác',
          url: url,
          id: `phyky-${i}-${Math.random().toString(36).substr(2, 4)}`
        });
        currentMetadata = null;
      } else {
        items.push({
          name: `Nội dung ${items.length + 1}`,
          url: url,
          group: 'Khác',
          id: `raw-${i}-${Math.random().toString(36).substr(2, 4)}`
        });
      }
    }
  }
  return items;
};
