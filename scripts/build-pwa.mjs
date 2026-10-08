import fs from 'node:fs'
import crypto from 'node:crypto'
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name])
const files = walk('dist').filter(p=>!p.endsWith('/sw.js')&&!p.endsWith('.map'))
const version = crypto.createHash('sha256').update(files.map(p=>fs.readFileSync(p)).join('')).digest('hex').slice(0,16)
let sw = fs.readFileSync('public/sw.js','utf8')
sw = sw.replace('__VERSION__',version).replace('__PRECACHE__',JSON.stringify(files.map(p=>'/'+p.slice(5))))
fs.writeFileSync('dist/sw.js',sw)
fs.writeFileSync('dist/version.json',JSON.stringify({version:'1.0.3',build:version}))
