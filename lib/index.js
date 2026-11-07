/**
 * dsh-upgrade-linux — Host 半区
 *
 * 设计原则：**不写死任何路径**。
 *   npm 位置、npm 全局前缀、DSH_HOME、profile 名、备份目录、重启方式
 *   全部来自运行时探测（process.execPath / /proc/self/cgroup / env / 实际文件系统）。
 *
 * 与 dsh-upgrade 的关键差异：
 *   1. 不重写 PATH（原插件把 /opt/homebrew:/usr/local 前置，导致 npm 落到系统前缀 /usr/local → EACCES）
 *   2. 用 systemd 重启（原插件硬编码 launchctl，Linux 上必崩）
 *   3. 升级记录/备份路径全部按实际环境生成（原插件写死作者本机 /Users/wonaren/...）
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const name = 'dsh-upgrade-linux';
export const __test = { buildInfo, cmp, satisfies };
export const inject = ['webServer'];

const PKG = '@deepseek-ai/dsh';
const PREFIX = '/api/dsh-upgrade-lx';

// ───────────────────────────────── 环境探测 ─────────────────────────────────

function safeExec(bin, args, opts = {}) {
  try {
    return execFileSync(bin, args, {
      encoding: 'utf8',
      timeout: opts.timeout ?? 8000,
      stdio: opts.stdio ?? ['ignore', 'pipe', 'ignore'],
      env: process.env,
    }).trim();
  } catch {
    return '';
  }
}

/** 找到当前 node 配套的 npm（优先同目录，其次按 PATH 顺序），永不写死绝对路径 */
function detectNpm() {
  const nodeDir = path.dirname(process.execPath);
  const candidates = [
    path.join(nodeDir, 'npm'),
    ...String(process.env.PATH || '')
      .split(path.delimiter)
      .filter(Boolean)
      .map((d) => path.join(d, 'npm')),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return 'npm'; // 最后交给 PATH 解析
}

/** npm 全局安装根目录 */
function detectNpmRoot(npmBin) {
  if (!npmBin) return '';
  const out = safeExec(npmBin, ['root', '-g'], { timeout: 15000 });
  return out && fs.existsSync(out) ? out : out;
}

/** 已安装的 dsh 包目录 */
function detectDshPkgDir(npmRoot) {
  if (!npmRoot) return '';
  const p = path.join(npmRoot, PKG);
  return fs.existsSync(path.join(p, 'package.json')) ? p : '';
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** DSH 家目录：优先 DSH_HOME，否则 ~/.dsh */
function detectDshHome() {
  const fromEnv = process.env.DSH_HOME;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  return path.join(os.homedir(), '.dsh');
}

/** 当前运行的 profile 名：命令行 --profile → 唯一 profile 目录 → web */
function detectProfileName(dshHome) {
  const argv = process.argv || [];
  const i = argv.indexOf('--profile');
  if (i >= 0 && argv[i + 1]) return argv[i + 1];

  const env = process.env.DSH_PROFILE;
  if (env) return env;

  const profilesDir = path.join(dshHome, 'profiles');
  try {
    const dirs = fs
      .readdirSync(profilesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(profilesDir, d.name, 'package.json')))
      .map((d) => d.name);
    if (dirs.length === 1) return dirs[0];
    if (dirs.includes('web')) return 'web';
    if (dirs.length) return dirs[0];
  } catch {}
  return 'web';
}

/**
 * 通过 cgroup 反查当前进程所属的 systemd 单元。
 * 要点：
 *   - cgroup 路径里可能有多个 .service，必须取**最深**那个（最内层才是应用单元）
 *   - user@1000.service 这类是用户管理器本身，不是应用单元，要排除
 *   - 拿到候选后必须用 MainPID 校验"这个单元的主进程是不是我"，避免误重启别的服务
 */
function detectService() {
  const isUserManager = (u) => /^user@\d+\.service$/.test(u) || u === 'init.scope' || u === 'session.scope';

  try {
    const cg = fs.readFileSync('/proc/self/cgroup', 'utf8');
    const parts = cg
      .split(/[\n:]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((s) => s.split('/'))
      .map((s) => s.trim())
      .filter((s) => /\.(service|scope)$/.test(s));

    for (const unit of [...parts].reverse()) {
      if (!unit.endsWith('.service') || isUserManager(unit)) continue;

      const userPid = safeExec('systemctl', ['--user', 'show', unit, '-p', 'MainPID', '--value'], { timeout: 5000 });
      if (userPid && Number(userPid) === process.pid) return { mode: 'systemd-user', unit, source: 'cgroup+pid' };

      const sysPid = safeExec('systemctl', ['show', unit, '-p', 'MainPID', '--value'], { timeout: 5000 });
      if (sysPid && Number(sysPid) === process.pid) return { mode: 'systemd-system', unit, source: 'cgroup+pid' };
    }
  } catch {}

  // 2) 兜底：在用户级单元里找 MainPID 等于自己的那个
  try {
    const list = safeExec('systemctl', ['--user', 'list-units', '--type=service', '--no-legend', '--plain'], {
      timeout: 6000,
    });
    for (const line of list.split('\n')) {
      const unit = (line.trim().split(/\s+/)[0] || '').trim();
      if (!unit.endsWith('.service')) continue;
      const pid = safeExec('systemctl', ['--user', 'show', unit, '-p', 'MainPID', '--value'], { timeout: 5000 });
      if (pid && Number(pid) === process.pid) return { mode: 'systemd-user', unit, source: 'mainpid' };
    }
  } catch {}

  return { mode: 'unknown', unit: '', source: 'none' };
}

// 探测一次，缓存（进程内不变）
const ENV = (() => {
  const npm = detectNpm();
  const npmRoot = detectNpmRoot(npm);
  const dshPkgDir = detectDshPkgDir(npmRoot);
  const dshHome = detectDshHome();
  const profileName = detectProfileName(dshHome);
  const profileDir = path.join(dshHome, 'profiles', profileName);
  const service = detectService();
  const installed = dshPkgDir ? readJson(path.join(dshPkgDir, 'package.json')) : null;
  return {
    npm,
    npmRoot,
    dshPkgDir,
    installedVersion: installed?.version || '',
    dshHome,
    profileName,
    profileDir,
    profileExists: fs.existsSync(profileDir),
    service,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    pid: process.pid,
  };
})();

function resolveBackupDir(config) {
  const want = (config && config.backupDir) || '';
  const dir = want ? want : path.join(os.tmpdir(), 'dsh-upgrade-linux-backups');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return dir;
}

// ───────────────────────────────── 版本工具 ─────────────────────────────────

function parseVer(v) {
  if (!v) return null;
  const m = String(v).trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);
  if (!m) return null;
  return {
    major: +m[1],
    minor: +m[2],
    patch: +m[3],
    pre: m[4] ? m[4].split('.') : null,
  };
}

function cmp(a, b) {
  const pa = parseVer(a);
  const pb = parseVer(b);
  if (!pa || !pb) return String(a).localeCompare(String(b));
  for (const k of ['major', 'minor', 'patch']) {
    if (pa[k] !== pb[k]) return pa[k] - pb[k];
  }
  if (!pa.pre && !pb.pre) return 0;
  if (!pa.pre) return 1;
  if (!pb.pre) return -1;
  const n = Math.max(pa.pre.length, pb.pre.length);
  for (let i = 0; i < n; i++) {
    const x = pa.pre[i];
    const y = pb.pre[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      const d = Number(x) - Number(y);
      if (d) return d;
    } else if (nx !== ny) {
      return nx ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return 0;
}

/** 极简 semver range：支持 >=,>,<=,<,=,^,~ 与空格分隔的 AND */
function satisfies(version, range) {
  if (!range || !range.trim()) return null; // 未声明 → 未知
  const v = parseVer(version);
  if (!v) return null;
  const parts = String(range).trim().split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (part === '*' || part === 'x') continue;
    const m = part.match(/^(>=|<=|>|<|=|\^|~)?\s*v?(.+)$/);
    if (!m) return null;
    const op = m[1] || '=';
    const target = parseVer(m[2]);
    if (!target) return null;
    const c = cmp(version, m[2]);
    if (op === '=' && c !== 0) return false;
    if (op === '>' && c <= 0) return false;
    if (op === '>=' && c < 0) return false;
    if (op === '<' && c >= 0) return false;
    if (op === '<=' && c > 0) return false;
    if (op === '^' && (c < 0 || v.major !== target.major)) return false;
    if (op === '~' && (c < 0 || v.major !== target.major || v.minor !== target.minor)) return false;
  }
  return true;
}

// ───────────────────────────────── registry ─────────────────────────────────

let registryCache = { at: 0, data: null, source: '' };
const REGISTRY_TTL = 5 * 60 * 1000;

async function fetchRegistry(force) {
  if (!force && registryCache.data && Date.now() - registryCache.at < REGISTRY_TTL) return registryCache;
  const sources = ['https://registry.npmmirror.com', 'https://registry.npmjs.org'];
  let lastErr = null;
  for (const base of sources) {
    try {
      const res = await fetch(`${base}/${PKG}`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || !data['dist-tags']) throw new Error('no dist-tags');
      registryCache = { at: Date.now(), data, source: base };
      return registryCache;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('registry unreachable');
}

function buildInfo(reg, currentVersion) {
  const tags = reg?.data?.['dist-tags'] || {};
  const versions = reg?.data?.versions || {};
  const time = reg?.data?.time || {};
  const all = Object.keys(versions).sort((a, b) => cmp(b, a));

  const stableTip = tags.latest || null; // 默认（稳定）通道
  const nextTip = tags.next || null; // 预览通道
  const alphaTip = tags.alpha || null; // 尝鲜通道

  const isPre = (v) => !!v && /-/.test(v);
  const dateOf = (v) => (time[v] ? Date.parse(time[v]) : 0);
  const curDate = dateOf(currentVersion);
  const iso = (v) => (v && time[v] ? new Date(Date.parse(time[v])).toISOString() : '');

  // 唯一的通道定义：看这个版本由哪个 dist-tag 发布
  const tagChannel = (v) =>
    !v ? '' : v === stableTip ? 'stable' : v === nextTip ? 'next' : v === alphaTip ? 'alpha' : '';

  // 版本性质（与通道无关，只描述这个版本本身）
  const quality = (v) =>
    !isPre(v) ? '正式版' : /-rc\./.test(v) ? '候选版' : /-beta\./.test(v) ? 'Beta' : /-alpha\./.test(v) ? 'Alpha' : '预览版';

  let currentChannel = tagChannel(currentVersion);
  if (!currentChannel) {
    // 不在任何 tag 上：落后于默认版 → 按默认通道对待；比默认版还新 → 视为预览通道
    currentChannel = !stableTip || cmp(currentVersion, stableTip) <= 0 ? 'stable' : 'next';
  }
  const isStableUser = currentChannel === 'stable';

  const isNewer = (v) => {
    if (!v || v === currentVersion) return false;
    if (cmp(v, currentVersion) <= 0) return false;
    if (!curDate) return true;
    const d = dateOf(v);
    return d ? d > curDate : false;
  };

  let updateVersion = null;
  let updateChannel = null;
  let reason = '';

  if (isStableUser) {
    if (isNewer(stableTip)) {
      updateVersion = stableTip;
      updateChannel = 'stable';
      reason = `默认通道有新版本 ${stableTip}`;
    } else {
      reason = '已是最新（默认通道）';
    }
  } else {
    const pool = currentChannel === 'alpha' ? [stableTip, nextTip, alphaTip] : [stableTip, nextTip];
    const cands = pool.filter((v) => isNewer(v));
    if (cands.length) {
      cands.sort((a, b) => cmp(b, a));
      updateVersion = cands[0];
      updateChannel = tagChannel(updateVersion) || 'next';
      reason = `${updateChannel === 'alpha' ? '尝鲜' : updateChannel === 'next' ? '预览' : '默认'}通道有新版本 ${updateVersion}`;
    } else {
      reason = '已是最新';
    }
  }

  const hasUpdate = !!updateVersion;

  // 其他通道里比当前版本新的（不提醒，但面板会告知，便于手动切换）
  const others = [];
  for (const [ch, v] of [['stable', stableTip], ['next', nextTip], ['alpha', alphaTip]]) {
    if (!v || v === currentVersion || !isNewer(v)) continue;
    if (v === updateVersion) continue;
    if (isStableUser && ch !== 'stable') others.push({ channel: ch, version: v, date: iso(v) });
  }

  return {
    currentVersion,
    currentChannel,
    currentQuality: quality(currentVersion),
    currentDate: iso(currentVersion),
    latestVersion: stableTip || currentVersion,
    alphaVersion: alphaTip,
    nextVersion: nextTip,
    updateVersion,
    updateChannel,
    updateDate: iso(updateVersion),
    hasUpdate,
    hasAlphaUpdate: !isStableUser && !!alphaTip && alphaTip !== currentVersion && isNewer(alphaTip) && alphaTip !== updateVersion,
    hasAnyUpdate: hasUpdate,
    others,
    reason,
    source: reg?.source || '',
    checkedAt: reg?.at || 0,
    versions: all.slice(0, 40).map((v) => ({
      version: v,
      time: time[v] || '',
      tag: tagChannel(v),
      quality: quality(v),
      newer: isNewer(v),
    })),
  };
}

// ───────────────────────────────── 任务状态 ─────────────────────────────────

const task = {
  running: false,
  step: 'idle',
  targetVersion: null,
  fromVersion: null,
  backupPath: null,
  logs: [],
  error: null,
  restart: null,
  startedAt: 0,
  finishedAt: 0,
};

function log(msg) {
  const line = `[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}] ${msg}`;
  task.logs.push(line);
  if (task.logs.length > 400) task.logs.shift();
  try {
    console.log('[dsh-upgrade-linux]', msg);
  } catch {}
}

function backupProfile(config) {
  const dir = resolveBackupDir(config);
  const parent = path.dirname(ENV.profileDir);
  const base = path.basename(ENV.profileDir);
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const file = path.join(dir, `${base}-pre${(task.fromVersion || 'unknown').replace(/[^\w.-]/g, '')}-${stamp}.tgz`);

  if (!fs.existsSync(ENV.profileDir)) {
    log(`profile 目录不存在，跳过备份: ${ENV.profileDir}`);
    return null;
  }
  log(`备份 profile → ${file}`);
  try {
    const r = execFileSync('tar', ['-czf', file, '-C', parent, '--exclude=node_modules', '--exclude=.git', base], {
      timeout: 120000,
      stdio: 'ignore',
    });
    void r;
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    log(`备份完成（${(size / 1024 / 1024).toFixed(1)} MB）`);
    return file;
  } catch (e) {
    log(`备份失败: ${e.message}`);
    return null;
  }
}

function doRestart() {
  const svc = ENV.service;
  if (svc.mode === 'systemd-user' || svc.mode === 'systemd-system') {
    const userFlag = svc.mode === 'systemd-user' ? ['--user'] : [];
    log(`重启服务: systemctl ${userFlag.join(' ')} restart ${svc.unit}`);
    const child = spawn('systemctl', [...userFlag, 'restart', svc.unit], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.unref();
    return { mode: svc.mode, unit: svc.unit, ok: true };
  }
  log('未检测到 systemd 托管（可能是手动 nohup 启动），无法自动重启；进程将在 1s 后退出，请手动重新启动。');
  setTimeout(() => process.exit(0), 1000);
  return { mode: 'exit', unit: '', ok: false };
}

async function runUpgrade(target, config) {
  task.running = true;
  task.step = 'backing_up';
  task.error = null;
  task.logs = [];
  task.targetVersion = target;
  task.fromVersion = ENV.installedVersion || 'unknown';
  task.startedAt = Date.now();
  task.finishedAt = 0;

  try {
    if (!target || !/^\d+\.\d+\.\d+/.test(target)) throw new Error(`目标版本非法: ${target}`);
    if (target === task.fromVersion) throw new Error(`目标版本与当前版本相同: ${target}`);

    task.backupPath = backupProfile(config);

    task.step = 'installing';
    log(`使用 npm: ${ENV.npm}`);
    log(`全局前缀: ${ENV.npmRoot}`);
    log(`执行: ${ENV.npm} install -g ${PKG}@${target}`);

    const code = await new Promise((resolve) => {
      const child = spawn(ENV.npm, ['install', '-g', `${PKG}@${target}`], {
        // 关键：继承原环境，不重写 PATH（否则 npm 会落到系统前缀）
        env: process.env,
        cwd: os.homedir(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const onData = (buf) => {
        const text = String(buf).trim();
        if (text) for (const line of text.split('\n').slice(0, 12)) log(line.slice(0, 300));
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.on('error', (e) => {
        log(`npm 启动失败: ${e.message}`);
        resolve(-1);
      });
      child.on('close', resolve);
    });

    if (code !== 0) {
      task.step = 'error';
      task.error = `npm 安装失败，退出码 ${code}`;
      log('升级中止，保持原版本不变。');
      return;
    }

    const after = detectDshPkgDir(ENV.npmRoot);
    const installed = after ? readJson(path.join(after, 'package.json')) : null;
    if (installed?.version === target) {
      log(`安装成功，已就绪新版本 ${target}`);
    } else {
      log(`安装命令已结束，但磁盘上的版本是 ${installed?.version || '未知'}（可能是 npm 写到了别的前缀）`);
    }

    task.step = 'restarting';
    task.restart = doRestart();
    task.step = 'success';
    task.finishedAt = Date.now();
    log('升级流程完成。');
  } catch (e) {
    task.step = 'error';
    task.error = e.message;
    log(`升级失败: ${e.message}`);
  } finally {
    task.running = false;
    if (!task.finishedAt) task.finishedAt = Date.now();
  }
}

function checkCompatibility(target) {
  const pkgFile = path.join(ENV.profileDir, 'package.json');
  const pkg = readJson(pkgFile);
  if (!pkg || !pkg.dependencies) return { targetVersion: target, incompatible: [], checked: 0, items: [] };

  const items = [];
  for (const dep of Object.keys(pkg.dependencies)) {
    const depPkgFile = path.join(ENV.profileDir, 'node_modules', dep, 'package.json');
    const depPkg = readJson(depPkgFile);
    if (!depPkg) {
      items.push({ name: dep, installed: '', requires: '', compatible: null, reason: '未安装' });
      continue;
    }
    const requires =
      depPkg?.dsh?.engines?.dsh || depPkg?.engines?.dsh || depPkg?.dsh?.engine?.dsh || '';
    const ok = satisfies(target, requires);
    items.push({
      name: depPkg.name || dep,
      installed: depPkg.version || '',
      requires: requires || '',
      compatible: ok,
      reason: ok === null ? '未声明版本要求' : ok ? '' : `要求 ${requires}，目标 ${target}`,
    });
  }
  return {
    targetVersion: target,
    checked: items.length,
    incompatible: items.filter((i) => i.compatible === false).map((i) => i.name),
    items,
  };
}

// ───────────────────────────────── HTTP ─────────────────────────────────

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

export function apply(ctx, config = {}) {
  ctx.webServer.register({
    kind: 'prefix',
    path: PREFIX,
    handler: async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname;
      const sub = p.startsWith(PREFIX) ? p.slice(PREFIX.length) || '/' : '';

      try {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

        // 环境自检：用来验证"零硬编码"是否探测正确
        if (req.method === 'GET' && sub === '/env') {
          json(res, 200, {
            ok: true,
            ...ENV,
            backupDir: resolveBackupDir(config),
            home: os.homedir(),
            tmpdir: os.tmpdir(),
          });
          return;
        }

        if (req.method === 'GET' && (sub === '/info' || sub === '/')) {
          const current = ENV.installedVersion || '0.0.0';
          let info;
          try {
            const reg = await fetchRegistry(url.searchParams.get('refresh') === 'true');
            info = buildInfo(reg, current);
          } catch (e) {
            info = {
              currentVersion: current,
              latestVersion: current,
              alphaVersion: null,
              nextVersion: null,
              hasUpdate: false,
              hasAlphaUpdate: false,
              hasAnyUpdate: false,
              versions: [],
              error: `查询失败: ${e.message}`,
            };
          }
          json(res, 200, { ok: true, ...info, env: ENV });
          return;
        }

        if (req.method === 'GET' && sub === '/compatibility') {
          const target = url.searchParams.get('target') || ENV.installedVersion;
          json(res, 200, { ok: true, ...checkCompatibility(target) });
          return;
        }

        if (req.method === 'GET' && sub === '/status') {
          json(res, 200, { ok: true, ...task });
          return;
        }

        if (req.method === 'GET' && sub === '/ping') {
          json(res, 200, { ok: true, version: ENV.installedVersion, pid: process.pid, uptime: process.uptime() });
          return;
        }

        if (req.method === 'POST' && sub === '/upgrade') {
          if (task.running) {
            json(res, 409, { ok: false, error: '已有升级任务在进行中' });
            return;
          }
          let body = {};
          try {
            let raw = '';
            for await (const chunk of req) raw += chunk;
            body = raw ? JSON.parse(raw) : {};
          } catch {}
          const target = String(body.target || url.searchParams.get('target') || '').trim();
          if (!target) {
            json(res, 400, { ok: false, error: '缺少 target 版本号' });
            return;
          }
          runUpgrade(target, config); // 异步
          json(res, 200, { ok: true, message: `已开始升级到 ${target}`, target });
          return;
        }

        if (req.method === 'POST' && sub === '/restart') {
          if (task.running) {
            json(res, 409, { ok: false, error: '升级进行中，请稍候' });
            return;
          }
          const r = doRestart();
          json(res, 200, { ok: true, ...r });
          return;
        }

        json(res, 404, { ok: false, error: 'Not found', path: p });
      } catch (e) {
        json(res, 500, { ok: false, error: e.message });
      }
    },
  });
}
