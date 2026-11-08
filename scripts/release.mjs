#!/usr/bin/env node
/**
 * release.mjs — 一条命令完成「发版 + 更新插件市场索引 + 推送」
 *
 * 用法：
 *   node scripts/release.mjs 0.1.1          发新版本
 *   node scripts/release.mjs                只把当前版本重新 pin 到最新 commit
 *   node scripts/release.mjs 0.1.1 --dry-run  只打印计划，不写任何文件
 *   node scripts/release.mjs 0.1.1 --no-push  提交本地，不推送
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = path.join(repoRoot, 'package.json')
const indexPath = path.join(repoRoot, 'index.json')

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const positional = argv.filter((a) => !a.startsWith('--'))
const dryRun = flags.has('--dry-run')
const noPush = flags.has('--no-push')
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

const log = (m) => console.log(m)
const step = (n, m) => console.log(`\n[${n}] ${m}`)
const fail = (m) => {
  console.error(`\n✗ ${m}`)
  process.exit(1)
}

function git(...args) {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' }).trim()
}
function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}
function writeJson(p, value) {
  fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function findValidator() {
  const dshHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  const profiles = path.join(dshHome, 'profiles')
  if (!fs.existsSync(profiles)) return null
  for (const name of fs.readdirSync(profiles)) {
    const candidate = path.join(profiles, name, 'node_modules', '@deepseek-ai', 'dsh-plugin-market-index', 'lib', 'index.js')
    if (fs.existsSync(candidate)) return candidate
  }
  return null
}

async function main() {
  const pkg = readJson(pkgPath)
  const requested = positional[0]
  if (requested !== undefined && !SEMVER.test(requested)) fail(`版本号格式不对: ${requested}`)
  const version = requested ?? pkg.version

  step(0, '检查工作区')
  log(`  仓库    : ${repoRoot}`)
  log(`  目标版本: ${version}${requested ? '（写入 package.json）' : '（沿用当前版本，仅重新 pin）'}`)
  const dirty = git('status', '--porcelain')
  if (dirty) {
    if (dryRun) log(`  ⚠ 工作区有未提交改动，真实运行会中止:\n${dirty}`)
    else fail(`工作区有未提交的改动，先提交或 stash：\n${dirty}`)
  } else log('  工作区干净')

  step(1, '更新 package.json 版本号')
  if (requested && requested !== pkg.version) {
    const text = fs.readFileSync(pkgPath, 'utf8')
    const next = text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`)
    if (next === text) fail('package.json 里没找到 version 字段')
    if (dryRun) log(`  (dry-run) 将把 ${pkg.version} 改为 ${version}`)
    else {
      fs.writeFileSync(pkgPath, next, 'utf8')
      log(`  ${pkg.version} → ${version}`)
    }
  } else log(`  版本号不变（${pkg.version}）`)

  step(2, '提交代码')
  let sha
  if (dryRun) {
    sha = git('rev-parse', 'HEAD')
    log(`  (dry-run) 真实运行会提交并用新 commit；此处预览用当前 HEAD ${sha.slice(0, 7)}`)
  } else {
    if (git('status', '--porcelain')) {
      git('add', '-A')
      git('commit', '-m', `release v${version}`)
      log('  已提交')
    } else log('  没有需要提交的改动')
    sha = git('rev-parse', 'HEAD')
  }

  step(3, '核实 pin 的 commit')
  let atSha
  if (!dryRun) {
    atSha = JSON.parse(git('show', `${sha}:package.json`))
    if (atSha.version !== version) fail(`commit ${sha.slice(0, 7)} 里的版本是 ${atSha.version}，与目标 ${version} 不一致`)
    log(`  ${sha.slice(0, 7)} 的 package.json version = ${atSha.version}`)
  } else {
    atSha = pkg
    log('  (dry-run) 跳过（提交后才会真正变化）')
  }

  step(4, '更新 index.json')
  if (!fs.existsSync(indexPath)) fail('找不到 index.json')
  const index = readJson(indexPath)
  const plugin = index.plugins?.[0]
  if (!plugin) fail('index.json 里没有 plugins')
  const base = plugin.versions?.[0]
  const sourceUrl = base?.source?.url?.replace(/\.git$/, '') ?? 'https://github.com/zelinwang/dsh-upgrade-linux'
  if (base?.source?.type !== 'git') fail('index.json 的首个版本不是 git 源，先手动确认')
  const enginesDsh = atSha.engines?.dsh
  const entry = { version, publishTimestamp: Number(git('log', '-1', '--format=%ct', sha)), source: { type: 'git', url: sourceUrl, commit: sha } }
  if (enginesDsh) entry.engines = { dsh: enginesDsh }

  const versions = plugin.versions ?? []
  const at = versions.findIndex((v) => v.version === version)
  if (at >= 0) {
    versions[at] = { ...versions[at], ...entry }
    log(`  更新已有版本 ${version}`)
  } else {
    versions.unshift(entry)
    log(`  新增版本 ${version}`)
  }
  plugin.versions = versions
  if (dryRun) log(`  (dry-run) 该版本条目将是:\n${JSON.stringify(entry, null, 2).replace(/^/gm, '    ')}`)
  else {
    writeJson(indexPath, index)
    log('  index.json 已写入')
  }

  step(5, '官方校验器校验')
  const validatorPath = findValidator()
  if (!validatorPath) {
    log('  ⚠ 未找到 @deepseek-ai/dsh-plugin-market-index，跳过校验')
    log('    （在装有 DSH 的机器上运行会自动找到）')
  } else {
    try {
      const { parseMarketIndex, marketInstallTarget } = await import(pathToFileURL(validatorPath).href)
      const parsed = parseMarketIndex(index, 'https://cdn.jsdelivr.net/gh/zelinwang/dsh-upgrade-linux@main/index.json')
      const p = parsed.plugins.find((x) => x.name === plugin.name) ?? parsed.plugins[0]
      const v = p.versions.find((x) => x.version === version)
      if (!v) fail(`校验后找不到版本 ${version}`)
      log(`  ✓ ${p.name}@${v.version}`)
      log(`    install: ${marketInstallTarget(p.name, v).spec}`)
    } catch (e) {
      fail(`校验失败: ${e.constructor.name} path=${e.path ?? '-'} reason=${e.reason ?? e.message}`)
    }
  }

  step(6, '提交索引并打 tag')
  if (dryRun) log('  (dry-run) 跳过')
  else {
    if (git('status', '--porcelain')) {
      git('add', 'index.json')
      git('commit', '-m', `market: pin v${version} to ${sha.slice(0, 7)}`)
      log('  索引已提交')
    } else log('  索引无变化')
    try {
      git('rev-parse', `refs/tags/v${version}`)
      log(`  tag v${version} 已存在，跳过`)
    } catch {
      git('tag', `v${version}`, sha)
      log(`  已打 tag v${version} → ${sha.slice(0, 7)}`)
    }
  }

  step(7, '推送')
  if (dryRun || noPush) log('  跳过')
  else {
    git('push', 'origin', 'HEAD')
    git('push', 'origin', `v${version}`)
    log('  已推送分支与 tag')
  }

  console.log('\n────────────────────────────')
  console.log(`版本      : ${version}`)
  console.log(`commit    : ${sha}`)
  console.log(`索引地址  : https://cdn.jsdelivr.net/gh/zelinwang/dsh-upgrade-linux@main/index.json`)
  if (dryRun) console.log('模式      : dry-run，未写入任何文件')
}

main().catch((e) => {
  const out = e.stdout ? e.stdout.toString() : ''
  const err = e.stderr ? e.stderr.toString() : ''
  console.error('\n✗ 执行失败')
  if (out) console.error(out)
  if (err) console.error(err)
  if (!out && !err) console.error(e.message)
  process.exit(1)
})