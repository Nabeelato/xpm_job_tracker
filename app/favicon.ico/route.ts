const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0f766e"/>
  <path fill="#ffffff" d="M15 17h34v8H36v22h-8V25H15z"/>
  <path fill="#d1fae5" d="M41 31h8v16h-8z"/>
</svg>`;

export function GET() {
  return new Response(icon, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=86400",
    },
  });
}
