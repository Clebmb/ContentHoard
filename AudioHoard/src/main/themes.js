const path = require('path');
const fs = require('fs');
const { app, dialog, shell } = require('electron');

function getThemesDir() {
  const dir = path.join(app.getPath('userData'), 'themes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getThemeSourcesPath() { return path.join(getThemesDir(), '_sources.json'); }

function readThemeSources() {
  try {
    const p = getThemeSourcesPath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {}
  return {};
}

function writeThemeSources(map) {
  try { fs.writeFileSync(getThemeSourcesPath(), JSON.stringify(map, null, 2), 'utf-8'); }
  catch (err) { console.error('Failed to write theme sources:', err); }
}

function parseThemeName(css, filename) {
  const match = css.match(/\/\*\s*@name\s+(.+?)\s*\*\//i);
  if (match) return match[1].trim();
  return filename.replace(/\.css$/i, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function register(ipcMain, ctx) {
  ipcMain.handle('theme:scan', async () => {
    try {
      const dir = getThemesDir();
      return fs.readdirSync(dir).filter(f => f.endsWith('.css')).sort().map(f => {
        try { const css = fs.readFileSync(path.join(dir, f), 'utf-8'); return { id: f, name: parseThemeName(css, f) }; }
        catch { return { id: f, name: f.replace(/\.css$/i, '') }; }
      });
    } catch (err) { console.error('Theme scan error:', err); return []; }
  });

  ipcMain.handle('theme:load', async (_event, id) => {
    try {
      const p = path.join(getThemesDir(), path.basename(id));
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
    } catch (err) { console.error('Theme load error:', err); return null; }
  });

  ipcMain.handle('theme:add', async () => {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
      title: 'Add custom theme (.css)', filters: [{ name: 'CSS Files', extensions: ['css'] }], properties: ['openFile', 'multiSelections']
    });
    if (result.canceled || !result.filePaths.length) return null;
    const added = [];
    const dir = getThemesDir();
    const sources = readThemeSources();
    for (const src of result.filePaths) {
      try {
        const filename = path.basename(src);
        const dest = path.join(dir, filename);
        fs.copyFileSync(src, dest);
        sources[filename] = src;
        const css = fs.readFileSync(dest, 'utf-8');
        added.push({ id: filename, name: parseThemeName(css, filename) });
      } catch (err) { console.error('Theme add error:', err); }
    }
    writeThemeSources(sources);
    return added.length ? added : null;
  });

  ipcMain.handle('theme:reload', async (_event, id) => {
    try {
      const filename = path.basename(id);
      const dest = path.join(getThemesDir(), filename);
      const sources = readThemeSources();
      const srcPath = sources[filename];
      if (srcPath && fs.existsSync(srcPath)) fs.copyFileSync(srcPath, dest);
      return fs.existsSync(dest) ? fs.readFileSync(dest, 'utf-8') : null;
    } catch (err) { console.error('Theme reload error:', err); return null; }
  });

  ipcMain.handle('theme:remove', async (_event, id) => {
    try {
      const filename = path.basename(id);
      const p = path.join(getThemesDir(), filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      const sources = readThemeSources();
      if (sources[filename]) { delete sources[filename]; writeThemeSources(sources); }
      return true;
    } catch (err) { console.error('Theme remove error:', err); return false; }
  });

  ipcMain.handle('theme:openFolder', async () => { shell.openPath(getThemesDir()); return true; });
}

module.exports = { getThemesDir, register };
