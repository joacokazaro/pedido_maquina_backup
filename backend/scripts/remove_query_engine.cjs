const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'node_modules', '.prisma', 'client', 'query_engine-windows.dll.node');
console.log('Target:', target);
try {
  if (!fs.existsSync(target)) {
    console.log('NOT_FOUND');
    process.exit(0);
  }
  const backup = target + '.bak.' + Date.now();
  try {
    fs.renameSync(target, backup);
    console.log('RENAMED', backup);
    process.exit(0);
  } catch (e) {
    console.error('RENAME_FAILED', e && e.message);
  }
  try {
    fs.unlinkSync(target);
    console.log('UNLINKED');
  } catch (e) {
    console.error('UNLINK_FAILED', e && e.message);
    process.exit(1);
  }
} catch (err) {
  console.error('ERROR', err && err.message);
  process.exit(1);
}
