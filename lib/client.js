window.__ModuleLoader__.load({
  id: 'dsh-upgrade-linux',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    const { jsx, jsxs, Fragment } = require('react/jsx-runtime');
    const { useState, useEffect, useRef, useCallback } = require('react');
    const { createPortal } = require('react-dom');

    const API = '/api/dsh-upgrade-lx';
    const STYLE_ID = 'dsh-upgrade-linux-styles';
    const GREEN = '#22c55e';
    const BLUE = '#60a5fa';

    if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        :root{--dul-green:#22c55e;--dul-green-soft:rgba(34,197,94,.14);--dul-blue:#60a5fa;--dul-blue-soft:rgba(96,165,250,.16)}

        /* ---------- 侧栏入口 ---------- */
        .dul-entry{position:relative;display:inline-flex;align-items:center;gap:6px;width:auto;height:32px;margin:0;padding:5px 10px;box-sizing:border-box;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,#f1eff6);font-size:14px;font-weight:400;line-height:1;cursor:pointer;text-align:left;transition:background .15s}
        .dul-entry:hover{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.08))}
        .dul-entry.upd svg{color:var(--dul-green)}
        .dul-entry.upd:hover{background:rgba(34,197,94,.12)}
        .dul-entry.rail{width:34px;height:34px;justify-content:center;padding:0;margin:4px auto}
        .dul-entry .dul-label{flex:0 0 auto}
        .dul-entry .dul-pill{margin-left:auto;display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:500;padding:2px 7px;border-radius:99px;background:var(--dul-green-soft);color:var(--dul-green)}
        .dul-entry .dul-inline-dot{width:7px;height:7px;border-radius:50%;background:var(--dul-green);margin-left:2px;flex:0 0 auto;animation:dul-pulse 2s infinite}
        .dul-glow{width:8px;height:8px;border-radius:50%;background:var(--dul-green);box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:dul-pulse 2s infinite}
        @keyframes dul-pulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 7px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
        .dul-dot-corner{position:absolute;top:6px;right:6px}

        /* ---------- 弹窗骨架 ---------- */
        .dul-mask{position:fixed;inset:0;z-index:9999;background:rgba(8,8,10,.62);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px}
        .dul-modal{width:min(620px,94vw);max-height:88vh;display:flex;flex-direction:column;border-radius:18px;background:var(--dsw-alias-bg-layer-1,#1b1a1f);color:var(--dsw-alias-label-primary,#f2f0f7);box-shadow:0 28px 90px rgba(0,0,0,.55);border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));overflow:hidden}
        .dul-head{display:flex;align-items:center;gap:10px;padding:18px 20px 14px}
        .dul-title{font-size:15.5px;font-weight:650;letter-spacing:.2px}
        .dul-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8b8992);padding:1px 7px;border-radius:6px;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.06))}
        .dul-close{margin-left:auto;width:26px;height:26px;border:none;border-radius:8px;background:transparent;color:inherit;font-size:17px;line-height:1;cursor:pointer;opacity:.55}
        .dul-close:hover{opacity:1;background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.08))}
        .dul-scroll{padding:0 20px 20px;overflow:auto}

        /* ---------- 状态横幅 ---------- */
        .dul-banner{border-radius:14px;padding:16px 18px;display:flex;align-items:center;gap:14px;border:1px solid transparent}
        .dul-banner.upd{background:linear-gradient(135deg,rgba(34,197,94,.16),rgba(34,197,94,.05));border-color:rgba(34,197,94,.32)}
        .dul-banner.ok{background:var(--dsw-alias-bg-layer-2,rgba(255,255,255,.05));border-color:var(--dsw-alias-border-l2,rgba(255,255,255,.09))}
        .dul-banner.warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.3)}
        .dul-banner-ico{width:38px;height:38px;flex:0 0 auto;border-radius:12px;display:flex;align-items:center;justify-content:center}
        .dul-banner.upd .dul-banner-ico{background:rgba(34,197,94,.2);color:var(--dul-green)}
        .dul-banner.ok .dul-banner-ico{background:var(--dsw-alias-bg-layer-3,rgba(255,255,255,.08));color:var(--dsw-alias-label-secondary,#a9a7b0)}
        .dul-banner.warn .dul-banner-ico{background:rgba(245,158,11,.18);color:#f59e0b}
        .dul-banner-main{min-width:0;flex:1}
        .dul-banner-t{font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
        .dul-banner-d{font-size:12px;color:var(--dsw-alias-label-secondary,#a9a7b0);margin-top:3px;line-height:1.5}
        .dul-ver{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
        .dul-arrow{opacity:.5;margin:0 5px}

        /* ---------- 按钮 ---------- */
        .dul-btn{border:none;border-radius:10px;padding:9px 16px;font-size:13px;font-weight:550;cursor:pointer;transition:transform .1s,opacity .15s;white-space:nowrap}
        .dul-btn:active{transform:scale(.975)}
        .dul-btn:disabled{opacity:.4;cursor:not-allowed}
        .dul-btn.primary{background:var(--dul-green);color:#062d13}
        .dul-btn.primary:hover:not(:disabled){filter:brightness(1.06)}
        .dul-btn.ghost{background:rgba(255,255,255,.085);border:1px solid rgba(255,255,255,.06);color:var(--dsw-alias-label-primary,#e8e8ea)}
        .dul-btn.ghost:hover:not(:disabled){background:rgba(255,255,255,.14)}
        .dul-btn.sm{padding:5px 11px;font-size:12px;border-radius:8px}
        .dul-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center}

        /* ---------- 信息行 ---------- */
        .dul-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 18px;margin-top:16px}
        .dul-item{display:flex;align-items:baseline;gap:8px;padding:6px 0;font-size:12.5px;min-width:0}
        .dul-k{color:var(--dsw-alias-label-tertiary,#8b8992);white-space:nowrap}
        .dul-v{font-family:ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .dul-chip{font-size:10.5px;padding:1.5px 7px;border-radius:5px;background:rgba(255,255,255,.09);color:var(--dsw-alias-label-secondary,#a9a7b0);font-family:inherit}
        .dul-chip.green{background:var(--dul-green-soft);color:var(--dul-green)}
        .dul-chip.blue{background:var(--dul-blue-soft);color:var(--dul-blue)}

        /* ---------- 进度 ---------- */
        .dul-steps{display:flex;align-items:center;gap:6px;margin-top:14px}
        .dul-step{flex:1;height:4px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}
        .dul-step i{display:block;height:100%;width:0;background:var(--dul-green);transition:width .4s ease}
        .dul-step.active i,.dul-step.done i{width:100%}
        .dul-step.active i{animation:dul-shift 1.1s infinite linear;background:linear-gradient(90deg,transparent,var(--dul-green),transparent);background-size:200% 100%}
        @keyframes dul-shift{0%{background-position:100% 0}100%{background-position:-100% 0}}
        .dul-steplabels{display:flex;justify-content:space-between;font-size:11px;color:var(--dsw-alias-label-tertiary,#8b8992);margin-top:6px}

        /* ---------- 折叠区 ---------- */
        .dul-fold{margin-top:16px;border-top:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.08));padding-top:2px}
        .dul-fold-h{display:flex;align-items:center;gap:6px;width:100%;padding:9px 0;border:none;background:transparent;color:var(--dsw-alias-label-secondary,#a9a7b0);font-size:12.5px;cursor:pointer}
        .dul-fold-h:hover{color:var(--dsw-alias-label-primary,#e8e8ea)}
        .dul-caret{transition:transform .18s;font-size:10px;opacity:.7}
        .dul-caret.open{transform:rotate(90deg)}
        .dul-log{margin-top:8px;background:rgba(0,0,0,.42);border-radius:10px;padding:11px 12px;font-family:ui-monospace,Menlo,monospace;font-size:11.5px;line-height:1.6;max-height:200px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:#c9c7d2}
        .dul-list{margin-top:6px}
        .dul-row{display:flex;align-items:center;gap:8px;padding:7px 2px;font-size:12.5px;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.05))}
        .dul-row:last-child{border-bottom:none}
        .dul-row .dul-ver{width:104px;flex:0 0 auto}
        .dul-row .dul-grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,#8b8992);font-size:11.5px}
        .dul-note{font-size:11px;color:var(--dsw-alias-label-tertiary,#8b8992);line-height:1.65;margin-top:14px}
        .dul-err{color:#f87171}
        .dul-ok{color:var(--dul-green)}
      `;
      document.head.appendChild(style);
    }

    // ───────────────────────── 图标 ─────────────────────────
    // 侧栏用：圆圈上行箭头，stroke 1.3 与原生导航图标一致
    const IconUp = ({ size = 16, sw = 1.3 }) =>
      jsx('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round',
        children: [
          jsx('circle', { cx: 12, cy: 12, r: 9 }),
          jsx('path', { d: 'M12 16.5V7.5' }),
          jsx('path', { d: 'm8.7 10.8 3.3-3.3 3.3 3.3' }),
        ],
      });
    // 横幅用：粗一点的实心箭头
    const IconArrowUp = ({ size = 18 }) =>
      jsx('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        children: [jsx('path', { d: 'M12 19V5' }), jsx('path', { d: 'm6 11 6-6 6 6' })],
      });
    const IconCheck = ({ size = 18 }) =>
      jsx('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round',
        children: jsx('path', { d: 'M20 6 9 17l-5-5' }),
      });
    const IconWarn = ({ size = 18 }) =>
      jsx('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round',
        children: [jsx('path', { d: 'M12 9v4' }), jsx('path', { d: 'M12 17h.01' }), jsx('circle', { cx: 12, cy: 12, r: 9 })],
      });

    const fmtDate = (iso) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d)) return '';
      const p = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    const chLabel = (c) =>
      c === 'stable' ? '稳定通道' : c === 'next' ? '预览通道' : c === 'alpha' ? '尝鲜通道' : '历史版本';

    const KindChip = ({ c }) =>
      jsx('span', {
        className: 'dul-chip' + (c === 'stable' ? ' green' : /alpha|next|preview/.test(c || '') ? ' blue' : ''),
        children: chLabel(c),
      });

    // ───────────────────────── 折叠区 ─────────────────────────
    function Fold({ title, children, defaultOpen = false }) {
      const [open, setOpen] = useState(defaultOpen);
      return jsxs('div', {
        className: 'dul-fold',
        children: [
          jsxs('button', {
            className: 'dul-fold-h',
            onClick: () => setOpen(!open),
            children: [
              jsx('span', { className: 'dul-caret' + (open ? ' open' : ''), children: '▶' }),
              jsx('span', { children: title }),
            ],
          }),
          open ? jsx('div', { children }) : null,
        ],
      });
    }

    // ───────────────────────── 主弹窗 ─────────────────────────
    function Modal({ onClose, onBadge }) {
      const [info, setInfo] = useState(null);
      const [env, setEnv] = useState(null);
      const [status, setStatus] = useState(null);
      const [busy, setBusy] = useState(false);
      const [err, setErr] = useState('');
      const [note, setNote] = useState('');
      const timer = useRef(null);
      const lostCount = useRef(0);

      const loadInfo = useCallback(async (force) => {
        try {
          const d = await (await fetch(`${API}/info${force ? '?refresh=true' : ''}`, { cache: 'no-store' })).json();
          setInfo(d);
          onBadge && onBadge(!!d.hasUpdate);
        } catch (e) {
          setErr(String(e.message || e));
        }
      }, [onBadge]);

      const applyStatus = useCallback((s) => {
        setStatus(s);
        if (s && !s.running && s.step === 'success') {
          setTimeout(() => loadInfo(true), 800);
        }
      }, [loadInfo]);

      // 轮询任务状态；服务重启时会连续失败，切换成 ping 探测，恢复后自动刷新
      const startPoll = useCallback(() => {
        if (timer.current) clearInterval(timer.current);
        lostCount.current = 0;
        timer.current = setInterval(async () => {
          try {
            const s = await (await fetch(`${API}/status`, { cache: 'no-store' })).json();
            lostCount.current = 0;
            applyStatus(s);
            if (!s.running) {
              clearInterval(timer.current);
              timer.current = null;
            }
          } catch {
            lostCount.current += 1;
            if (lostCount.current >= 2) {
              clearInterval(timer.current);
              timer.current = setInterval(async () => {
                try {
                  const r = await fetch(`${API}/ping`, { cache: 'no-store' });
                  if (r.ok) {
                    clearInterval(timer.current);
                    timer.current = null;
                    setNote('服务已恢复，正在刷新…');
                    setTimeout(() => location.reload(), 700);
                  }
                } catch {}
              }, 2000);
            }
          }
        }, 1000);
      }, [applyStatus]);

      useEffect(() => {
        loadInfo(false);
        fetch(`${API}/env`).then((r) => r.json()).then(setEnv).catch(() => {});
        fetch(`${API}/status`).then((r) => r.json()).then((s) => {
          applyStatus(s);
          if (s.running) startPoll();
        }).catch(() => {});
        return () => timer.current && clearInterval(timer.current);
      }, [applyStatus, loadInfo, startPoll]);

      const upgrade = async (target) => {
        if (!target || busy || (status && status.running)) return;
        setBusy(true); setErr(''); setNote('');
        try {
          const r = await fetch(`${API}/upgrade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target }),
          });
          const d = await r.json();
          if (!d.ok) setErr(d.error || '启动失败');
          else startPoll();
        } catch (e) {
          setErr(String(e.message || e));
        } finally {
          setBusy(false);
        }
      };

      const restart = async () => {
        if (status && status.running) return;
        setNote('重启指令已发出，等待服务恢复…');
        try {
          await fetch(`${API}/restart`, { method: 'POST' });
          const t = setInterval(async () => {
            try {
              const r = await fetch(`${API}/ping`, { cache: 'no-store' });
              if (r.ok) { clearInterval(t); setNote('服务已恢复，正在刷新…'); setTimeout(() => location.reload(), 700); }
            } catch {}
          }, 2000);
        } catch (e) {
          setErr(String(e.message || e));
        }
      };

      const info2 = info || {};
      const cur = info2.currentVersion || '—';
      const upd = info2.updateVersion;
      const running = !!(status && status.running);
      const step = status?.step || 'idle';
      const logs = (status?.logs || []).join('\n');

      const STEP_ORDER = ['backing_up', 'installing', 'restarting'];
      const stepIdx = STEP_ORDER.indexOf(step);
      const stepState = (i) => (step === 'success' ? 'done' : i < stepIdx ? 'done' : i === stepIdx ? 'active' : '');

      // —— 横幅 ——
      let banner;
      if (running) {
        const txt =
          step === 'backing_up' ? '正在备份 profile…'
          : step === 'installing' ? '正在安装新版本…'
          : step === 'restarting' ? '正在重启服务…' : '处理中…';
        banner = jsxs('div', {
          className: 'dul-banner upd',
          children: [
            jsx('div', { className: 'dul-banner-ico', children: jsx(IconArrowUp, { size: 18 }) }),
            jsxs('div', {
              className: 'dul-banner-main',
              children: [
                jsx('div', { className: 'dul-banner-t', children: txt }),
                jsx('div', { className: 'dul-banner-d', children: `目标版本 ${status.targetVersion || '—'}` }),
              ],
            }),
          ],
        });
      } else if (step === 'success') {
        banner = jsxs('div', {
          className: 'dul-banner upd',
          children: [
            jsx('div', { className: 'dul-banner-ico', children: jsx(IconCheck, {}) }),
            jsxs('div', {
              className: 'dul-banner-main',
              children: [
                jsx('div', { className: 'dul-banner-t', children: '升级完成' }),
                jsx('div', { className: 'dul-banner-d', children: `已安装 ${status.targetVersion || ''}${status.restart && status.restart.ok ? '，服务已重启' : '，请手动重启服务'}` }),
              ],
            }),
          ],
        });
      } else if (step === 'error') {
        banner = jsxs('div', {
          className: 'dul-banner warn',
          children: [
            jsx('div', { className: 'dul-banner-ico', children: jsx(IconWarn, {}) }),
            jsxs('div', {
              className: 'dul-banner-main',
              children: [
                jsx('div', { className: 'dul-banner-t', children: '升级失败' }),
                jsx('div', { className: 'dul-banner-d dul-err', children: status.error || '未知错误' }),
              ],
            }),
          ],
        });
      } else if (info2.hasUpdate) {
        banner = jsxs('div', {
          className: 'dul-banner upd',
          children: [
            jsx('div', { className: 'dul-banner-ico', children: jsx(IconArrowUp, { size: 18 }) }),
            jsxs('div', {
              className: 'dul-banner-main',
              children: [
                jsxs('div', {
                  className: 'dul-banner-t',
                  children: [
                    jsx('span', { className: 'dul-glow' }),
                    jsx('span', { children: '有新版本可用' }),
                    jsx(KindChip, { c: info2.updateChannel }),
                  ],
                }),
                jsxs('div', {
                  className: 'dul-banner-d',
                  children: [
                    jsx('span', { className: 'dul-ver', children: cur }),
                    jsx('span', { className: 'dul-arrow', children: '→' }),
                    jsx('span', { className: 'dul-ver', style: { color: GREEN }, children: upd }),
                    jsx('span', { style: { marginLeft: 8, opacity: .75 }, children: info2.updateDate ? `${fmtDate(info2.updateDate)} 发布` : '' }),
                  ],
                }),
              ],
            }),
            upd
              ? jsx('button', {
                  className: 'dul-btn primary',
                  disabled: busy || running,
                  onClick: () => upgrade(upd),
                  children: '立即升级',
                })
              : null,
          ],
        });
      } else {
        banner = jsxs('div', {
          className: 'dul-banner ok',
          children: [
            jsx('div', { className: 'dul-banner-ico', children: jsx(IconCheck, {}) }),
            jsxs('div', {
              className: 'dul-banner-main',
              children: [
                jsx('div', { className: 'dul-banner-t', children: '已是最新版本' }),
                jsx('div', { className: 'dul-banner-d', children: info2.reason || '' }),
              ],
            }),
          ],
        });
      }

      return createPortal(
        jsx('div', {
          className: 'dul-mask',
          onMouseDown: (e) => e.target === e.currentTarget && onClose(),
          children: jsxs('div', {
            className: 'dul-modal',
            children: [
              jsxs('div', {
                className: 'dul-head',
                children: [
                  jsx('span', { className: 'dul-title', children: '版本升级' }),
                  jsx('span', { className: 'dul-sub', children: 'Linux / systemd' }),
                  jsx('button', { className: 'dul-close', onClick: onClose, children: '×' }),
                ],
              }),
              jsxs('div', {
                className: 'dul-scroll',
                children: [
                  banner,

                  running || step === 'success'
                    ? jsxs('div', {
                        children: [
                          jsxs('div', {
                            className: 'dul-steps',
                            children: STEP_ORDER.map((s, i) => jsx('div', { className: 'dul-step ' + stepState(i), children: jsx('i', {}) }, s)),
                          }),
                          jsxs('div', {
                            className: 'dul-steplabels',
                            children: [
                              jsx('span', { children: '备份' }),
                              jsx('span', { children: '安装' }),
                              jsx('span', { children: '重启' }),
                            ],
                          }),
                        ],
                      })
                    : null,

                  jsxs('div', {
                    className: 'dul-actions',
                    children: [
                      jsx('button', {
                        className: 'dul-btn ghost sm',
                        onClick: () => loadInfo(true),
                        disabled: running,
                        children: '重新检查',
                      }),
                      jsx('button', {
                        className: 'dul-btn ghost sm',
                        onClick: restart,
                        disabled: running,
                        children: '重启服务',
                      }),
                      info2.hasAlphaUpdate && !running
                        ? jsx('button', {
                            className: 'dul-btn ghost sm',
                            disabled: busy,
                            onClick: () => upgrade(info2.alphaVersion),
                            children: `升到尝鲜版 ${info2.alphaVersion}`,
                          })
                        : null,
                    ],
                  }),

                  err ? jsx('div', { className: 'dul-note dul-err', children: err }) : null,
                  note ? jsx('div', { className: 'dul-note', children: note }) : null,

                  jsxs('div', {
                    className: 'dul-grid',
                    children: [
                      jsxs('div', { className: 'dul-item', children: [jsx('span', { className: 'dul-k', children: '当前版本' }), jsx('span', { className: 'dul-v', children: cur })] }),
                      jsxs('div', { className: 'dul-item', children: [jsx('span', { className: 'dul-k', children: '当前通道' }), jsx(KindChip, { c: info2.currentChannel }), info2.currentQuality ? jsx('span', { className: 'dul-chip', children: info2.currentQuality }) : null] }),
                      jsxs('div', { className: 'dul-item', children: [jsx('span', { className: 'dul-k', children: '发布时间' }), jsx('span', { className: 'dul-v', children: fmtDate(info2.currentDate) || '—' })] }),
                      jsxs('div', { className: 'dul-item', children: [jsx('span', { className: 'dul-k', children: '稳定通道最新' }), jsx('span', { className: 'dul-v', children: info2.latestVersion || '—' })] }),
                    ],
                  }),

                  running || step === 'success' || step === 'error'
                    ? jsx(Fold, {
                        title: '升级日志',
                        defaultOpen: running,
                        children: jsx('div', { className: 'dul-log', children: logs || '（暂无输出）' }),
                      })
                    : null,

                  info2.others && info2.others.length
                    ? jsxs('div', {
                        className: 'dul-note',
                        style: { marginTop: 10 },
                        children: [
                          '其他通道有更新版本：',
                          ...info2.others.map((o) =>
                            jsxs('span', {
                              style: { display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 14 },
                              children: [
                                jsx(KindChip, { c: o.channel }),
                                jsx('span', { className: 'dul-ver', children: o.version }),
                                jsx('span', { style: { opacity: .7 }, children: fmtDate(o.date) }),
                              ],
                            }, o.version)
                          ),
                          jsx('span', { style: { opacity: .65 }, children: '（不提醒；装过即自动切换到该通道）' }),
                        ],
                      })
                    : null,

                  jsx(Fold, {
                    title: `历史版本${info2.versions ? `（${info2.versions.length}）` : ''}`,
                    children: jsx('div', {
                      className: 'dul-list',
                      children: (info2.versions || []).slice(0, 14).map((v) =>
                        jsxs('div', {
                          className: 'dul-row',
                          children: [
                            jsx('span', { className: 'dul-ver', children: v.version }),
                            jsx(KindChip, { c: v.tag || 'history' }),
                            v.version === cur
                              ? jsx('span', { className: 'dul-chip green', children: '当前' })
                              : v.version === info2.updateVersion
                                ? jsx('span', { className: 'dul-chip green', children: '推荐' })
                                : null,
                            jsx('span', { className: 'dul-grow', children: fmtDate(v.time) }),
                            v.version === cur
                              ? null
                              : jsx('button', {
                                  className: 'dul-btn ghost sm',
                                  disabled: busy || running,
                                  onClick: () => upgrade(v.version),
                                  children: '安装',
                                }),
                          ],
                        }, v.version)
                      ),
                    }),
                  }),

                  jsx(Fold, {
                    title: '环境信息',
                    children: jsx('div', {
                      className: 'dul-grid',
                      style: { gridTemplateColumns: '1fr', marginTop: 4 },
                      children: [
                        env ? jsxs('div', { children: [
                          jsxs('div', { className: 'dul-item', children: [jsx('span', { className: 'dul-k', children: 'npm' }), jsx('span', { className: 'dul-v', children: env.npm })] }),
                          jsxs('div', { className: 'dul-item', children: [jsx('span', { className: 'dul-k', children: '全局前缀' }), jsx('span', { className: 'dul-v', children: env.npmRoot })] }),
                          jsxs('div', { className: 'dul-item', children: [jsx('span', { className: 'dul-k', children: 'profile' }), jsx('span', { className: 'dul-v', children: env.profileDir })] }),
                          jsxs('div', { className: 'dul-item', children: [jsx('span', { className: 'dul-k', children: '重启方式' }), jsx('span', { className: 'dul-v', children: env.service?.unit ? `systemctl --user restart ${env.service.unit}` : '未检测到 systemd' })] }),
                          jsxs('div', { className: 'dul-item', children: [jsx('span', { className: 'dul-k', children: '备份目录' }), jsx('span', { className: 'dul-v', children: env.backupDir })] }),
                        ] }) : null,
                      ],
                    }),
                  }),

                  jsx('div', {
                    className: 'dul-note',
                    children: '通道以 dist-tag 为准：latest=稳定通道，next=预览通道，alpha=尝鲜通道。稳定通道只比稳定通道；预览/尝鲜通道会比本通道与稳定通道，且要求发布时间更晚。',
                  }),
                ],
              }),
            ],
          }),
        }),
        document.body
      );
    }

    // ───────────────────────── 侧栏入口 ─────────────────────────
    function Entry({ wide }) {
      const [open, setOpen] = useState(false);
      const [hasUpd, setHasUpd] = useState(false);
      const [ver, setVer] = useState('');

      const check = () =>
        fetch(`${API}/info`, { cache: 'no-store' })
          .then((r) => r.json())
          .then((d) => {
            setHasUpd(!!d.hasUpdate);
            setVer(d.updateVersion || '');
          })
          .catch(() => {});

      useEffect(() => {
        check();
        const t = setInterval(check, 30 * 60 * 1000); // 每 30 分钟复查
        return () => clearInterval(t);
      }, []);

      return jsxs('div', {
        style: { width: '100%', display: 'flex', justifyContent: 'flex-end' },
        children: [
          jsxs('button', {
            className: 'dul-entry' + (wide ? '' : ' rail') + (hasUpd ? ' upd' : ''),
            onClick: () => setOpen(true),
            title: hasUpd ? `有新版本 ${ver}` : '检查 DSH 更新',
            children: [
              jsx(IconUp, { size: wide ? 16 : 18 }),
              wide ? jsx('span', { className: 'dul-label', children: '检查更新' }) : null,
            ],
          }),
          open ? jsx(Modal, { onClose: () => setOpen(false), onBadge: setHasUpd }) : null,
        ],
      });
    }

    exports.inject = ['slots'];
    exports.apply = function (ctx) {
      try {
        ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register({ name: 'sidebar.footer.action', id: 'dsh-upgrade-linux', order: 49 }, Entry)
        );
      } catch (e) {
        console.warn('[dsh-upgrade-linux] register failed', e);
      }
    };

    return exports;
  },
});
