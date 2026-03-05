const fs = require('fs');
const path = require('path');

// مسار المجلد الذي يحتوي على صورك
const uploadsDir = './apps/mock-api/data/uploads/';
const files = fs.readdirSync(uploadsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

console.log('Found ' + files.length + ' images to rescue!');

// تقسيم الصور تقريبياً حسب طلبك (شغف 14، بوفالو 4، والباقي MS Brands)
const shaghafImages = files.slice(0, 14);
const buffaloImages = files.slice(14, 18);
const msBrandsImages = files.slice(18, 38);

console.log('Mapping: Shaghaf (14), Buffalo (4), MS Brands (20)...');

// ملاحظة: هذا السكربت سيطبع لك أوامر SQL أو JSON لإضافتها
// بما أنك تستخدم Prisma، الأفضل أن نقوم بعمل Seed سريع
