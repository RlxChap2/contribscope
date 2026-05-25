import type { Contributor, ImageQuery } from './types';
import { mapLimit } from './utils';

function escapeXml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function avatarUrlWithSize(url: string, size: number) {
  const avatarUrl = new URL(url);
  avatarUrl.searchParams.set('s', String(size * 2));
  return avatarUrl.toString();
}

function placeholderDataUri(login: string, size: number) {
  const initials = login.slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="#1f6f55"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Arial" font-size="${Math.max(12, size / 3)}" font-weight="700">${escapeXml(initials)}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function fetchAvatarDataUri(contributor: Contributor, size: number) {
  try {
    const response = await fetch(avatarUrlWithSize(contributor.avatarUrl, size));
    if (!response.ok) return placeholderDataUri(contributor.login, size);

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64 = arrayBufferToBase64(await response.arrayBuffer());

    return `data:${contentType};base64,${base64}`;
  } catch {
    return placeholderDataUri(contributor.login, size);
  }
}

export async function resolveAvatarImages(contributors: Contributor[], query: ImageQuery) {
  if (!query.embed) {
    return contributors.map((contributor) => ({
      ...contributor,
      avatarHref: avatarUrlWithSize(contributor.avatarUrl, query.size),
    }));
  }

  return mapLimit(contributors, 8, async (contributor) => ({
    ...contributor,
    avatarHref: await fetchAvatarDataUri(contributor, query.size),
  }));
}

export function renderContributorsSvg(contributors: Contributor[], query: ImageQuery) {
  if (contributors.length === 0) {
    return renderMessageSvg('No contributors found');
  }

  const columns = Math.min(query.columns, contributors.length);
  const labelHeight = query.showNames ? 18 : 0;
  const cellHeight = query.size + labelHeight;
  const rows = Math.ceil(contributors.length / columns);
  const width = columns * query.size + (columns - 1) * query.gap;
  const height = rows * cellHeight + (rows - 1) * query.gap;
  const radius = query.shape === 'circle' ? query.size / 2 : query.shape === 'square' ? 0 : Math.max(4, Math.floor(query.size * 0.18));

  const defs = contributors
    .map((_, index) => {
      const x = (index % columns) * (query.size + query.gap);
      const y = Math.floor(index / columns) * (cellHeight + query.gap);
      return `<clipPath id="avatar-${index}"><rect x="${x}" y="${y}" width="${query.size}" height="${query.size}" rx="${radius}" ry="${radius}"/></clipPath>`;
    })
    .join('');

  const avatars = contributors
    .map((contributor, index) => {
      const x = (index % columns) * (query.size + query.gap);
      const y = Math.floor(index / columns) * (cellHeight + query.gap);
      const label = `${contributor.login}: ${contributor.contributions} contributions across ${contributor.repoCount} repos`;
      const name = query.showNames
        ? `<text x="${x + query.size / 2}" y="${y + query.size + 13}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="10" fill="#39423f">${escapeXml(contributor.login)}</text>`
        : '';

      return `<a href="${escapeXml(contributor.htmlUrl)}" target="_blank" rel="noopener noreferrer"><title>${escapeXml(label)}</title><image x="${x}" y="${y}" width="${query.size}" height="${query.size}" clip-path="url(#avatar-${index})" href="${escapeXml(contributor.avatarHref || contributor.avatarUrl)}"/></a>${name}`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="GitHub contributors"><defs>${defs}</defs>${avatars}</svg>`;
}

export function renderMessageSvg(message: string, tone: 'neutral' | 'error' = 'neutral') {
  const fill = tone === 'error' ? '#8a2632' : '#1f6f55';
  const background = tone === 'error' ? '#fff2f3' : '#f3faf7';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="540" height="96" viewBox="0 0 540 96" role="img" aria-label="${escapeXml(message)}"><rect width="540" height="96" rx="12" fill="${background}"/><text x="24" y="56" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" fill="${fill}">${escapeXml(message)}</text></svg>`;
}
