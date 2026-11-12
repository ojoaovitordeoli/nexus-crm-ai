/** @type {import('next').NextConfig} */
// NEXT_OUTPUT=standalone é usado só no pacote Docker (servidor enxuto, sem node_modules inteiro).
// No Render o build continua o mesmo de sempre (npm run build + npm start).
module.exports = {
  reactStrictMode: true,
  images: { unoptimized: true },
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {})
};
