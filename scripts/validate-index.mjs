#!/usr/bin/env node
/**
 * validate-index.mjs — 用 DSH 官方校验器检查 index.json
 * 用法: node scripts/validate-index.mjs [路径]
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const file = process.argv[2] ?? path.join(repoRoot, 'index.json')

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

const validatorPath = findValidator()
if (!validatorPath) {
  console.error('✗ 找不到 @deepseek-ai/dsh-plugin-market-index，请在装有 DSH 的机器上运行')
  process.exit(1)
}

const text = fs.readFileSync(file, 'utf8')
let value
try {
  value = JSON.parse(text)
} catch (e) {
  console.error(`✗ JSON 语法错误: ${e.message}`)
  process.exit(1)
}

const { parseMarketIndex, marketInstallTarget } = await import(pathToFileURL(validatorPath).href)
try {
  const parsed = parseMarketIndex(value, 'https://example.com/index.json')
  console.log(`✓ 校验通过  ${file}  (${parsed.plugins.length} 个插件)`)
  for (const p of parsed.plugins) {
    console.log(`  ${p.name}  ${p.versions.length} 个版本`)
    for (const v of p.versions) {
      console.log(`    ${v.version}  engines.dsh=${v.engines.dsh ?? '(any)'}`)
      console.log(`    install: ${marketInstallTarget(p.name, v).spec}`)
    }
  }
} catch (e) {
  console.error(`✗ 校验失败: ${e.constructor.name} path=${e.path ?? '-'} reason=${e.reason ?? e.message}`)
  process.exit(1)
}